"""Pipeline runner — executes bot chains sequentially with output forwarding."""
import asyncio
from database import SessionLocal
from models import Pipeline, PipelineStep, PipelineRun, Bot, Run, new_id, utcnow
from bot_runner import run_bot, active_tasks


async def run_pipeline(pipeline_id: str):
    """Run all steps in a pipeline sequentially."""
    db = SessionLocal()
    try:
        pipeline = db.query(Pipeline).get(pipeline_id)
        if not pipeline or not pipeline.enabled:
            return

        steps = db.query(PipelineStep).filter(
            PipelineStep.pipeline_id == pipeline_id
        ).order_by(PipelineStep.step_order).all()

        if not steps:
            return

        # Create pipeline run
        p_run = PipelineRun(id=new_id(), pipeline_id=pipeline_id, status="running", current_step=0)
        db.add(p_run)
        db.commit()

        prev_output = None

        for i, step in enumerate(steps):
            bot = db.query(Bot).get(step.bot_id)
            if not bot:
                if pipeline.error_policy == "abort":
                    p_run.status = "failed"
                    p_run.finished_at = utcnow()
                    db.commit()
                    return
                continue

            p_run.current_step = i + 1
            db.commit()

            # Determine input
            input_context = None
            if step.input_mode == "forward" and prev_output:
                input_context = prev_output
            elif step.input_mode == "merge" and prev_output:
                input_context = prev_output  # Runner merges with bot prompt

            # Create and run bot
            run = Run(
                id=new_id(), bot_id=bot.id,
                trigger=f"pipeline:{pipeline_id}:step:{i+1}",
                status="running",
                input=input_context[:4000] if input_context else None,
            )
            db.add(run)
            db.commit()

            # Detach
            bot_data = Bot(
                id=bot.id, name=bot.name, emoji=bot.emoji, description=bot.description,
                prompt=bot.prompt, model=bot.model, tools=bot.tools, schedule=bot.schedule,
                docs_path=bot.docs_path, notify=bot.notify, enabled=bot.enabled,
                max_runtime_seconds=bot.max_runtime_seconds,
            )
            run_data = Run(id=run.id, bot_id=run.bot_id, trigger=run.trigger, status=run.status, started_at=run.started_at)

            # Run and wait for completion
            await run_bot(bot_data, run_data, lambda: SessionLocal(), input_context=input_context)

            # Check result
            db2 = SessionLocal()
            try:
                completed_run = db2.query(Run).get(run.id)
                if completed_run.status == "completed":
                    prev_output = completed_run.output
                elif pipeline.error_policy == "abort":
                    p_run = db.query(PipelineRun).get(p_run.id)
                    p_run.status = "failed"
                    p_run.finished_at = utcnow()
                    db.commit()
                    return
                elif pipeline.error_policy == "skip":
                    prev_output = None
                elif pipeline.error_policy == "retry":
                    # One retry
                    run2 = Run(
                        id=new_id(), bot_id=bot.id,
                        trigger=f"pipeline:{pipeline_id}:step:{i+1}:retry",
                        status="running", input=input_context[:4000] if input_context else None,
                    )
                    db.add(run2)
                    db.commit()
                    run2_data = Run(id=run2.id, bot_id=run2.bot_id, trigger=run2.trigger, status=run2.status, started_at=run2.started_at)
                    await run_bot(bot_data, run2_data, lambda: SessionLocal(), input_context=input_context)
                    db3 = SessionLocal()
                    retry_run = db3.query(Run).get(run2.id)
                    prev_output = retry_run.output if retry_run.status == "completed" else None
                    db3.close()
                    if not prev_output and pipeline.error_policy == "retry":
                        p_run = db.query(PipelineRun).get(p_run.id)
                        p_run.status = "failed"
                        p_run.finished_at = utcnow()
                        db.commit()
                        return
            finally:
                db2.close()

        # All steps done
        p_run = db.query(PipelineRun).get(p_run.id)
        p_run.status = "completed"
        p_run.finished_at = utcnow()
        db.commit()

    finally:
        db.close()
