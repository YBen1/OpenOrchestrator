"""Channel management routes."""
import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import Channel, BotChannel, new_id

router = APIRouter(prefix="/api", tags=["channels"])


class ChannelCreate(BaseModel):
    type: str
    name: str = ""
    config: dict


@router.get("/channels")
def list_channels(db: Session = Depends(get_db)):
    channels = db.query(Channel).all()
    result = []
    for ch in channels:
        cfg = json.loads(ch.config)
        safe_cfg = {}
        for k, v in cfg.items():
            if "token" in k.lower() or "pass" in k.lower():
                safe_cfg[k] = "•" * 10 + str(v)[-4:] if len(str(v)) > 4 else v
            else:
                safe_cfg[k] = v
        result.append({
            "id": ch.id, "type": ch.type, "name": ch.name,
            "config": safe_cfg, "status": ch.status,
            "error_msg": ch.error_msg,
            "created_at": ch.created_at.isoformat() if ch.created_at else None,
        })
    return result


@router.post("/channels")
async def create_channel(data: ChannelCreate, db: Session = Depends(get_db)):
    ch = Channel(
        id=new_id(), type=data.type, name=data.name or data.type.capitalize(),
        config=json.dumps(data.config), status="pending",
    )
    if data.type == "telegram":
        from channels import test_telegram
        try:
            result = await test_telegram(data.config.get("bot_token", ""), data.config.get("chat_id", ""))
            ch.status = "connected" if result.get("ok") else "error"
            if not result.get("ok"):
                ch.error_msg = result.get("description", "Test fehlgeschlagen")
        except Exception as e:
            ch.status = "error"
            ch.error_msg = str(e)[:200]
    elif data.type == "webhook":
        ch.status = "connected"
    db.add(ch)
    db.commit()
    db.refresh(ch)
    return {"id": ch.id, "type": ch.type, "name": ch.name, "status": ch.status, "error_msg": ch.error_msg}


@router.delete("/channels/{channel_id}")
def delete_channel(channel_id: str, db: Session = Depends(get_db)):
    ch = db.query(Channel).get(channel_id)
    if not ch:
        raise HTTPException(404)
    db.query(BotChannel).filter(BotChannel.channel_id == channel_id).delete()
    db.delete(ch)
    db.commit()
    return {"ok": True}


@router.post("/channels/telegram/find-chat")
async def find_telegram_chat(data: dict):
    from channels import get_telegram_chat_id
    bot_token = data.get("bot_token", "")
    if not bot_token:
        raise HTTPException(400, "bot_token required")
    result = await get_telegram_chat_id(bot_token)
    if result:
        return result
    raise HTTPException(404, "Kein Chat gefunden — schreibe deinem Bot zuerst eine Nachricht auf Telegram")


@router.post("/channels/{channel_id}/test")
async def test_channel(channel_id: str, db: Session = Depends(get_db)):
    ch = db.query(Channel).get(channel_id)
    if not ch:
        raise HTTPException(404)
    cfg = json.loads(ch.config)
    if ch.type == "telegram":
        from channels import test_telegram
        result = await test_telegram(cfg.get("bot_token"), cfg.get("chat_id"))
        ch.status = "connected" if result.get("ok") else "error"
        ch.error_msg = None if result.get("ok") else result.get("description", "Fehler")
        db.commit()
        return {"ok": result.get("ok"), "error": ch.error_msg}
    return {"ok": False, "error": "Nicht unterstützt"}


class BotChannelUpdate(BaseModel):
    channel_id: str
    notify_rule: str = "always"


@router.get("/bots/{bot_id}/channels")
def get_bot_channels(bot_id: str, db: Session = Depends(get_db)):
    links = db.query(BotChannel).filter(BotChannel.bot_id == bot_id).all()
    return [{"channel_id": l.channel_id, "notify_rule": l.notify_rule} for l in links]


@router.put("/bots/{bot_id}/channels")
def update_bot_channels(bot_id: str, data: list[BotChannelUpdate], db: Session = Depends(get_db)):
    db.query(BotChannel).filter(BotChannel.bot_id == bot_id).delete()
    for item in data:
        db.add(BotChannel(bot_id=bot_id, channel_id=item.channel_id, notify_rule=item.notify_rule))
    db.commit()
    return {"ok": True}
