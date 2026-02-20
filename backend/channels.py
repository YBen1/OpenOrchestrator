"""Notification channels — Telegram, Email, Webhook."""
import json
import asyncio
import httpx
from typing import Optional
from database import SessionLocal
from models import Setting


async def send_telegram(bot_token: str, chat_id: str, message: str) -> dict:
    """Send a Telegram message."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.telegram.org/bot{bot_token}/sendMessage",
            json={"chat_id": chat_id, "text": message, "parse_mode": "Markdown"},
            timeout=10,
        )
        return resp.json()


async def send_webhook(url: str, payload: dict) -> dict:
    """POST to a webhook URL."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload, timeout=10)
        return {"status": resp.status_code, "body": resp.text[:200]}


async def send_email(smtp_host: str, smtp_port: int, smtp_user: str, smtp_pass: str,
                     from_addr: str, to_addr: str, subject: str, body: str) -> dict:
    """Send an email via SMTP."""
    import aiosmtplib
    from email.message import EmailMessage
    msg = EmailMessage()
    msg["From"] = from_addr
    msg["To"] = to_addr
    msg["Subject"] = subject
    msg.set_content(body)
    try:
        await aiosmtplib.send(msg, hostname=smtp_host, port=smtp_port,
                              username=smtp_user, password=smtp_pass, start_tls=True)
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def get_telegram_chat_id(bot_token: str) -> Optional[dict]:
    """Get the most recent chat from getUpdates."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.telegram.org/bot{bot_token}/getUpdates",
            params={"limit": 5, "offset": -5},
            timeout=10,
        )
        data = resp.json()
        if not data.get("ok") or not data.get("result"):
            return None
        # Find the most recent private chat
        for update in reversed(data["result"]):
            msg = update.get("message", {})
            chat = msg.get("chat", {})
            if chat.get("id"):
                return {
                    "chat_id": str(chat["id"]),
                    "name": chat.get("first_name", "") + " " + chat.get("last_name", ""),
                    "username": chat.get("username", ""),
                }
    return None


async def test_telegram(bot_token: str, chat_id: str) -> dict:
    """Send a test message."""
    return await send_telegram(bot_token, chat_id, "✅ openOrchestrator ist verbunden!")


def format_notification(bot_name: str, bot_emoji: str, status: str, output: str,
                        duration_ms: int = None, tokens: int = None, fmt: str = "short") -> str:
    """Format a notification message."""
    status_emoji = {"completed": "✅", "failed": "❌", "timeout": "⏰"}.get(status, "❓")
    
    if fmt == "short":
        msg = f"{bot_emoji} *{bot_name}* — {status_emoji} {status.capitalize()}"
        if output:
            preview = output[:200].replace("*", "").replace("_", "")
            msg += f"\n{preview}"
        meta = []
        if duration_ms:
            meta.append(f"{duration_ms / 1000:.1f}s")
        if tokens:
            meta.append(f"{tokens} Tokens")
        if meta:
            msg += f"\n_{' · '.join(meta)}_"
        return msg
    else:  # full
        msg = f"{bot_emoji} *{bot_name}*\nStatus: {status_emoji} {status}\n\n{output or 'Kein Output'}"
        return msg
