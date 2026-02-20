"""APScheduler integration — runs bots on cron schedules."""
import asyncio
import random
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from database import SessionLocal
from models import Bot, Run, new_id
from bot_runner import run_bot, active_tasks

scheduler = AsyncIOScheduler()
_registered_jobs: dict = {}


def _parse_schedule(schedule: str):
    """Parse cron expression or human-readable schedule."""
    parts = schedule.strip().split()
    if len(parts) == 5:
        return CronTrigger(
            minute=parts[0], hour=parts[1], day=parts[2],
            month=parts[3], day_of_week=parts[4],
            jitter=30,  # ±30s random offset
        )
    # Simple intervals
    s = schedule.lower().strip()
    if "min" in s:
        try:
            mins = int(''.join(c for c in s if c.isdigit()))
            return CronTrigger(minute=f"*/{mins}", jitter=30)
        except ValueError:
            pass
    if "hour" in s or "stunde" in s:
        try:
            hours = int(''.join(c for c in s if c.isdigit()) or "1")
            return CronTrigger(hour=f"*/{hours}", jitter=30)
        except ValueError:
            pass
    return None


async def _scheduled_run(bot_id: str):
    """Execute a scheduled bot run."""
    db = SessionLocal()
    try:
        bot = db.query(Bot).get(bot_id)
        if not bot or not bot.enabled:
            return

        run = Run(id=new_id(), bot_id=bot_id, trigger="schedule", status="running")
        db.add(run)
        db.commit()
        db.refresh(run)

        # Detach
        bot_data = Bot(
            id=bot.id, name=bot.name, emoji=bot.emoji, description=bot.description,
            prompt=bot.prompt, model=bot.model, tools=bot.tools, schedule=bot.schedule,
            docs_path=bot.docs_path, notify=bot.notify, enabled=bot.enabled,
            max_runtime_seconds=bot.max_runtime_seconds,
        )
        run_data = Run(id=run.id, bot_id=run.bot_id, trigger=run.trigger, status=run.status, started_at=run.started_at)

        task = asyncio.create_task(run_bot(bot_data, run_data, lambda: SessionLocal()))
        active_tasks[run.id] = task
    finally:
        db.close()


def register_bot(bot_id: str, schedule: str):
    """Register or update a bot's scheduled job."""
    trigger = _parse_schedule(schedule)
    if not trigger:
        print(f"[scheduler] Invalid schedule for bot {bot_id}: {schedule}")
        return

    job_id = f"bot_{bot_id}"

    # Remove old job if exists
    if job_id in _registered_jobs:
        try:
            scheduler.remove_job(job_id)
        except Exception:
            pass

    scheduler.add_job(
        _scheduled_run,
        trigger=trigger,
        args=[bot_id],
        id=job_id,
        replace_existing=True,
    )
    _registered_jobs[job_id] = schedule
    print(f"[scheduler] Registered bot {bot_id}: {schedule}")


def unregister_bot(bot_id: str):
    """Remove a bot's scheduled job."""
    job_id = f"bot_{bot_id}"
    try:
        scheduler.remove_job(job_id)
        _registered_jobs.pop(job_id, None)
        print(f"[scheduler] Unregistered bot {bot_id}")
    except Exception:
        pass


def init_scheduler():
    """Load all scheduled bots and start the scheduler."""
    db = SessionLocal()
    try:
        bots = db.query(Bot).filter(
            Bot.schedule.isnot(None),
            Bot.schedule != "",
            Bot.enabled == True,
        ).all()

        for bot in bots:
            register_bot(bot.id, bot.schedule)

        print(f"[scheduler] Loaded {len(bots)} scheduled bots")
    finally:
        db.close()

    if not scheduler.running:
        scheduler.start()
        print("[scheduler] Started")


def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        print("[scheduler] Stopped")
