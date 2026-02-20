import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, Integer, Float, DateTime, ForeignKey
from database import Base


def new_id():
    return str(uuid.uuid4())[:8]


def utcnow():
    return datetime.now(timezone.utc)


class Setting(Base):
    __tablename__ = "settings"
    key = Column(String, primary_key=True)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class Bot(Base):
    __tablename__ = "bots"
    id = Column(String, primary_key=True, default=new_id)
    name = Column(String, nullable=False)
    emoji = Column(String, default="🤖")
    description = Column(Text, default="")
    prompt = Column(Text, nullable=False)
    model = Column(String, default="gpt-4o-mini")
    tools = Column(Text, default="[]")
    schedule = Column(String, nullable=True)
    docs_path = Column(String, nullable=True)
    notify = Column(Text, default='["dashboard"]')
    enabled = Column(Boolean, default=True)
    max_runtime_seconds = Column(Integer, default=120)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class Trigger(Base):
    __tablename__ = "triggers"
    id = Column(String, primary_key=True, default=new_id)
    source_bot = Column(String, ForeignKey("bots.id"), nullable=False)
    event = Column(String, nullable=False, default="completed")
    target_bot = Column(String, ForeignKey("bots.id"), nullable=False)
    target_action = Column(String, default="start")
    enabled = Column(Boolean, default=True)


class Run(Base):
    __tablename__ = "runs"
    id = Column(String, primary_key=True, default=new_id)
    bot_id = Column(String, ForeignKey("bots.id"), nullable=False)
    trigger = Column(String, default="manual")
    status = Column(String, default="running")
    input = Column(Text, nullable=True)
    output = Column(Text, nullable=True)
    log = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, default=utcnow)
    finished_at = Column(DateTime, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    tokens_in = Column(Integer, nullable=True)
    tokens_out = Column(Integer, nullable=True)
    cost_estimate = Column(Float, nullable=True)
    output_hash = Column(String, nullable=True)


class Pipeline(Base):
    __tablename__ = "pipelines"
    id = Column(String, primary_key=True, default=new_id)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    schedule = Column(String, nullable=True)
    enabled = Column(Boolean, default=True)
    error_policy = Column(String, default="abort")  # abort | skip | retry
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class PipelineStep(Base):
    __tablename__ = "pipeline_steps"
    id = Column(String, primary_key=True, default=new_id)
    pipeline_id = Column(String, ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False)
    bot_id = Column(String, ForeignKey("bots.id"), nullable=False)
    step_order = Column(Integer, nullable=False)
    input_mode = Column(String, default="forward")  # forward | merge | independent


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"
    id = Column(String, primary_key=True, default=new_id)
    pipeline_id = Column(String, ForeignKey("pipelines.id"), nullable=False)
    status = Column(String, default="running")
    current_step = Column(Integer, default=0)
    started_at = Column(DateTime, default=utcnow)
    finished_at = Column(DateTime, nullable=True)


class Channel(Base):
    __tablename__ = "channels"
    id = Column(String, primary_key=True, default=new_id)
    type = Column(String, nullable=False)  # telegram | email | webhook
    name = Column(String, default="")
    config = Column(Text, nullable=False)  # JSON
    status = Column(String, default="pending")  # connected | pending | error
    error_msg = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)


class BotChannel(Base):
    __tablename__ = "bot_channels"
    bot_id = Column(String, ForeignKey("bots.id", ondelete="CASCADE"), primary_key=True)
    channel_id = Column(String, ForeignKey("channels.id", ondelete="CASCADE"), primary_key=True)
    notify_rule = Column(String, default="always")  # always | on_new | on_error | never


class Result(Base):
    __tablename__ = "results"
    id = Column(String, primary_key=True, default=new_id)
    bot_id = Column(String, ForeignKey("bots.id"), nullable=False)
    run_id = Column(String, ForeignKey("runs.id"), nullable=False)
    title = Column(String, nullable=True)
    content = Column(Text, nullable=True)
    url = Column(String, nullable=True)
    metadata_ = Column("metadata", Text, default="{}")
    pinned = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)
