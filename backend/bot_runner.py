"""Bot runner — executes a bot's prompt via LLM API with context, token tracking, timeout."""
import os
import json
import asyncio
import hashlib
from datetime import datetime, timezone
from typing import Dict, Set, Optional

from sqlalchemy.orm import Session
from models import Bot, Run, Result, Setting, new_id, utcnow

# Active WebSocket connections per bot_id
ws_connections: Dict[str, Set] = {}
# Active tasks for cancellation
active_tasks: Dict[str, asyncio.Task] = {}

# Concurrency limiter
_semaphore: Optional[asyncio.Semaphore] = None

def get_semaphore() -> asyncio.Semaphore:
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(3)
    return _semaphore


async def broadcast(bot_id: str, message: dict):
    conns = ws_connections.get(bot_id, set())
    dead = set()
    for ws in conns:
        try:
            await ws.send_json(message)
        except Exception:
            dead.add(ws)
    conns -= dead


def _get_setting(db, key: str) -> Optional[str]:
    from crypto import decrypt
    s = db.query(Setting).get(key)
    if not s or not s.value:
        return None
    return decrypt(s.value)


def _get_key_for_model(model: str, db) -> tuple:
    """Returns (provider, api_key_or_url) for the given model."""
    if model.startswith("gpt") or model.startswith("o1") or model.startswith("o3") or model.startswith("o4"):
        return "openai", _get_setting(db, "openai_api_key")
    elif model.startswith("claude"):
        return "anthropic", _get_setting(db, "anthropic_api_key")
    elif model.startswith("gemini"):
        return "google", _get_setting(db, "google_api_key")
    elif model.startswith("mistral") or model.startswith("pixtral") or model.startswith("codestral"):
        return "mistral", _get_setting(db, "mistral_api_key")
    elif "/" in model:  # ollama format: llama3.1:8b or similar
        return "ollama", _get_setting(db, "ollama_base_url") or "http://localhost:11434"
    else:
        # Default: try openai
        return "openai", _get_setting(db, "openai_api_key")


def _build_context(bot: Bot, db) -> str:
    """Build system context with bot memory (last output + docs)."""
    parts = []
    if bot.description:
        parts.append(f"Du bist {bot.name}. {bot.description}")

    # Last run output
    last_run = db.query(Run).filter(
        Run.bot_id == bot.id,
        Run.status == "completed"
    ).order_by(Run.finished_at.desc()).first()
    if last_run and last_run.output:
        ts = last_run.finished_at.strftime("%d.%m.%Y %H:%M") if last_run.finished_at else "?"
        parts.append(f"\nDein letztes Ergebnis ({ts}):\n{last_run.output[:2000]}")

    # Bot docs
    if bot.docs_path and os.path.isdir(bot.docs_path):
        docs_content = []
        for fname in sorted(os.listdir(bot.docs_path))[:10]:
            fpath = os.path.join(bot.docs_path, fname)
            if os.path.isfile(fpath):
                try:
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                        docs_content.append(f"--- {fname} ---\n{f.read()[:1000]}")
                except Exception:
                    pass
        if docs_content:
            parts.append(f"\nDeine gespeicherten Notizen:\n" + "\n".join(docs_content)[:4000])

    return "\n".join(parts) if parts else f"Du bist {bot.name}."


# Pricing per 1M tokens (input, output)
PRICING = {
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4o": (2.50, 10.00),
    "gpt-4.1-nano": (0.10, 0.40),
    "gpt-4.1-mini": (0.40, 1.60),
    "gpt-4.1": (2.00, 8.00),
    "gpt-5-mini": (0.25, 2.00),
    "gpt-5.2": (1.75, 14.00),
    "claude-haiku-4-20250414": (0.80, 4.00),
    "claude-sonnet-4-20250514": (3.00, 15.00),
    "claude-opus-4-20250514": (15.00, 75.00),
    "gemini-2.0-flash": (0.10, 0.40),
    "gemini-2.5-pro": (1.25, 10.00),
    "mistral-small-latest": (0.10, 0.30),
    "mistral-large-latest": (2.00, 6.00),
}


def _estimate_cost(model: str, tokens_in: int, tokens_out: int) -> float:
    prices = PRICING.get(model, (1.00, 3.00))  # default fallback
    return (tokens_in * prices[0] + tokens_out * prices[1]) / 1_000_000


async def run_bot(bot: Bot, run: Run, db_factory, input_context: str = None):
    """Execute a bot run with context, token tracking, and timeout."""
    log_lines = []
    sem = get_semaphore()

    async def log(msg: str):
        ts = datetime.now().strftime("%H:%M:%S")
        line = f"{ts}  {msg}"
        log_lines.append(line)
        await broadcast(bot.id, {"type": "log", "run_id": run.id, "line": line})

    await log(f"Starte {bot.emoji} {bot.name}...")
    await broadcast(bot.id, {"type": "status", "bot_id": bot.id, "status": "running"})

    # Wait for semaphore slot
    async with sem:
        try:
            timeout = bot.max_runtime_seconds if hasattr(bot, 'max_runtime_seconds') and bot.max_runtime_seconds else 120
            output, tokens_in, tokens_out = await asyncio.wait_for(
                _call_llm(bot, log, db_factory, input_context),
                timeout=timeout
            )
            await log(f"✅ Fertig.")

            output_hash = hashlib.md5(output.encode()).hexdigest()[:16] if output else None
            cost = _estimate_cost(bot.model, tokens_in or 0, tokens_out or 0)

            db = db_factory()
            try:
                db_run = db.query(Run).get(run.id)
                db_run.status = "completed"
                db_run.output = output
                db_run.log = "\n".join(log_lines)
                db_run.finished_at = utcnow()
                db_run.tokens_in = tokens_in
                db_run.tokens_out = tokens_out
                db_run.cost_estimate = cost
                db_run.output_hash = output_hash
                try:
                    db_run.duration_ms = int((db_run.finished_at.replace(tzinfo=None) - db_run.started_at.replace(tzinfo=None)).total_seconds() * 1000)
                except Exception:
                    db_run.duration_ms = 0

                result = Result(
                    id=new_id(), bot_id=bot.id, run_id=run.id,
                    title=f"{bot.name} — Result",
                    content=output,
                )
                db.add(result)
                db.commit()
            finally:
                db.close()

            await broadcast(bot.id, {"type": "status", "bot_id": bot.id, "status": "completed"})
            await broadcast(bot.id, {"type": "run_complete", "run_id": run.id, "status": "completed"})
            await _notify_channels(bot, "completed", output, tokens_in + tokens_out if tokens_in and tokens_out else 0, cost, db_factory)
            await _check_triggers(bot.id, "completed", output, db_factory)

        except asyncio.TimeoutError:
            await log(f"⏰ Timeout nach {bot.max_runtime_seconds if hasattr(bot, 'max_runtime_seconds') else 120}s")
            _save_error(run.id, "timeout", "Timeout — Bot hat zu lange gebraucht", log_lines, db_factory)
            await broadcast(bot.id, {"type": "status", "bot_id": bot.id, "status": "timeout"})

        except asyncio.CancelledError:
            await log(f"🚫 Abgebrochen")
            _save_error(run.id, "cancelled", "Manuell abgebrochen", log_lines, db_factory)
            await broadcast(bot.id, {"type": "status", "bot_id": bot.id, "status": "cancelled"})

        except Exception as e:
            error_msg = _classify_error(e)
            await log(f"❌ Fehler: {error_msg}")
            _save_error(run.id, "failed", error_msg, log_lines, db_factory)
            await broadcast(bot.id, {"type": "status", "bot_id": bot.id, "status": "failed"})

    # Remove from active tasks
    active_tasks.pop(run.id, None)


def _classify_error(e: Exception) -> str:
    """Return user-friendly error message."""
    err = str(e).lower()
    if "authentication" in err or "401" in err or "invalid api key" in err:
        return "API-Key ungültig — bitte in den Einstellungen prüfen"
    elif "rate_limit" in err or "429" in err:
        return "Rate-Limit erreicht — bitte kurz warten"
    elif "insufficient_quota" in err or "billing" in err:
        return "Kein Guthaben — bitte beim Anbieter aufladen"
    elif "model_not_found" in err or "404" in err:
        return f"Model nicht verfügbar: {e}"
    elif "timeout" in err:
        return "Timeout — Anbieter antwortet nicht"
    else:
        return str(e)[:200]


def _save_error(run_id, status, error_msg, log_lines, db_factory):
    db = db_factory()
    try:
        db_run = db.query(Run).get(run_id)
        if db_run:
            db_run.status = status
            db_run.error_message = error_msg
            db_run.log = "\n".join(log_lines)
            db_run.finished_at = utcnow()
            try:
                db_run.duration_ms = int((db_run.finished_at.replace(tzinfo=None) - db_run.started_at.replace(tzinfo=None)).total_seconds() * 1000)
            except Exception:
                db_run.duration_ms = 0
            db.commit()
    finally:
        db.close()


async def _call_engine(bot: Bot, log, db_factory, input_context: str = None) -> tuple:
    """Call pi-ai engine service. Returns (output, tokens_in, tokens_out) or None if engine unavailable."""
    import json as _json
    import httpx

    ENGINE_URL = os.getenv("ENGINE_URL", "http://127.0.0.1:18800")

    # Check if engine is running
    try:
        async with httpx.AsyncClient() as client:
            health = await client.get(f"{ENGINE_URL}/health", timeout=2)
            if health.status_code != 200:
                return None
    except Exception:
        return None

    db = db_factory()
    try:
        system_prompt = _build_context(bot, db)
    finally:
        db.close()

    user_message = bot.prompt
    if input_context:
        user_message = f"Kontext vom vorherigen Schritt:\n\n{input_context}\n\nAufgabe: {bot.prompt}"

    # Parse enabled tools
    enabled_tools = []
    try:
        enabled_tools = _json.loads(bot.tools) if bot.tools else []
    except Exception:
        pass

    timeout = bot.max_runtime_seconds if hasattr(bot, 'max_runtime_seconds') and bot.max_runtime_seconds else 120

    await log(f"🚀 Engine ({bot.model})...")

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{ENGINE_URL}/run", json={
                "prompt": user_message,
                "systemPrompt": system_prompt,
                "model": bot.model,
                "tools": enabled_tools,
                "maxTokens": 4000,
            }, timeout=timeout)
            data = resp.json()

        if "error" in data:
            await log(f"⚠️ Engine error: {data['error'][:200]}")
            return data.get("output", f"Fehler: {data['error']}"), 0, 0

        tokens_in = data.get("tokens_in", 0)
        tokens_out = data.get("tokens_out", 0)
        output = data.get("output", "")
        model_used = data.get("model", bot.model)
        rounds = data.get("rounds", 1)

        for tl in data.get("tool_log", []):
            await log(f"🔧 {tl['tool']}({tl.get('args', {})})")

        await log(f"📊 {model_used} | {tokens_in}→{tokens_out} tokens | {rounds} rounds")
        return output, tokens_in, tokens_out

    except Exception as e:
        await log(f"⚠️ Engine error: {e}")
        return None  # Fall back to direct calls


async def _call_llm(bot: Bot, log, db_factory, input_context: str = None) -> tuple:
    """Call LLM via the pi-ai Agent Runner Engine (TypeScript on :18810)."""
    import json as _json
    from engine import run_agent_sync, get_api_keys

    # Parse enabled tools
    enabled_tools = []
    try:
        enabled_tools = _json.loads(bot.tools) if bot.tools else []
    except Exception:
        pass

    db = db_factory()
    try:
        api_keys = get_api_keys(db)
        system_prompt = _build_context(bot, db)
    finally:
        db.close()

    user_message = bot.prompt
    if input_context:
        user_message = f"Kontext vom vorherigen Schritt:\n\n{input_context}\n\nAufgabe: {bot.prompt}"

    timeout = bot.max_runtime_seconds if hasattr(bot, 'max_runtime_seconds') and bot.max_runtime_seconds else 120

    # Legacy tool name mapping (old UI names → engine names)
    legacy_map = {"Code": "exec", "code": "exec", "Files": "write", "files": "write"}
    engine_tools = []
    for t in enabled_tools:
        mapped = legacy_map.get(t, t)
        if mapped not in engine_tools:
            engine_tools.append(mapped)

    await log(f"🚀 Engine ({bot.model}, {len(engine_tools)} tools)...")
    try:
        result = await run_agent_sync(
            prompt=system_prompt,
            input_text=user_message,
            model=bot.model,
            tools=engine_tools,
            api_keys=api_keys,
            max_time_seconds=timeout,
            max_tool_calls=20,
        )
    except Exception as e:
        await log(f"⚠️ Engine error: {e}")
        return f"Engine error: {e}", 0, 0

    if result is None:
        await log("⚠️ Engine not available — is the Agent Runner Server running on :18810?")
        return "Error: Agent Runner Engine not available. Start it with: systemctl start openorch-engine", 0, 0

    if result.get("status") == "completed":
        tokens_in, tokens_out = 0, 0
        for event in result.get("events", []):
            if event.get("type") == "complete" and event.get("usage"):
                tokens_in = event["usage"].get("input", 0)
                tokens_out = event["usage"].get("output", 0)
            if event.get("type") == "tool_call":
                await log(f"🔧 {event['name']}({str(event.get('args', ''))[:80]})")
            if event.get("type") == "complete":
                dur = event.get("durationMs", 0) / 1000
                tc = event.get("toolCalls", 0)
                await log(f"📊 {bot.model} | {tokens_in}→{tokens_out} tokens | {tc} tools | {dur:.1f}s")
        return result.get("output", ""), tokens_in, tokens_out

    error = result.get("error", "Unknown error")
    await log(f"⚠️ Engine: {error[:200]}")
    return f"Error: {error}", 0, 0


async def _notify_channels(bot, status: str, output: str, total_tokens: int, cost: float, db_factory):
    """Send result to all linked channels."""
    from models import BotChannel, Channel
    from channels import send_telegram, send_webhook, format_notification
    import json as _json

    db = db_factory()
    try:
        links = db.query(BotChannel).filter(BotChannel.bot_id == bot.id).all()
        if not links:
            return

        for link in links:
            if link.notify_rule == "never":
                continue
            if link.notify_rule == "on_error" and status == "completed":
                continue

            ch = db.query(Channel).get(link.channel_id)
            if not ch or ch.status != "connected":
                continue

            cfg = _json.loads(ch.config)
            msg = format_notification(bot.name, bot.emoji, status, output, tokens=total_tokens)

            try:
                if ch.type == "telegram":
                    await send_telegram(cfg.get("bot_token"), cfg.get("chat_id"), msg)
                elif ch.type == "webhook":
                    await send_webhook(cfg.get("url", ""), {
                        "bot": bot.name, "status": status, "output": output[:4000],
                        "tokens": total_tokens, "cost": cost,
                    })
            except Exception:
                pass  # Don't fail the run for notification errors
    finally:
        db.close()


async def _check_triggers(source_bot_id: str, event: str, output: str, db_factory):
    """Fire triggers with payload (output forwarding)."""
    from models import Trigger
    db = db_factory()
    try:
        triggers = db.query(Trigger).filter(
            Trigger.source_bot == source_bot_id,
            Trigger.event == event,
            Trigger.enabled == True,
        ).all()

        for trigger in triggers:
            target = db.query(Bot).get(trigger.target_bot)
            if target:
                run = Run(
                    id=new_id(),
                    bot_id=target.id,
                    trigger=f"trigger:{source_bot_id}",
                    status="running",
                    input=output[:4000] if output else None,  # Forward output as input
                )
                db.add(run)
                db.commit()
                task = asyncio.create_task(run_bot(target, run, db_factory, input_context=output))
                active_tasks[run.id] = task
    finally:
        db.close()
