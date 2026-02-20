"""openOrchestrator — FastAPI Backend (v0.3.0)

Slim entrypoint. Route groups are in routers/.
"""
import os
import json
import asyncio
from typing import List
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import engine, Base, SessionLocal, get_db
from models import Bot, Run, Result, Trigger, Setting, Pipeline, WaitlistEntry, new_id, utcnow
from schemas import BotCreate, BotUpdate, BotOut, TriggerCreate, TriggerOut, RunOut, ResultOut
from bot_runner import run_bot, ws_connections, active_tasks
from scheduler import init_scheduler, shutdown_scheduler, register_bot, unregister_bot
from migrations import run_migrations

# Routers
from routers.settings import router as settings_router
from routers.channels_router import router as channels_router
from routers.pipelines_router import router as pipelines_router

BOT_DATA = os.getenv("BOT_DATA_PATH", "/srv/openOrchestrator/bot-data")

# ── Startup ───────────────────────────────────────────────

run_migrations()
Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app):
    init_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(title="openOrchestrator", version="0.3.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# Include routers
app.include_router(settings_router)
app.include_router(channels_router)
app.include_router(pipelines_router)


def db_factory():
    return SessionLocal()


def _bot_to_out(b: Bot) -> dict:
    d = {c.name: getattr(b, c.name) for c in b.__table__.columns}
    d["tools"] = json.loads(d["tools"]) if d["tools"] else []
    d["notify"] = json.loads(d["notify"]) if d["notify"] else ["dashboard"]
    return d


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
        id=bot_id, name=data.name, emoji=data.emoji, description=data.description,
        prompt=data.prompt, model=data.model, tools=json.dumps(data.tools),
        schedule=data.schedule, docs_path=docs, notify=json.dumps(data.notify),
    )
    db.add(bot)
    db.commit()
    db.refresh(bot)
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


@app.post("/api/bots/{bot_id}/duplicate", response_model=BotOut)
def duplicate_bot(bot_id: str, db: Session = Depends(get_db)):
    bot = db.query(Bot).get(bot_id)
    if not bot:
        raise HTTPException(404)
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


# ── Runs ──────────────────────────────────────────────────

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


# ── Bot Stats ─────────────────────────────────────────────

@app.get("/api/bots/{bot_id}/stats")
def get_bot_stats(bot_id: str, db: Session = Depends(get_db)):
    runs = db.query(Run).filter(Run.bot_id == bot_id).all()
    if not runs:
        return {"runs": 0, "completed": 0, "failed": 0, "rate": 0,
                "avg_duration": 0, "total_tokens": 0, "total_cost": 0}
    completed = sum(1 for r in runs if r.status == "completed")
    durations = [r.duration_ms for r in runs if r.duration_ms]
    tokens = sum((r.tokens_in or 0) + (r.tokens_out or 0) for r in runs)
    cost = sum(r.cost_estimate or 0 for r in runs)
    return {
        "runs": len(runs), "completed": completed,
        "failed": sum(1 for r in runs if r.status == "failed"),
        "rate": round(completed / len(runs) * 100),
        "avg_duration": round(sum(durations) / len(durations)) if durations else 0,
        "total_tokens": tokens, "total_cost": round(cost, 4),
    }


# ── Activity Feed ─────────────────────────────────────────

@app.get("/api/activity")
def activity_feed(db: Session = Depends(get_db)):
    runs = db.query(Run).order_by(Run.started_at.desc()).limit(20).all()
    items = []
    for r in runs:
        bot = db.query(Bot).get(r.bot_id)
        items.append({
            "id": r.id, "bot_id": r.bot_id,
            "bot_name": bot.name if bot else "?",
            "bot_emoji": bot.emoji if bot else "🤖",
            "status": r.status, "trigger": r.trigger,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            "duration_ms": r.duration_ms,
            "output_preview": (r.output or "")[:120],
            "output": r.output, "error_message": r.error_message,
            "tokens_in": r.tokens_in, "tokens_out": r.tokens_out,
            "cost_estimate": r.cost_estimate,
        })
    return items


# ── Usage ─────────────────────────────────────────────────

@app.get("/api/usage")
def get_usage(db: Session = Depends(get_db)):
    bots = db.query(Bot).all()
    per_bot = []
    for bot in bots:
        stats = db.query(
            func.count(Run.id), func.sum(Run.tokens_in),
            func.sum(Run.tokens_out), func.sum(Run.cost_estimate),
        ).filter(Run.bot_id == bot.id).first()
        per_bot.append({
            "bot_id": bot.id, "bot_name": bot.name, "bot_emoji": bot.emoji,
            "runs": stats[0] or 0, "tokens_in": stats[1] or 0,
            "tokens_out": stats[2] or 0, "cost": round(stats[3] or 0, 4),
        })
    totals = db.query(
        func.count(Run.id), func.sum(Run.tokens_in),
        func.sum(Run.tokens_out), func.sum(Run.cost_estimate),
    ).first()
    return {
        "total": {"runs": totals[0] or 0, "tokens_in": totals[1] or 0,
                  "tokens_out": totals[2] or 0, "cost": round(totals[3] or 0, 4)},
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
        return []
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


# ── Search ────────────────────────────────────────────────

@app.get("/api/search")
def search_results(q: str, db: Session = Depends(get_db)):
    """Full-text search across all bot outputs and results."""
    if not q or len(q) < 2:
        return []
    pattern = f"%{q}%"
    runs = db.query(Run).filter(
        Run.output.ilike(pattern)
    ).order_by(Run.started_at.desc()).limit(20).all()
    items = []
    for r in runs:
        bot = db.query(Bot).get(r.bot_id)
        items.append({
            "id": r.id, "type": "run", "bot_id": r.bot_id,
            "bot_name": bot.name if bot else "?",
            "bot_emoji": bot.emoji if bot else "🤖",
            "status": r.status,
            "preview": _highlight(r.output or "", q, 200),
            "started_at": r.started_at.isoformat() if r.started_at else None,
        })
    return items


def _highlight(text: str, query: str, max_len: int = 200) -> str:
    """Find the query in text and return surrounding context."""
    idx = text.lower().find(query.lower())
    if idx == -1:
        return text[:max_len]
    start = max(0, idx - 60)
    end = min(len(text), idx + len(query) + 140)
    snippet = text[start:end]
    if start > 0:
        snippet = "..." + snippet
    if end < len(text):
        snippet = snippet + "..."
    return snippet


# ── Export ────────────────────────────────────────────────

@app.get("/api/bots/{bot_id}/export")
def export_bot(bot_id: str, db: Session = Depends(get_db)):
    """Export a bot as JSON (config + recent results)."""
    bot = db.query(Bot).get(bot_id)
    if not bot:
        raise HTTPException(404)
    runs = db.query(Run).filter(Run.bot_id == bot_id, Run.status == "completed").order_by(Run.started_at.desc()).limit(10).all()
    return {
        "version": "1.0",
        "bot": {
            "name": bot.name, "emoji": bot.emoji, "description": bot.description,
            "prompt": bot.prompt, "model": bot.model,
            "tools": json.loads(bot.tools) if bot.tools else [],
            "schedule": bot.schedule,
            "max_runtime_seconds": bot.max_runtime_seconds,
        },
        "recent_results": [{
            "output": r.output, "status": r.status,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "tokens": (r.tokens_in or 0) + (r.tokens_out or 0),
        } for r in runs],
    }


@app.post("/api/bots/import")
def import_bot(data: dict, db: Session = Depends(get_db)):
    """Import a bot from JSON export."""
    bot_data = data.get("bot", {})
    if not bot_data.get("name") or not bot_data.get("prompt"):
        raise HTTPException(400, "Bot needs name and prompt")
    bot_id = new_id()
    docs = os.path.join(BOT_DATA, bot_id)
    os.makedirs(docs, exist_ok=True)
    bot = Bot(
        id=bot_id, name=bot_data["name"], emoji=bot_data.get("emoji", "🤖"),
        description=bot_data.get("description", ""), prompt=bot_data["prompt"],
        model=bot_data.get("model", "gpt-4o-mini"),
        tools=json.dumps(bot_data.get("tools", [])),
        schedule=bot_data.get("schedule"), docs_path=docs,
        max_runtime_seconds=bot_data.get("max_runtime_seconds", 120),
    )
    db.add(bot)
    db.commit()
    db.refresh(bot)
    if bot.schedule:
        register_bot(bot.id, bot.schedule)
    return _bot_to_out(bot)


# ── Export CSV ────────────────────────────────────────────

@app.get("/api/bots/{bot_id}/export-csv")
def export_csv(bot_id: str, db: Session = Depends(get_db)):
    """Export bot runs as CSV."""
    from fastapi.responses import PlainTextResponse
    runs = db.query(Run).filter(Run.bot_id == bot_id).order_by(Run.started_at.desc()).limit(100).all()
    lines = ["Zeitpunkt;Status;Dauer (s);Tokens;Kosten ($);Output"]
    for r in runs:
        ts = r.started_at.strftime("%d.%m.%Y %H:%M") if r.started_at else ""
        dur = f"{r.duration_ms / 1000:.1f}" if r.duration_ms else ""
        tokens = str((r.tokens_in or 0) + (r.tokens_out or 0))
        cost = f"{r.cost_estimate:.4f}" if r.cost_estimate else "0"
        output = (r.output or "").replace(";", ",").replace("\n", " ")[:500]
        lines.append(f"{ts};{r.status};{dur};{tokens};{cost};{output}")
    return PlainTextResponse("\n".join(lines), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename=bot-{bot_id}-runs.csv"})


# ── System Info ───────────────────────────────────────────

@app.get("/api/system")
def system_info(db: Session = Depends(get_db)):
    """System status overview."""
    import sqlite3
    bot_count = db.query(func.count(Bot.id)).scalar()
    run_count = db.query(func.count(Run.id)).scalar()
    pipeline_count = db.query(func.count(Pipeline.id)).scalar()
    # DB size
    db_path = os.getenv("DATABASE_URL", "sqlite:///./openorchestrator.db").replace("sqlite:///", "")
    db_size = os.path.getsize(db_path) if os.path.exists(db_path) else 0
    # Active keys
    keys_set = []
    for key in ["openai_api_key", "anthropic_api_key", "google_api_key", "mistral_api_key"]:
        s = db.query(Setting).get(key)
        if s and s.value:
            keys_set.append(key.replace("_api_key", "").capitalize())
    return {
        "version": "0.3.0",
        "bots": bot_count,
        "runs": run_count,
        "pipelines": pipeline_count,
        "db_size_mb": round(db_size / 1024 / 1024, 2),
        "providers_connected": keys_set,
        "scheduler_running": True,  # If we got here, it's running
    }


# ── Templates & Health ────────────────────────────────────

@app.get("/api/templates")
def list_templates():
    from templates import TEMPLATES
    return TEMPLATES


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "openOrchestrator", "version": "0.3.0"}


# ── Waitlist ─────────────────────────────────────────────

@app.post("/api/waitlist")
def waitlist_signup(data: dict, db: Session = Depends(get_db)):
    email = (data.get("email") or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(400, "Invalid email")
    existing = db.query(WaitlistEntry).filter(WaitlistEntry.email == email).first()
    if existing:
        return {"ok": True, "message": "already_registered"}
    entry = WaitlistEntry(id=new_id(), email=email)
    db.add(entry)
    db.commit()
    return {"ok": True, "message": "registered"}


@app.get("/api/waitlist")
def waitlist_list(db: Session = Depends(get_db)):
    entries = db.query(WaitlistEntry).order_by(WaitlistEntry.created_at.desc()).all()
    return [{"email": e.email, "created_at": e.created_at.isoformat()} for e in entries]
