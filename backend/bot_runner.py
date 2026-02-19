"""Bot runner — executes a bot's prompt via LLM API or mock."""
import os
import json
import asyncio
from datetime import datetime, timezone
from typing import Dict, Set

from sqlalchemy.orm import Session
from models import Bot, Run, Result, new_id, utcnow

# Active WebSocket connections per bot_id
ws_connections: Dict[str, Set] = {}


async def broadcast(bot_id: str, message: dict):
    conns = ws_connections.get(bot_id, set())
    dead = set()
    for ws in conns:
        try:
            await ws.send_json(message)
        except Exception:
            dead.add(ws)
    conns -= dead


async def run_bot(bot: Bot, run: Run, db_factory):
    """Execute a bot run. Uses OpenAI/Anthropic if keys available, else mock."""
    log_lines = []

    async def log(msg: str):
        ts = datetime.now().strftime("%H:%M:%S")
        line = f"{ts}  {msg}"
        log_lines.append(line)
        await broadcast(bot.id, {"type": "log", "run_id": run.id, "line": line})

    await log(f"Starte {bot.emoji} {bot.name}...")
    await broadcast(bot.id, {"type": "status", "bot_id": bot.id, "status": "running"})

    try:
        output = await _call_llm(bot, log)
        await log(f"✅ Fertig.")

        db = db_factory()
        try:
            db_run = db.query(Run).get(run.id)
            db_run.status = "completed"
            db_run.output = output
            db_run.log = "\n".join(log_lines)
            db_run.finished_at = utcnow()
            db_run.duration_ms = int((db_run.finished_at - db_run.started_at).total_seconds() * 1000)

            # Save result
            result = Result(
                id=new_id(),
                bot_id=bot.id,
                run_id=run.id,
                title=f"Run {run.id} output",
                content=output,
            )
            db.add(result)
            db.commit()
        finally:
            db.close()

        await broadcast(bot.id, {"type": "status", "bot_id": bot.id, "status": "completed"})
        await broadcast(bot.id, {"type": "run_complete", "run_id": run.id, "status": "completed"})

        # Check triggers
        await _check_triggers(bot.id, "completed", db_factory)

    except Exception as e:
        await log(f"❌ Fehler: {e}")
        db = db_factory()
        try:
            db_run = db.query(Run).get(run.id)
            db_run.status = "failed"
            db_run.log = "\n".join(log_lines)
            db_run.finished_at = utcnow()
            db_run.duration_ms = int((db_run.finished_at - db_run.started_at).total_seconds() * 1000)
            db.commit()
        finally:
            db.close()
        await broadcast(bot.id, {"type": "status", "bot_id": bot.id, "status": "failed"})


async def _call_llm(bot: Bot, log) -> str:
    openai_key = os.getenv("OPENAI_API_KEY")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")

    model = bot.model or "gpt-4o-mini"

    if openai_key and not model.startswith("claude"):
        await log("Verwende OpenAI API...")
        import openai
        client = openai.AsyncOpenAI(api_key=openai_key)
        resp = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": f"Du bist {bot.name}. {bot.description}"},
                {"role": "user", "content": bot.prompt},
            ],
            max_tokens=2000,
        )
        return resp.choices[0].message.content

    elif anthropic_key and model.startswith("claude"):
        await log("Verwende Anthropic API...")
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=anthropic_key)
        resp = await client.messages.create(
            model=model,
            max_tokens=2000,
            system=f"Du bist {bot.name}. {bot.description}",
            messages=[{"role": "user", "content": bot.prompt}],
        )
        return resp.content[0].text

    else:
        await log("Kein API-Key gefunden — verwende Echo/Mock...")
        await asyncio.sleep(1)
        return f"[Mock] Bot '{bot.name}' ausgeführt.\nPrompt: {bot.prompt}\nModel: {model}\n\nDies ist eine Test-Antwort. Setze OPENAI_API_KEY oder ANTHROPIC_API_KEY für echte Ergebnisse."


async def _check_triggers(source_bot_id: str, event: str, db_factory):
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
                )
                db.add(run)
                db.commit()
                asyncio.create_task(run_bot(target, run, db_factory))
    finally:
        db.close()
