"""openOrchestrator — FastAPI Backend"""
import os, json, asyncio
from typing import List
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import engine, Base, SessionLocal, get_db
from models import Bot, Run, Result, Trigger, new_id, utcnow
from schemas import BotCreate, BotUpdate, BotOut, TriggerCreate, TriggerOut, RunOut, ResultOut
from bot_runner import run_bot, ws_connections

BOT_DATA = os.getenv("BOT_DATA_PATH", "/srv/openOrchestrator/bot-data")

Base.metadata.create_all(bind=engine)

app = FastAPI(title="openOrchestrator", version="0.1.0")
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
    return _bot_to_out(bot)


@app.delete("/api/bots/{bot_id}")
def delete_bot(bot_id: str, db: Session = Depends(get_db)):
    bot = db.query(Bot).get(bot_id)
    if not bot:
        raise HTTPException(404, "Bot not found")
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
    # Detach bot data before passing to async task
    bot_data = Bot(
        id=bot.id, name=bot.name, emoji=bot.emoji, description=bot.description,
        prompt=bot.prompt, model=bot.model, tools=bot.tools, schedule=bot.schedule,
        docs_path=bot.docs_path, notify=bot.notify,
    )
    run_data = Run(id=run.id, bot_id=run.bot_id, trigger=run.trigger, status=run.status, started_at=run.started_at)
    asyncio.create_task(run_bot(bot_data, run_data, db_factory))
    return run


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
        })
    return items


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


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "openOrchestrator"}
