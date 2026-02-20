from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class BotCreate(BaseModel):
    name: str
    emoji: str = "🤖"
    description: str = ""
    prompt: str
    model: str = "gpt-4o-mini"
    tools: List[str] = []
    schedule: Optional[str] = None
    notify: List[str] = ["dashboard"]


class BotUpdate(BaseModel):
    name: Optional[str] = None
    emoji: Optional[str] = None
    description: Optional[str] = None
    prompt: Optional[str] = None
    model: Optional[str] = None
    tools: Optional[List[str]] = None
    schedule: Optional[str] = None
    notify: Optional[List[str]] = None
    enabled: Optional[bool] = None
    max_runtime_seconds: Optional[int] = None


class BotOut(BaseModel):
    id: str
    name: str
    emoji: str
    description: str
    prompt: str
    model: str
    tools: List[str]
    schedule: Optional[str]
    notify: List[str]
    enabled: Optional[bool] = True
    max_runtime_seconds: Optional[int] = 120
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class TriggerCreate(BaseModel):
    source_bot: str
    event: str = "completed"
    target_bot: str
    target_action: str = "start"
    enabled: bool = True


class TriggerOut(BaseModel):
    id: str
    source_bot: str
    event: str
    target_bot: str
    target_action: str
    enabled: bool

    class Config:
        from_attributes = True


class RunOut(BaseModel):
    id: str
    bot_id: str
    trigger: Optional[str]
    status: str
    input: Optional[str]
    output: Optional[str]
    log: Optional[str]
    error_message: Optional[str] = None
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    duration_ms: Optional[int]
    tokens_in: Optional[int] = None
    tokens_out: Optional[int] = None
    cost_estimate: Optional[float] = None

    class Config:
        from_attributes = True


class ResultOut(BaseModel):
    id: str
    bot_id: str
    run_id: str
    title: Optional[str]
    content: Optional[str]
    url: Optional[str]
    pinned: bool
    created_at: Optional[datetime]

    class Config:
        from_attributes = True
