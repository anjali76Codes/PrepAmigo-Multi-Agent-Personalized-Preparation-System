import os
import time
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    thread_id: str | None = Field(default=None, min_length=1, max_length=128)


class ChatResponse(BaseModel):
    thread_id: str
    message: str


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
    yield


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
