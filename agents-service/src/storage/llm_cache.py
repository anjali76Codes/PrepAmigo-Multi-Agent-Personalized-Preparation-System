"""
LLM response cache: a LangChain BaseCache over the shared response cache
(tools/cache.py), so a repeated run with unchanged inputs spends no tokens
or generation time on the steps whose prompts didn't change.

Key: provider + model + temperature + token cap + reasoning flag (passed in
by config.get_llm, because ChatOllama's own cache key leaves the model
out), LangChain's model/tool-binding string, and the full prompt. Any
change to a prompt, to the inputs it was built from, or to the model is a
miss.

Entries are stored as JSON (message_to_dict), never pickled, so they are
inspectable at .data/research_cache/llm/<hash>.json and safe to load. Each
entry keeps the original generation time: a hit is reported in the run
metrics as a cache hit together with the time the original call took.

A caller that rejects a response (unparseable JSON, too few items) calls
`forget_response(message)`, so a bad answer isn't replayed on every rerun
for the cache's lifetime.
"""
import asyncio
import hashlib
import logging
import threading
import time
import uuid
from collections import OrderedDict
from typing import Any, Optional, Sequence

from langchain_core.caches import BaseCache
from langchain_core.messages import AIMessage, message_to_dict, messages_from_dict
from langchain_core.outputs import ChatGeneration, Generation

from config import settings
from tools.cache import ResponseCache, caches_bypassed, get_response_cache, replay_delay

logger = logging.getLogger(__name__)

NAMESPACE = "llm"
# message id -> (cache, key params) of recent responses, for forget_response
_RECENT_LIMIT = 512
_recent: "OrderedDict[str, tuple[ResponseCache, dict[str, str]]]" = OrderedDict()
_recent_lock = threading.Lock()


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _remember(message: Any, store: ResponseCache, params: dict[str, str]) -> None:
    message_id = getattr(message, "id", None)
    if not message_id:
        return
    with _recent_lock:
        _recent[message_id] = (store, params)
        while len(_recent) > _RECENT_LIMIT:
            _recent.popitem(last=False)


def forget_response(message: Any) -> None:
    """Drop the cache entry that produced (or would replay) `message`.
    No-op for messages that didn't come through the cache."""
    with _recent_lock:
        found = _recent.pop(getattr(message, "id", None) or "", None)
    if found:
        store, params = found
        try:
            store.delete(NAMESPACE, params)
        except OSError:
            logger.warning("Could not delete a rejected LLM cache entry", exc_info=True)


class LLMResponseCache(BaseCache):
    def __init__(self, store: ResponseCache, model_key: str, ttl_seconds: int):
        self.store = store
        self.model_key = model_key
        self.ttl_seconds = ttl_seconds
        # miss -> when it was looked up, so update() knows how long the call took
        self._pending: dict[str, float] = {}
        self._lock = threading.Lock()

    def _params(self, prompt: str, llm_string: str) -> dict[str, str]:
        return {"model": self.model_key, "llm_sha256": _sha(llm_string), "prompt_sha256": _sha(prompt)}

    def lookup(self, prompt: str, llm_string: str) -> Optional[Sequence[Generation]]:
        generations, delay = self._lookup(prompt, llm_string)
        if delay:
            time.sleep(delay)
        return generations

    async def alookup(self, prompt: str, llm_string: str) -> Optional[Sequence[Generation]]:
        # file I/O is small and local: no executor hop
        generations, delay = self._lookup(prompt, llm_string)
        if delay:
            await asyncio.sleep(delay)
        return generations

    def _lookup(self, prompt: str, llm_string: str) -> tuple[Optional[list[Generation]], float]:
        """(cached generations or None, seconds to wait when replaying the
        original latency: see tools/cache.replay_delay)."""
        params = self._params(prompt, llm_string)
        # a model keeps its cache object for life: honour a later bypass
        # (tools/cache.bypass_caches) at call time
        if caches_bypassed():
            return None, 0.0
        entry = self.store.get_entry(NAMESPACE, params, self.ttl_seconds)
        if entry is None:
            with self._lock:
                self._pending[params["prompt_sha256"]] = time.perf_counter()
            return None, 0.0
        delay = replay_delay(entry)
        original_ms = float(entry.get("latency_ms") or 0.0)
        try:
            generations = []
            for item in entry["response"]:
                message = messages_from_dict([item["message"]])[0]
                # a fresh id: two hits on one answer must stay two messages
                # in a LangGraph thread (add_messages merges by id)
                message.id = f"cache-{uuid.uuid4().hex}"
                _remember(message, self.store, params)
                generations.append(ChatGeneration(
                    message=message,
                    generation_info={**(item.get("generation_info") or {}),
                                     # time actually saved: nothing when the latency was replayed
                                     "cache": {"hit": True, "latency_ms": max(original_ms - delay * 1000, 0.0)}},
                ))
            return generations, delay
        except Exception:
            logger.warning("Unreadable LLM cache entry; treating as a miss", exc_info=True)
            return None, 0.0

    def update(self, prompt: str, llm_string: str, return_val: Sequence[Generation]) -> None:
        params = self._params(prompt, llm_string)
        with self._lock:
            started = self._pending.pop(params["prompt_sha256"], None)
        messages = [getattr(g, "message", None) for g in return_val]
        # only complete answers: an empty reply is retried next time
        if caches_bypassed() or not messages or not all(
            isinstance(m, AIMessage) and (m.content or m.tool_calls) for m in messages
        ):
            return
        try:
            self.store.set(
                NAMESPACE, params,
                [{"message": message_to_dict(m), "generation_info": g.generation_info} for g, m in zip(return_val, messages)],
                latency_ms=(time.perf_counter() - started) * 1000 if started else None,
                ttl_seconds=self.ttl_seconds,
            )
        except (OSError, TypeError, ValueError):
            logger.warning("Could not cache an LLM response", exc_info=True)
            return
        for m in messages:
            _remember(m, self.store, params)

    async def aupdate(self, prompt: str, llm_string: str, return_val: Sequence[Generation]) -> None:
        self.update(prompt, llm_string, return_val)

    def clear(self, **kwargs: Any) -> None:
        raise NotImplementedError("delete .data/research_cache/llm/ to clear the LLM cache")


_instances: dict[str, LLMResponseCache] = {}


def llm_response_cache(model_key: str) -> LLMResponseCache | None:
    """One cache per model configuration, or None when LLM_CACHE_ENABLED is
    false or the response cache is disabled."""
    if not settings.llm_cache_enabled:
        return None
    store = get_response_cache()
    if store is None:
        return None
    if model_key not in _instances:
        _instances[model_key] = LLMResponseCache(store, model_key, settings.llm_cache_ttl_seconds)
    return _instances[model_key]
