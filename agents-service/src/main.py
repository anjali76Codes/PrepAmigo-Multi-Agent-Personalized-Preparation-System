import os
import sys
from pathlib import Path

# Ensure 'src' directory is in sys.path so modules resolve correctly under uvicorn
_src_dir = str(Path(__file__).resolve().parent)
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

import time
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from streaming.publisher import get_event_publisher
from streaming.runner import execute_agent_stream

logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    thread_id: str | None = Field(default=None, min_length=1, max_length=128)


class ChatResponse(BaseModel):
    thread_id: str
    message: str


class ExecuteAgentRequest(BaseModel):
    runId: str = Field(min_length=1, max_length=128)
    query: str = Field(min_length=1, max_length=4000)
    thread_id: str | None = Field(default=None, min_length=1, max_length=128)


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

    app.state.graph = build_graph()
    app.state.publisher = get_event_publisher()
    yield
    if hasattr(app.state, "publisher"):
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


@app.post("/internal/agent/execute")
async def execute_agent_async(
    request: ExecuteAgentRequest,
    background_tasks: BackgroundTasks,
):
    """
    Decoupled trigger endpoint: initiates LangGraph workflow in a background task
    and immediately returns acceptance. Execution lifecycle is completely independent
    of client connection state.
    """
    background_tasks.add_task(
        execute_agent_stream,
        run_id=request.runId,
        query=request.query,
        graph=app.state.graph,
        publisher=app.state.publisher,
        thread_id=request.thread_id,
    )
    return {"status": "accepted", "runId": request.runId}


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    from langchain_core.messages import HumanMessage

    thread_id = request.thread_id or f"thread-{time.time_ns()}"
    try:
        result = app.state.graph.invoke(
            {"messages": [HumanMessage(content=request.message)]},
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
        error_text = str(exc).lower()
        if "model" in error_text and ("not found" in error_text or "404" in error_text):
            detail = (
                "The configured LLM model is unavailable. "
                "Check OLLAMA_MODEL or install the model in Ollama."
            )
        elif "serpapi" in error_text:
            detail = "Flight search is unavailable because SERPAPI_API_KEY is not configured."
        else:
            detail = "The agent service could not complete the request. Check the service logs."
        raise HTTPException(
            status_code=503,
            detail=detail,
        ) from exc
