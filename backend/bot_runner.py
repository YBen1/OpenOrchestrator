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
    s = db.query(Setting).get(key)
    return s.value if s else None


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
                    title=f"{bot.emoji} {bot.name} — Ergebnis",
                    content=output,
                )
                db.add(result)
                db.commit()
            finally:
                db.close()

            await broadcast(bot.id, {"type": "status", "bot_id": bot.id, "status": "completed"})
            await broadcast(bot.id, {"type": "run_complete", "run_id": run.id, "status": "completed"})
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


async def _call_llm(bot: Bot, log, db_factory, input_context: str = None) -> tuple:
    """Call LLM, returns (output, tokens_in, tokens_out)."""
    db = db_factory()
    try:
        provider, key = _get_key_for_model(bot.model, db)
        system_prompt = _build_context(bot, db)
    finally:
        db.close()

    user_message = bot.prompt
    if input_context:
        user_message = f"Kontext vom vorherigen Schritt:\n\n{input_context}\n\nAufgabe: {bot.prompt}"

    if provider == "openai" and key:
        await log(f"Verwende OpenAI ({bot.model})...")
        import openai
        client = openai.AsyncOpenAI(api_key=key)
        resp = await client.chat.completions.create(
            model=bot.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            max_tokens=2000,
        )
        usage = resp.usage
        return resp.choices[0].message.content, usage.prompt_tokens if usage else 0, usage.completion_tokens if usage else 0

    elif provider == "anthropic" and key:
        await log(f"Verwende Anthropic ({bot.model})...")
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=key)
        resp = await client.messages.create(
            model=bot.model,
            max_tokens=2000,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        return resp.content[0].text, resp.usage.input_tokens, resp.usage.output_tokens

    elif provider == "google" and key:
        await log(f"Verwende Google Gemini ({bot.model})...")
        import google.generativeai as genai
        genai.configure(api_key=key)
        model = genai.GenerativeModel(bot.model, system_instruction=system_prompt)
        resp = await asyncio.to_thread(model.generate_content, user_message)
        tokens_in = resp.usage_metadata.prompt_token_count if hasattr(resp, 'usage_metadata') else 0
        tokens_out = resp.usage_metadata.candidates_token_count if hasattr(resp, 'usage_metadata') else 0
        return resp.text, tokens_in, tokens_out

    elif provider == "mistral" and key:
        await log(f"Verwende Mistral ({bot.model})...")
        from mistralai import Mistral
        client = Mistral(api_key=key)
        resp = await asyncio.to_thread(
            client.chat.complete,
            model=bot.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
        )
        usage = resp.usage
        return resp.choices[0].message.content, usage.prompt_tokens if usage else 0, usage.completion_tokens if usage else 0

    elif provider == "ollama":
        base_url = key if key != "ollama" else "http://localhost:11434"
        await log(f"Verwende Ollama ({bot.model})...")
        import openai
        client = openai.AsyncOpenAI(base_url=f"{base_url}/v1", api_key="ollama")
        resp = await client.chat.completions.create(
            model=bot.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
        )
        usage = resp.usage
        return resp.choices[0].message.content, usage.prompt_tokens if usage else 0, usage.completion_tokens if usage else 0

    else:
        await log("⚠️ Kein API-Key konfiguriert — verwende Mock...")
        await asyncio.sleep(1)
        return (
            f"[Mock] Kein API-Key für '{bot.model}' konfiguriert.\n"
            f"Bitte in den Einstellungen einen Key hinterlegen.\n\n"
            f"Bot: {bot.name}\nPrompt: {bot.prompt[:200]}",
            0, 0
        )


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
