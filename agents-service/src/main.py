import os
import sys
import time
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Ensure 'src' directory is in sys.path so modules resolve correctly under uvicorn
_src_dir = str(Path(__file__).resolve().parent)
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from graph.errors import friendly_error_detail
from observability import configure_logging
from streaming.publisher import get_event_publisher
from streaming.runner import execute_agent_stream

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
    query: str = Field(min_length=1, max_length=4000)
    thread_id: str | None = Field(default=None, min_length=1, max_length=128)
    # keys long-term memory for agents that use it (e.g. content research)
    user_id: str | None = Field(default=None, min_length=1, max_length=128)


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

START_TIME = time.time()


@app.get("/health")
def health_check():
    return {
        "status": "UP",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime": time.time() - START_TIME,
        "environment": os.getenv("ENVIRONMENT", "development"),
    }


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Synchronous turn: waits for the full reply. For step-by-step
    progress use /internal/agent/execute, which streams over the
    Redis-backed SSE pipeline documented in docs/SSE_STREAMING_GUIDE.md."""
    from langchain_core.messages import HumanMessage

    thread_id = request.thread_id or f"thread-{time.time_ns()}"
    payload: dict[str, Any] = {"messages": [HumanMessage(content=request.message)]}
    if request.user_id:
        payload["user_id"] = request.user_id
    try:
        result = await app.state.graph.ainvoke(
            payload,
            config={"configurable": {"thread_id": thread_id}},
        )
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
        user_id=request.user_id,
    )
    return {"status": "accepted", "runId": request.runId}
