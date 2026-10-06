"""
Which models are answering too slowly right now: a circuit breaker.

Ollama Cloud once slowed about tenfold for a while (17-40s before the
first token, then ~15 tokens/s). Every later call still went to it and
waited out its timeout: three research write-ups hit their 120s budget, all
six planner calls timed out, and a ~50s run took 6m24s.

A finished call that took at least LLM_SLOW_CALL_SECONDS while producing
fewer than SLOW_TOKENS_PER_SECOND, or a call its caller gave up on after
that long, marks its model degraded for LLM_DEGRADED_SECONDS. A model
built with get_llm(guarded=True) then sends its calls to the fast model
(when one is configured) or fails at once with ModelDegradedError, so the
caller takes its own fallback in milliseconds instead of minutes. After
the window the model is tried again.

Process-wide on purpose: a slow provider is slow for every run on it. Fed
by observability.metrics.MetricsCallback, which times every model call.
"""
import logging
import threading
import time

from core.config import settings

logger = logging.getLogger(__name__)

# a healthy model writes far faster: nemotron-3-nano did ~200 tokens/s
SLOW_TOKENS_PER_SECOND = 20

_lock = threading.Lock()
_degraded_until: dict[str, float] = {}


class ModelDegradedError(RuntimeError):
    """The model was skipped because it has been answering too slowly."""


def observe(model: str, seconds: float, output_tokens: int = 0, *, cut_off: bool = False) -> None:
    """Record one call. `cut_off`: the caller's timeout ended it."""
    if not model or seconds < settings.llm_slow_call_seconds:
        return
    if not cut_off and output_tokens and output_tokens / seconds >= SLOW_TOKENS_PER_SECOND:
        return  # long, but a long answer at a normal speed
    now = time.monotonic()
    with _lock:
        newly = _degraded_until.get(model, 0.0) <= now
        _degraded_until[model] = now + settings.llm_degraded_seconds
    if newly:
        speed = "cut off by its caller" if cut_off else f"{output_tokens} tokens"
        logger.warning("Model %s is answering slowly (%.0fs, %s); routing around it for %.0fs",
                       model, seconds, speed, settings.llm_degraded_seconds)


def degraded(model: str) -> bool:
    with _lock:
        return _degraded_until.get(model, 0.0) > time.monotonic()


def reset() -> None:
    """Forget every observation (tests)."""
    with _lock:
        _degraded_until.clear()
