import logging
import os
from typing import Any, Dict, Optional
import redis.asyncio as aioredis
from core.config import settings
from .models import AgentStreamEvent, EventType

logger = logging.getLogger(__name__)


class EventPublisher:
    """Publishes domain events to Redis Pub/Sub and buffers recent history for client replay."""

    def __init__(self, redis_url: Optional[str] = None, ttl_seconds: Optional[int] = None):
        self.redis_url = redis_url or settings.redis_url
        self.ttl_seconds = ttl_seconds if ttl_seconds is not None else settings.redis_event_ttl_seconds
        self._redis: Optional[aioredis.Redis] = None

    async def get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(self.redis_url, decode_responses=True)
            logger.info("[Redis Publisher] Connected to Redis at %s", self.redis_url)
        return self._redis

    async def emit(self, event: AgentStreamEvent) -> None:
        try:
            r = await self.get_redis()
            event_json = event.model_dump_json()
            channel = f"agent:events:{event.runId}"
            history_key = f"agent:history:{event.runId}"

            async with r.pipeline(transaction=True) as pipe:
                pipe.rpush(history_key, event_json)
                pipe.expire(history_key, self.ttl_seconds)
                pipe.publish(channel, event_json)
                await pipe.execute()

            logger.info(
                "[Redis Publisher] Published '%s' event (id: %s) -> channel '%s' & history '%s'",
                event.type.value,
                event.id,
                channel,
                history_key,
            )
        except Exception as exc:
            logger.error("[Redis Publisher] Failed to emit event for runId %s: %s", event.runId, exc)

    async def emit_event(
        self,
        run_id: str,
        event_type: EventType,
        payload: Dict[str, Any],
    ) -> AgentStreamEvent:
        event = AgentStreamEvent(
            runId=run_id,
            type=event_type,
            payload=payload,
        )
        await self.emit(event)
        return event

    async def close(self) -> None:
        if self._redis:
            await self._redis.close()
            self._redis = None
            logger.info("[Redis Publisher] Redis connection closed")


_global_publisher: Optional[EventPublisher] = None


def get_event_publisher() -> EventPublisher:
    global _global_publisher
    if _global_publisher is None:
        _global_publisher = EventPublisher()
    return _global_publisher
