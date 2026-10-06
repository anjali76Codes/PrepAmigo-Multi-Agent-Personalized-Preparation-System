"""
Direct SSE streaming endpoint for PrepAmigo agents.

Clients connect here after triggering a run via POST /internal/agent/execute.
This endpoint:
  1. Replays any missed events from Redis history (agent:history:{runId})
  2. Subscribes to live events from Redis pub/sub (agent:events:{runId})
  3. Emits ping heartbeats every SSE_PING_INTERVAL_SECONDS to prevent timeouts
  4. Self-terminates when a 'completed' or 'failed' terminal event is received,
     or the watchdog fires after SSE_WATCHDOG_TIMEOUT_SECONDS of silence

This removes the need for a Node.js relay — the frontend can connect directly
to Python FastAPI for SSE. The Node.js gateway (if running) continues to work
unchanged via the Redis pub/sub channel.

Relevant env vars:
  SSE_PING_INTERVAL_SECONDS   (default 15)  — heartbeat interval
  SSE_WATCHDOG_TIMEOUT_SECONDS (default 35) — silence threshold before auto-close
  REDIS_URL                   (default redis://localhost:6379)
"""
import asyncio
import json
import logging
from typing import AsyncIterator

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from core.auth import verify_token
from core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

TERMINAL_EVENTS = {"completed", "failed", "waiting"}


def _format_sse(raw: str) -> str:
    """Format raw JSON event into standard SSE packet with optional id and event lines."""
    try:
        event = json.loads(raw)
        lines = []
        event_id = event.get("id")
        event_type = event.get("type")
        if event_id:
            lines.append(f"id: {event_id}\n")
        if event_type:
            lines.append(f"event: {event_type}\n")
        lines.append(f"data: {raw}\n\n")
        return "".join(lines)
    except Exception:
        return f"data: {raw}\n\n"


async def _event_stream(run_id: str) -> AsyncIterator[str]:
    """Core SSE generator: replays Redis history, then subscribes for live events."""
    redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
    history_key = f"agent:history:{run_id}"
    channel = f"agent:events:{run_id}"

    try:
        # ── 1. Replay missed events from Redis history ────────────────────────
        history = await redis_client.lrange(history_key, 0, -1)
        for raw in history:
            yield _format_sse(raw)
            try:
                event = json.loads(raw)
                if event.get("type") in TERMINAL_EVENTS:
                    logger.info("[SSE] Run %s already terminal (from history) — closing", run_id)
                    return
            except (json.JSONDecodeError, TypeError):
                pass

        # ── 2. Subscribe to live events ───────────────────────────────────────
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(channel)
        logger.info("[SSE] Subscribed to channel %s for run %s", channel, run_id)

        loop = asyncio.get_event_loop()
        last_event_time = loop.time()

        try:
            while True:
                # ── Watchdog: close if worker went silent ─────────────────────
                elapsed = loop.time() - last_event_time
                if elapsed >= settings.sse_watchdog_timeout_seconds:
                    logger.warning(
                        "[SSE] Watchdog: no events for %.0fs on run %s — closing", elapsed, run_id
                    )
                    timeout_event = json.dumps({
                        "type": "failed",
                        "runId": run_id,
                        "payload": {
                            "status": "error",
                            "detail": "Agent execution timed out or worker disconnected.",
                        },
                    })
                    yield _format_sse(timeout_event)
                    return

                # ── Poll for next message (non-blocking, 100ms window) ─────────
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=0.1)
                if message and message.get("type") == "message":
                    raw = message["data"]
                    last_event_time = loop.time()
                    yield _format_sse(raw)
                    try:
                        event = json.loads(raw)
                        if event.get("type") in TERMINAL_EVENTS:
                            logger.info("[SSE] Terminal event '%s' on run %s — closing", event["type"], run_id)
                            return
                    except (json.JSONDecodeError, TypeError):
                        pass
                else:
                    # ── Heartbeat ping when idle long enough ──────────────────
                    idle = loop.time() - last_event_time
                    if idle >= settings.sse_ping_interval_seconds:
                        ping = json.dumps({"type": "ping", "runId": run_id})
                        yield _format_sse(ping)
                        last_event_time = loop.time()  # reset so we don't flood pings
                    await asyncio.sleep(0.05)
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()
    finally:
        await redis_client.aclose()


@router.get(
    "/api/agent/stream/{run_id}",
    response_class=StreamingResponse,
    summary="Stream agent events for a run via SSE",
    description=(
        "Opens a Server-Sent Events stream for the given runId. "
        "Replays any events already published (Redis history), then streams "
        "live events until a 'completed' or 'failed' terminal event is received. "
        "Heartbeats are sent every SSE_PING_INTERVAL_SECONDS to prevent timeouts."
    ),
    tags=["Streaming"],
)
async def stream_agent_run(
    run_id: str,
    _: object = Depends(verify_token),
) -> StreamingResponse:
    """Direct SSE endpoint — no Node.js relay required.

    Usage:
      1. POST /internal/agent/execute  →  { runId, threadId }
      2. GET  /api/agent/stream/{runId}  →  SSE stream
    """
    return StreamingResponse(
        _event_stream(run_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disables Nginx response buffering
            "Connection": "keep-alive",
        },
    )
