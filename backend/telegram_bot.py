"""Telegram Bot for zero-friction user connection.

Runs as a background thread inside the FastAPI process.
Handles /start <token> commands to link users.
Also provides send_message() for bot notifications.
"""
import os
import asyncio
import logging
import threading
from datetime import datetime, timezone

import httpx

logger = logging.getLogger("telegram_bot")

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
API_BASE = "https://api.telegram.org/bot{token}"

_offset = 0
_running = False
_thread = None
_link_callback = None  # set by main app


def set_link_callback(cb):
    """Register callback: cb(token, chat_id, username, first_name)"""
    global _link_callback
    _link_callback = cb


async def send_message(chat_id: str, text: str, parse_mode: str = "HTML"):
    """Send a message to a Telegram chat."""
    if not BOT_TOKEN:
        logger.warning("No TELEGRAM_BOT_TOKEN set, skipping send")
        return None
    url = API_BASE.format(token=BOT_TOKEN) + "/sendMessage"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(url, json={
            "chat_id": chat_id,
            "text": text,
            "parse_mode": parse_mode,
        })
        return resp.json()


async def _poll_updates():
    """Long-poll Telegram for updates."""
    global _offset
    if not BOT_TOKEN:
        return []
    url = API_BASE.format(token=BOT_TOKEN) + "/getUpdates"
    async with httpx.AsyncClient(timeout=35) as client:
        try:
            resp = await client.post(url, json={
                "offset": _offset,
                "timeout": 25,
                "allowed_updates": ["message"],
            })
            data = resp.json()
            if not data.get("ok"):
                logger.error(f"Telegram API error: {data}")
                return []
            updates = data.get("result", [])
            if updates:
                _offset = updates[-1]["update_id"] + 1
            return updates
        except Exception as e:
            logger.error(f"Telegram poll error: {e}")
            await asyncio.sleep(5)
            return []


def _handle_update(update):
    """Process a single update."""
    msg = update.get("message", {})
    text = msg.get("text", "")
    chat = msg.get("chat", {})
    user = msg.get("from", {})

    chat_id = str(chat.get("id", ""))
    username = user.get("username", "")
    first_name = user.get("first_name", "")

    # Handle /start <token>
    if text.startswith("/start "):
        token = text.split(" ", 1)[1].strip()
        if token and _link_callback:
            logger.info(f"Link request: token={token}, chat_id={chat_id}, user={username}")
            _link_callback(token, chat_id, username, first_name)
    elif text == "/start":
        # Generic start without token
        asyncio.get_event_loop().create_task(send_message(
            chat_id,
            "👋 <b>Welcome to openOrchestrator!</b>\n\n"
            "To connect, use the link from the app.\n"
            "Go to Settings → Channels → Connect Telegram."
        ))


async def _run_loop():
    """Main polling loop."""
    global _running
    logger.info("Telegram bot polling started")
    while _running:
        updates = await _poll_updates()
        for update in updates:
            try:
                _handle_update(update)
            except Exception as e:
                logger.error(f"Error handling update: {e}")
    logger.info("Telegram bot polling stopped")


def _thread_target():
    """Thread entry point."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(_run_loop())


def start():
    """Start the bot polling in a background thread."""
    global _running, _thread
    if not BOT_TOKEN:
        logger.warning("No TELEGRAM_BOT_TOKEN — Telegram bot disabled")
        return
    if _running:
        return
    _running = True
    _thread = threading.Thread(target=_thread_target, daemon=True, name="telegram-bot")
    _thread.start()
    logger.info("Telegram bot thread started")


def stop():
    """Stop the bot polling."""
    global _running
    _running = False
    if _thread:
        _thread.join(timeout=5)
    logger.info("Telegram bot stopped")


def get_bot_info():
    """Get bot username (sync, for startup)."""
    if not BOT_TOKEN:
        return None
    import requests
    url = API_BASE.format(token=BOT_TOKEN) + "/getMe"
    try:
        resp = requests.get(url, timeout=10)
        data = resp.json()
        if data.get("ok"):
            return data["result"]
    except Exception as e:
        logger.error(f"getMe error: {e}")
    return None
