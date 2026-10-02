import os
import sys
import time
import logging
import hashlib
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Ensure 'src' directory is in sys.path so modules resolve correctly under uvicorn
_src_dir = str(Path(__file__).resolve().parent)
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

from fastapi import BackgroundTasks, FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator

from graph.errors import friendly_error_detail
from observability import configure_logging
from streaming.publisher import get_event_publisher
from streaming.runner import execute_agent_stream
from core.auth import verify_token
from routers.job_intelligence_router import router as job_intelligence_router
from routers.skill_gap_router import router as skill_gap_router
from agents.interview_prep_fields import WORKFLOW_FIELDS

configure_logging()
logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    thread_id: str | None = Field(default=None, min_length=1, max_length=128)
    # keys long-term memory; without it the turn neither recalls nor saves memories
    user_id: str | None = Field(default=None, min_length=1, max_length=128)


class ChatResponse(BaseModel):
    thread_id: str
    message: str


class ExecuteAgentRequest(BaseModel):
    runId: str = Field(min_length=1, max_length=128)
    query: str = Field(default="", max_length=4000)
    thread_id: str | None = Field(default=None, min_length=1, max_length=128)
    # keys long-term memory for agents that use it (e.g. content research)
    user_id: str | None = Field(default=None, min_length=1, max_length=128)
    workflow_mode: str | None = None
    workflow_input: dict[str, Any] = Field(default_factory=dict)
    workflow_text_input: str | None = Field(default=None, max_length=4000)
    resume_input: dict[str, Any] | None = None

    @model_validator(mode="after")
    def validate_execution_mode(self):
        if self.workflow_mode not in {None, "interview_prep"}:
            raise ValueError("Unsupported workflow_mode")
        if not self.query and not self.workflow_mode and self.resume_input is None:
            raise ValueError("query, workflow_mode, or resume_input is required")
        if self.resume_input is not None and not self.thread_id:
            raise ValueError("thread_id is required to resume a workflow")
        return self


def _resolve_user_id(auth_payload: Any, requested_user_id: str | None) -> str | None:
    if auth_payload is True:
        return requested_user_id
    if isinstance(auth_payload, dict):
        value = auth_payload.get("sub") or auth_payload.get("id") or auth_payload.get("userId")
        return str(value) if value else None
    return None


def _scope_thread_id(auth_payload: Any, user_id: str | None, thread_id: str) -> str:
    if not isinstance(auth_payload, dict) or not user_id:
        return thread_id
    scope = hashlib.sha256(user_id.encode("utf-8")).hexdigest()[:16]
    prefix = f"user-{scope}:"
    return thread_id if thread_id.startswith(prefix) else f"{prefix}{thread_id}"


def _message_text(message: Any) -> str:
    content = getattr(message, "content", message)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            item.get("text", "")
            for item in content
            if isinstance(item, dict) and item.get("type") == "text"
        )
    return str(content)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from graph.builder import build_graph
    from memory.nodes import drain_pending_saves

    app.state.graph = build_graph()
    app.state.publisher = get_event_publisher()
    yield
    # memory saves run in the background; let in-flight ones finish
    await drain_pending_saves()
    await app.state.publisher.close()


app = FastAPI(title="TravelAmigo Agents", lifespan=lifespan)

cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
]
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

app.include_router(job_intelligence_router)
app.include_router(skill_gap_router)

START_TIME = time.time()


@app.get("/health")
def health_check():
    return {
        "status": "UP",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime": time.time() - START_TIME,
        "environment": os.getenv("ENVIRONMENT", "development"),
    }


@app.get("/api/interview-prep/fields", dependencies=[Depends(verify_token)])
def interview_prep_fields():
    return {
        "fields": [
            {
                "name": field.name,
                "label": field.label,
                "description": field.description,
                "required": field.required,
                "recipients": list(field.recipients),
                "maxLength": field.max_length,
            }
            for field in WORKFLOW_FIELDS
        ]
    }


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, auth_payload: Any = Depends(verify_token)):
    """Synchronous turn: waits for the full reply. For step-by-step
    progress use /internal/agent/execute, which streams over the
    Redis-backed SSE pipeline documented in docs/agents/SSE_STREAMING_GUIDE.md."""
    from langchain_core.messages import HumanMessage

    user_id = _resolve_user_id(auth_payload, request.user_id)
    requested_thread_id = request.thread_id or f"thread-{time.time_ns()}"
    thread_id = _scope_thread_id(auth_payload, user_id, requested_thread_id)
    config = {"configurable": {"thread_id": thread_id}}
    payload: dict[str, Any] = {
        "messages": [HumanMessage(content=request.message)],
        "workflow_mode": None,
        "workflow_input": {},
        "workflow_text_input": None,
        "interview_prep_input": {},
        "workflow_clarification_rounds": 0,
    }
    if user_id:
        payload["user_id"] = user_id
    try:
        from langgraph.types import Command

        snapshot = None
        if hasattr(app.state.graph, "aget_state"):
            snapshot = await app.state.graph.aget_state(config)
        if snapshot is not None and "interview_prep_pause" in (snapshot.next or ()):
            result = await app.state.graph.ainvoke(
                Command(resume={"answer": request.message}), config=config
            )
        else:
            result = await app.state.graph.ainvoke(payload, config=config)
        messages = result.get("messages", [])
        if not messages:
            raise RuntimeError("Agent returned no messages")
        return ChatResponse(thread_id=thread_id, message=_message_text(messages[-1]))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Agent request failed for thread %s", thread_id)
        raise HTTPException(status_code=503, detail=friendly_error_detail(exc)) from exc


@app.post("/internal/agent/execute")
async def execute_agent_async(
    request: ExecuteAgentRequest,
    background_tasks: BackgroundTasks,
    auth_payload: Any = Depends(verify_token),
):
    """
    Decoupled trigger endpoint: initiates the multi-agent graph in a
    background task and immediately returns acceptance. Execution runs
    independently of client connection state; progress is published to
    Redis (channel agent:events:{runId}) for the Node.js gateway to relay
    over SSE. Works for any specialist the supervisor can route to (chat,
    research, ...) — see streaming/langgraph_bridge.py for how graph
    updates become the published event stream.
    """
    background_tasks.add_task(
        execute_agent_stream,
        run_id=request.runId,
        query=request.query,
        graph=app.state.graph,
        publisher=app.state.publisher,
        thread_id=request.thread_id,
        user_id=_resolve_user_id(auth_payload, request.user_id),
        workflow_mode=request.workflow_mode,
        workflow_input=request.workflow_input,
        workflow_text_input=request.workflow_text_input,
        resume_input=request.resume_input,
    )
    return {"status": "accepted", "runId": request.runId}
