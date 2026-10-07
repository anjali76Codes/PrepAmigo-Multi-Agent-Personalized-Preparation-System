from enum import Enum
from typing import Any, Dict
import time
import uuid
from pydantic import BaseModel, Field


class EventType(str, Enum):
    THINKING = "thinking"
    RESEARCHING = "researching"
    CALLING_AGENT = "calling_agent"
    WAITING = "waiting"
    PROCESSING = "processing"
    STRUCTURING = "structuring"
    # one tool invocation's lifecycle (payload.status running -> completed|failed,
    # paired by payload.tool_call_id); progress only, never ends the stream
    TOOL_CALL = "tool_call"
    COMPLETED = "completed"
    FAILED = "failed"
    PING = "ping"


class AgentStreamEvent(BaseModel):
    id: str = Field(default_factory=lambda: f"{int(time.time() * 1000)}-{uuid.uuid4().hex[:6]}")
    runId: str
    type: EventType
    payload: Dict[str, Any] = Field(default_factory=dict)
    timestamp: int = Field(default_factory=lambda: int(time.time() * 1000))
