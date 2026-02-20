"""openOrchestrator — FastAPI Backend"""
import os, json, asyncio
from typing import List, Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import engine, Base, SessionLocal, get_db
from models import Bot, Run, Result, Trigger, Setting, Channel, BotChannel, Pipeline, PipelineStep, PipelineRun, new_id, utcnow
from schemas import BotCreate, BotUpdate, BotOut, TriggerCreate, TriggerOut, RunOut, ResultOut
from bot_runner import run_bot, ws_connections, active_tasks
from scheduler import init_scheduler, shutdown_scheduler, register_bot, unregister_bot
from migrations import run_migrations

BOT_DATA = os.getenv("BOT_DATA_PATH", "/srv/openOrchestrator/bot-data")

# Run migrations before creating tables
run_migrations()
Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app):
    init_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(title="openOrchestrator", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def db_factory():
    return SessionLocal()


def _bot_to_out(b: Bot) -> dict:
    d = {c.name: getattr(b, c.name) for c in b.__table__.columns}
    d["tools"] = json.loads(d["tools"]) if d["tools"] else []
    d["notify"] = json.loads(d["notify"]) if d["notify"] else ["dashboard"]
    return d


# ── Settings ──────────────────────────────────────────────

SENSITIVE_KEYS = {"openai_api_key", "anthropic_api_key", "google_api_key", "mistral_api_key", "brave_api_key"}


@app.get("/api/settings")
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(Setting).all()
    result = {}
    for s in settings:
        if s.key in SENSITIVE_KEYS and s.value:
            # Mask: show only last 4 chars
            result[s.key] = "•" * 20 + s.value[-4:] if len(s.value) > 4 else s.value
            result[f"{s.key}_set"] = True
        else:
            result[s.key] = s.value
    return result


class SettingsUpdate(BaseModel):
    settings: dict


@app.put("/api/settings")
def update_settings(data: SettingsUpdate, db: Session = Depends(get_db)):
    for key, value in data.settings.items():
        # Don't save masked values
        if value and "•" in str(value):
            continue
        existing = db.query(Setting).get(key)
        if existing:
            existing.value = str(value)
            existing.updated_at = utcnow()
        else:
            db.add(Setting(key=key, value=str(value)))
    db.commit()
    return {"ok": True}


class ValidateKeyRequest(BaseModel):
    provider: str
    key: str


@app.post("/api/settings/validate-key")
async def validate_key(data: ValidateKeyRequest, db: Session = Depends(get_db)):
    provider = data.provider.lower()
    key = data.key.strip()

    try:
        if provider == "openai":
            import openai
            client = openai.AsyncOpenAI(api_key=key)
            models = await client.models.list()
            model_ids = sorted([m.id for m in models.data if any(m.id.startswith(p) for p in ("gpt", "o1", "o3", "o4"))])[:20]
            return {"valid": True, "models": model_ids}

        elif provider == "anthropic":
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=key)
            await client.messages.create(
                model="claude-haiku-4-20250414", max_tokens=1,
                messages=[{"role": "user", "content": "hi"}]
            )
            return {"valid": True, "models": ["claude-haiku-4-20250414", "claude-sonnet-4-20250514", "claude-opus-4-20250514"]}

        elif provider == "google":
            import google.generativeai as genai
            genai.configure(api_key=key)
            models = await asyncio.to_thread(genai.list_models)
            model_ids = [m.name.replace("models/", "") for m in models if "generateContent" in (m.supported_generation_methods or [])]
            return {"valid": True, "models": model_ids[:20]}

        elif provider == "mistral":
            from mistralai import Mistral
            client = Mistral(api_key=key)
            models = await asyncio.to_thread(client.models.list)
            model_ids = [m.id for m in models.data] if models.data else ["mistral-small-latest", "mistral-large-latest"]
            return {"valid": True, "models": model_ids[:20]}

        elif provider == "ollama":
            import openai
            client = openai.AsyncOpenAI(base_url=f"{key}/v1", api_key="ollama")
            models = await client.models.list()
            model_ids = [m.id for m in models.data]
            return {"valid": True, "models": model_ids}

        else:
            return {"valid": False, "error": f"Unbekannter Anbieter: {provider}"}

    except Exception as e:
        err = str(e).lower()
        if "authentication" in err or "401" in err or "invalid" in err:
            return {"valid": False, "error": "API-Key ungültig"}
        elif "rate" in err or "429" in err:
            return {"valid": False, "error": "Rate-Limit — Key scheint gültig, aber überlastet"}
        elif "quota" in err or "billing" in err:
            return {"valid": False, "error": "Kein Guthaben — bitte beim Anbieter aufladen"}
        elif "connection" in err or "connect" in err:
            return {"valid": False, "error": "Verbindung fehlgeschlagen — URL/Server nicht erreichbar"}
        else:
            return {"valid": False, "error": str(e)[:200]}


# ── Bot CRUD ──────────────────────────────────────────────

@app.get("/api/bots", response_model=List[BotOut])
def list_bots(db: Session = Depends(get_db)):
    bots = db.query(Bot).order_by(Bot.created_at.desc()).all()
    return [_bot_to_out(b) for b in bots]


@app.get("/api/bots/{bot_id}", response_model=BotOut)
def get_bot(bot_id: str, db: Session = Depends(get_db)):
    bot = db.query(Bot).get(bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    return _bot_to_out(bot)


@app.post("/api/bots", response_model=BotOut)
def create_bot(data: BotCreate, db: Session = Depends(get_db)):
    bot_id = new_id()
    docs = os.path.join(BOT_DATA, bot_id)
    os.makedirs(docs, exist_ok=True)
    bot = Bot(
        id=bot_id,
        name=data.name,
        emoji=data.emoji,
        description=data.description,
        prompt=data.prompt,
        model=data.model,
        tools=json.dumps(data.tools),
        schedule=data.schedule,
        docs_path=docs,
        notify=json.dumps(data.notify),
    )
    db.add(bot)
    db.commit()
    db.refresh(bot)

    # Register scheduler if schedule set
    if bot.schedule:
        register_bot(bot.id, bot.schedule)

    return _bot_to_out(bot)


@app.put("/api/bots/{bot_id}", response_model=BotOut)
def update_bot(bot_id: str, data: BotUpdate, db: Session = Depends(get_db)):
    bot = db.query(Bot).get(bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        if k in ("tools", "notify"):
            setattr(bot, k, json.dumps(v))
        else:
            setattr(bot, k, v)
    bot.updated_at = utcnow()
    db.commit()
    db.refresh(bot)

    # Update scheduler
    if bot.schedule and bot.enabled:
        register_bot(bot.id, bot.schedule)
    else:
        unregister_bot(bot.id)

    return _bot_to_out(bot)


@app.delete("/api/bots/{bot_id}")
def delete_bot(bot_id: str, db: Session = Depends(get_db)):
    bot = db.query(Bot).get(bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    unregister_bot(bot_id)
    db.query(Result).filter(Result.bot_id == bot_id).delete()
    db.query(Run).filter(Run.bot_id == bot_id).delete()
    db.query(Trigger).filter((Trigger.source_bot == bot_id) | (Trigger.target_bot == bot_id)).delete()
    db.delete(bot)
    db.commit()
    return {"ok": True}


# ── Run Bot ───────────────────────────────────────────────

@app.post("/api/bots/{bot_id}/run", response_model=RunOut)
async def run_bot_endpoint(bot_id: str, db: Session = Depends(get_db)):
    bot = db.query(Bot).get(bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    run = Run(id=new_id(), bot_id=bot_id, trigger="manual", status="running")
    db.add(run)
    db.commit()
    db.refresh(run)

    bot_data = Bot(
        id=bot.id, name=bot.name, emoji=bot.emoji, description=bot.description,
        prompt=bot.prompt, model=bot.model, tools=bot.tools, schedule=bot.schedule,
        docs_path=bot.docs_path, notify=bot.notify, enabled=bot.enabled,
        max_runtime_seconds=bot.max_runtime_seconds,
    )
    run_data = Run(id=run.id, bot_id=run.bot_id, trigger=run.trigger, status=run.status, started_at=run.started_at)
    task = asyncio.create_task(run_bot(bot_data, run_data, db_factory))
    active_tasks[run.id] = task
    return run


@app.post("/api/runs/{run_id}/cancel")
async def cancel_run(run_id: str, db: Session = Depends(get_db)):
    task = active_tasks.get(run_id)
    if task and not task.done():
        task.cancel()
        return {"ok": True, "message": "Run wird abgebrochen..."}
    # Also update DB if task already gone
    run = db.query(Run).get(run_id)
    if run and run.status == "running":
        run.status = "cancelled"
        run.finished_at = utcnow()
        run.error_message = "Manuell abgebrochen"
        db.commit()
        return {"ok": True, "message": "Run abgebrochen"}
    raise HTTPException(404, "Run nicht gefunden oder bereits beendet")


@app.get("/api/bots/{bot_id}/runs", response_model=List[RunOut])
def list_runs(bot_id: str, db: Session = Depends(get_db)):
    return db.query(Run).filter(Run.bot_id == bot_id).order_by(Run.started_at.desc()).limit(50).all()


@app.get("/api/bots/{bot_id}/results", response_model=List[ResultOut])
def list_results(bot_id: str, db: Session = Depends(get_db)):
    return db.query(Result).filter(Result.bot_id == bot_id).order_by(Result.created_at.desc()).limit(50).all()


# ── Activity Feed ─────────────────────────────────────────

@app.get("/api/activity")
def activity_feed(db: Session = Depends(get_db)):
    runs = db.query(Run).order_by(Run.started_at.desc()).limit(20).all()
    items = []
    for r in runs:
        bot = db.query(Bot).get(r.bot_id)
        items.append({
            "id": r.id,
            "bot_id": r.bot_id,
            "bot_name": bot.name if bot else "?",
            "bot_emoji": bot.emoji if bot else "🤖",
            "status": r.status,
            "trigger": r.trigger,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            "duration_ms": r.duration_ms,
            "output_preview": (r.output or "")[:120],
            "output": r.output,
            "error_message": r.error_message,
            "tokens_in": r.tokens_in,
            "tokens_out": r.tokens_out,
            "cost_estimate": r.cost_estimate,
        })
    return items


# ── Usage ─────────────────────────────────────────────────

@app.get("/api/usage")
def get_usage(db: Session = Depends(get_db)):
    # Per bot
    bots = db.query(Bot).all()
    per_bot = []
    for bot in bots:
        stats = db.query(
            func.count(Run.id),
            func.sum(Run.tokens_in),
            func.sum(Run.tokens_out),
            func.sum(Run.cost_estimate),
        ).filter(Run.bot_id == bot.id).first()

        per_bot.append({
            "bot_id": bot.id,
            "bot_name": bot.name,
            "bot_emoji": bot.emoji,
            "runs": stats[0] or 0,
            "tokens_in": stats[1] or 0,
            "tokens_out": stats[2] or 0,
            "cost": round(stats[3] or 0, 4),
        })

    # Totals
    totals = db.query(
        func.count(Run.id),
        func.sum(Run.tokens_in),
        func.sum(Run.tokens_out),
        func.sum(Run.cost_estimate),
    ).first()

    return {
        "total": {
            "runs": totals[0] or 0,
            "tokens_in": totals[1] or 0,
            "tokens_out": totals[2] or 0,
            "cost": round(totals[3] or 0, 4),
        },
        "per_bot": per_bot,
    }


# ── Triggers ──────────────────────────────────────────────

@app.get("/api/triggers", response_model=List[TriggerOut])
def list_triggers(db: Session = Depends(get_db)):
    return db.query(Trigger).all()


@app.post("/api/triggers", response_model=TriggerOut)
def create_trigger(data: TriggerCreate, db: Session = Depends(get_db)):
    t = Trigger(id=new_id(), **data.model_dump())
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@app.delete("/api/triggers/{trigger_id}")
def delete_trigger(trigger_id: str, db: Session = Depends(get_db)):
    t = db.query(Trigger).get(trigger_id)
    if not t:
        raise HTTPException(404)
    db.delete(t)
    db.commit()
    return {"ok": True}


# ── Bot Docs ──────────────────────────────────────────────

@app.get("/api/bots/{bot_id}/docs")
def list_docs(bot_id: str, db: Session = Depends(get_db)):
    bot = db.query(Bot).get(bot_id)
    if not bot or not bot.docs_path:
        raise HTTPException(404)
    if not os.path.isdir(bot.docs_path):
        return []
    return [{"name": f} for f in os.listdir(bot.docs_path)]


@app.post("/api/bots/{bot_id}/docs")
async def upload_doc(bot_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    bot = db.query(Bot).get(bot_id)
    if not bot or not bot.docs_path:
        raise HTTPException(404)
    os.makedirs(bot.docs_path, exist_ok=True)
    path = os.path.join(bot.docs_path, file.filename)
    content = await file.read()
    with open(path, "wb") as f:
        f.write(content)
    return {"name": file.filename, "size": len(content)}


# ── WebSocket ─────────────────────────────────────────────

@app.websocket("/ws/bots/{bot_id}")
async def websocket_endpoint(websocket: WebSocket, bot_id: str):
    await websocket.accept()
    if bot_id not in ws_connections:
        ws_connections[bot_id] = set()
    ws_connections[bot_id].add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_connections[bot_id].discard(websocket)


# ── Channels ──────────────────────────────────────────────

class ChannelCreate(BaseModel):
    type: str
    name: str = ""
    config: dict


@app.get("/api/channels")
def list_channels(db: Session = Depends(get_db)):
    channels = db.query(Channel).all()
    result = []
    for ch in channels:
        cfg = json.loads(ch.config)
        # Mask sensitive fields
        safe_cfg = {}
        for k, v in cfg.items():
            if "token" in k.lower() or "pass" in k.lower():
                safe_cfg[k] = "•" * 10 + str(v)[-4:] if len(str(v)) > 4 else v
            else:
                safe_cfg[k] = v
        result.append({
            "id": ch.id, "type": ch.type, "name": ch.name,
            "config": safe_cfg, "status": ch.status,
            "error_msg": ch.error_msg, "created_at": ch.created_at.isoformat() if ch.created_at else None,
        })
    return result


@app.post("/api/channels")
async def create_channel(data: ChannelCreate, db: Session = Depends(get_db)):
    ch = Channel(
        id=new_id(), type=data.type, name=data.name or data.type.capitalize(),
        config=json.dumps(data.config), status="pending",
    )

    # Auto-test connection
    if data.type == "telegram":
        from channels import test_telegram
        try:
            result = await test_telegram(data.config.get("bot_token", ""), data.config.get("chat_id", ""))
            if result.get("ok"):
                ch.status = "connected"
            else:
                ch.status = "error"
                ch.error_msg = result.get("description", "Test fehlgeschlagen")
        except Exception as e:
            ch.status = "error"
            ch.error_msg = str(e)[:200]
    elif data.type == "webhook":
        ch.status = "connected"  # Can't test without sending data

    db.add(ch)
    db.commit()
    db.refresh(ch)
    return {"id": ch.id, "type": ch.type, "name": ch.name, "status": ch.status, "error_msg": ch.error_msg}


@app.delete("/api/channels/{channel_id}")
def delete_channel(channel_id: str, db: Session = Depends(get_db)):
    ch = db.query(Channel).get(channel_id)
    if not ch:
        raise HTTPException(404)
    db.query(BotChannel).filter(BotChannel.channel_id == channel_id).delete()
    db.delete(ch)
    db.commit()
    return {"ok": True}


@app.post("/api/channels/telegram/find-chat")
async def find_telegram_chat(data: dict):
    from channels import get_telegram_chat_id
    bot_token = data.get("bot_token", "")
    if not bot_token:
        raise HTTPException(400, "bot_token required")
    result = await get_telegram_chat_id(bot_token)
    if result:
        return result
    raise HTTPException(404, "Kein Chat gefunden — schreibe deinem Bot zuerst eine Nachricht auf Telegram")


@app.post("/api/channels/{channel_id}/test")
async def test_channel(channel_id: str, db: Session = Depends(get_db)):
    ch = db.query(Channel).get(channel_id)
    if not ch:
        raise HTTPException(404)
    cfg = json.loads(ch.config)
    if ch.type == "telegram":
        from channels import test_telegram
        result = await test_telegram(cfg.get("bot_token"), cfg.get("chat_id"))
        if result.get("ok"):
            ch.status = "connected"
            ch.error_msg = None
        else:
            ch.status = "error"
            ch.error_msg = result.get("description", "Fehler")
        db.commit()
        return {"ok": result.get("ok"), "error": ch.error_msg}
    return {"ok": False, "error": "Nicht unterstützt"}


# Bot-Channel assignments
@app.get("/api/bots/{bot_id}/channels")
def get_bot_channels(bot_id: str, db: Session = Depends(get_db)):
    links = db.query(BotChannel).filter(BotChannel.bot_id == bot_id).all()
    return [{"channel_id": l.channel_id, "notify_rule": l.notify_rule} for l in links]


class BotChannelUpdate(BaseModel):
    channel_id: str
    notify_rule: str = "always"


@app.put("/api/bots/{bot_id}/channels")
def update_bot_channels(bot_id: str, data: list[BotChannelUpdate], db: Session = Depends(get_db)):
    db.query(BotChannel).filter(BotChannel.bot_id == bot_id).delete()
    for item in data:
        db.add(BotChannel(bot_id=bot_id, channel_id=item.channel_id, notify_rule=item.notify_rule))
    db.commit()
    return {"ok": True}


# ── Bot Duplicate ─────────────────────────────────────────

@app.post("/api/bots/{bot_id}/duplicate", response_model=BotOut)
def duplicate_bot(bot_id: str, db: Session = Depends(get_db)):
    bot = db.query(Bot).get(bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
    new_bot_id = new_id()
    docs = os.path.join(BOT_DATA, new_bot_id)
    os.makedirs(docs, exist_ok=True)
    dup = Bot(
        id=new_bot_id, name=f"{bot.name} (Kopie)", emoji=bot.emoji,
        description=bot.description, prompt=bot.prompt, model=bot.model,
        tools=bot.tools, schedule=None, docs_path=docs, notify=bot.notify,
        enabled=True, max_runtime_seconds=bot.max_runtime_seconds,
    )
    db.add(dup)
    db.commit()
    db.refresh(dup)
    return _bot_to_out(dup)


# ── Bot Stats ─────────────────────────────────────────────

@app.get("/api/bots/{bot_id}/stats")
def get_bot_stats(bot_id: str, db: Session = Depends(get_db)):
    runs = db.query(Run).filter(Run.bot_id == bot_id).all()
    if not runs:
        return {"runs": 0, "completed": 0, "failed": 0, "rate": 0, "avg_duration": 0,
                "total_tokens": 0, "total_cost": 0}
    completed = sum(1 for r in runs if r.status == "completed")
    failed = sum(1 for r in runs if r.status == "failed")
    durations = [r.duration_ms for r in runs if r.duration_ms]
    tokens = sum((r.tokens_in or 0) + (r.tokens_out or 0) for r in runs)
    cost = sum(r.cost_estimate or 0 for r in runs)
    return {
        "runs": len(runs),
        "completed": completed,
        "failed": failed,
        "rate": round(completed / len(runs) * 100) if runs else 0,
        "avg_duration": round(sum(durations) / len(durations)) if durations else 0,
        "total_tokens": tokens,
        "total_cost": round(cost, 4),
    }


# ── Pipelines ─────────────────────────────────────────────

class PipelineCreate(BaseModel):
    name: str
    description: str = ""
    schedule: Optional[str] = None
    error_policy: str = "abort"
    steps: list  # [{"bot_id": "...", "input_mode": "forward"}, ...]


@app.get("/api/pipelines")
def list_pipelines(db: Session = Depends(get_db)):
    pipelines = db.query(Pipeline).order_by(Pipeline.created_at.desc()).all()
    result = []
    for p in pipelines:
        steps = db.query(PipelineStep).filter(
            PipelineStep.pipeline_id == p.id
        ).order_by(PipelineStep.step_order).all()
        step_data = []
        for s in steps:
            bot = db.query(Bot).get(s.bot_id)
            step_data.append({
                "id": s.id, "bot_id": s.bot_id, "step_order": s.step_order,
                "input_mode": s.input_mode,
                "bot_name": bot.name if bot else "?",
                "bot_emoji": bot.emoji if bot else "🤖",
            })
        # Last run
        last_run = db.query(PipelineRun).filter(
            PipelineRun.pipeline_id == p.id
        ).order_by(PipelineRun.started_at.desc()).first()
        result.append({
            "id": p.id, "name": p.name, "description": p.description,
            "schedule": p.schedule, "enabled": p.enabled,
            "error_policy": p.error_policy, "steps": step_data,
            "last_status": last_run.status if last_run else None,
            "last_run_at": last_run.started_at.isoformat() if last_run and last_run.started_at else None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })
    return result


@app.post("/api/pipelines")
def create_pipeline(data: PipelineCreate, db: Session = Depends(get_db)):
    p = Pipeline(
        id=new_id(), name=data.name, description=data.description,
        schedule=data.schedule, error_policy=data.error_policy,
    )
    db.add(p)
    db.flush()
    for i, step in enumerate(data.steps):
        db.add(PipelineStep(
            id=new_id(), pipeline_id=p.id, bot_id=step["bot_id"],
            step_order=i + 1, input_mode=step.get("input_mode", "forward"),
        ))
    db.commit()
    return {"id": p.id, "name": p.name}


@app.delete("/api/pipelines/{pipeline_id}")
def delete_pipeline(pipeline_id: str, db: Session = Depends(get_db)):
    p = db.query(Pipeline).get(pipeline_id)
    if not p:
        raise HTTPException(404)
    db.query(PipelineStep).filter(PipelineStep.pipeline_id == pipeline_id).delete()
    db.query(PipelineRun).filter(PipelineRun.pipeline_id == pipeline_id).delete()
    db.delete(p)
    db.commit()
    return {"ok": True}


@app.post("/api/pipelines/{pipeline_id}/run")
async def run_pipeline_endpoint(pipeline_id: str, db: Session = Depends(get_db)):
    p = db.query(Pipeline).get(pipeline_id)
    if not p:
        raise HTTPException(404)
    from pipeline_runner import run_pipeline
    asyncio.create_task(run_pipeline(pipeline_id))
    return {"ok": True, "message": "Pipeline gestartet"}


@app.get("/api/pipelines/{pipeline_id}/runs")
def list_pipeline_runs(pipeline_id: str, db: Session = Depends(get_db)):
    runs = db.query(PipelineRun).filter(
        PipelineRun.pipeline_id == pipeline_id
    ).order_by(PipelineRun.started_at.desc()).limit(20).all()
    return [{
        "id": r.id, "status": r.status, "current_step": r.current_step,
        "started_at": r.started_at.isoformat() if r.started_at else None,
        "finished_at": r.finished_at.isoformat() if r.finished_at else None,
    } for r in runs]


# ── Templates ─────────────────────────────────────────────

@app.get("/api/templates")
def list_templates():
    from templates import TEMPLATES
    return TEMPLATES


# ── Health ────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "openOrchestrator", "version": "0.2.0"}
