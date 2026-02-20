"""Pipeline management routes."""
import asyncio
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import Bot, Pipeline, PipelineStep, PipelineRun, new_id

router = APIRouter(prefix="/api", tags=["pipelines"])


class PipelineCreate(BaseModel):
    name: str
    description: str = ""
    schedule: Optional[str] = None
    error_policy: str = "abort"
    steps: list


@router.get("/pipelines")
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


@router.post("/pipelines")
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


@router.delete("/pipelines/{pipeline_id}")
def delete_pipeline(pipeline_id: str, db: Session = Depends(get_db)):
    p = db.query(Pipeline).get(pipeline_id)
    if not p:
        raise HTTPException(404)
    db.query(PipelineStep).filter(PipelineStep.pipeline_id == pipeline_id).delete()
    db.query(PipelineRun).filter(PipelineRun.pipeline_id == pipeline_id).delete()
    db.delete(p)
    db.commit()
    return {"ok": True}


@router.post("/pipelines/{pipeline_id}/run")
async def run_pipeline_endpoint(pipeline_id: str, db: Session = Depends(get_db)):
    p = db.query(Pipeline).get(pipeline_id)
    if not p:
        raise HTTPException(404)
    from pipeline_runner import run_pipeline
    asyncio.create_task(run_pipeline(pipeline_id))
    return {"ok": True, "message": "Pipeline gestartet"}


@router.get("/pipelines/{pipeline_id}/runs")
def list_pipeline_runs(pipeline_id: str, db: Session = Depends(get_db)):
    runs = db.query(PipelineRun).filter(
        PipelineRun.pipeline_id == pipeline_id
    ).order_by(PipelineRun.started_at.desc()).limit(20).all()
    return [{
        "id": r.id, "status": r.status, "current_step": r.current_step,
        "started_at": r.started_at.isoformat() if r.started_at else None,
        "finished_at": r.finished_at.isoformat() if r.finished_at else None,
    } for r in runs]
