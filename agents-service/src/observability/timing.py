"""
Standard timing/logging helpers, shared by every agent and tool call so
step and tool-call durations are inspectable the same way everywhere
(console logs, and any event payload that wants a `duration_ms` field).

Usage:

    with Timer() as t:
        result = await asyncio.to_thread(tool.invoke, payload)
    log_step(logger, agent="research_agent", step="execute_searches",
              tool="docs", ok=t.ok, duration_ms=t.duration_ms)

`Timer` is a plain wall-clock stopwatch: it works around any sync or
async call (wrap the `await`, not the coroutine object) and never
swallows the wrapped exception — `t.ok` just records whether one happened.
"""
import asyncio
import logging
import time
from typing import Any

# failures that say "the network or the model server is slow/unreachable",
# not "there is a bug here": logged as one line, without a traceback
_EXPECTED_ERROR_NAMES = {"ResponseError", "ConnectError", "ReadTimeout", "ConnectTimeout", "RemoteProtocolError"}


def describe_error(exc: BaseException) -> str:
    if isinstance(exc, (asyncio.TimeoutError, TimeoutError)) and not str(exc):
        return "timed out"
    if "RateLimit" in type(exc).__name__:
        return f"rate limited: {str(exc)[:300]}"
    return f"{type(exc).__name__}: {exc}" if str(exc) else type(exc).__name__


def log_failure(logger: logging.Logger, message: str, exc: BaseException | None) -> None:
    """Warn that a step failed and fell back. A timeout or connection
    error gets one line (the 80-line traceback through the HTTP stack says
    nothing more); anything else keeps its traceback."""
    if exc is None:
        logger.warning("%s", message)
        return
    expected = isinstance(exc, (asyncio.TimeoutError, TimeoutError, ConnectionError)) \
        or type(exc).__name__ in _EXPECTED_ERROR_NAMES or "RateLimit" in type(exc).__name__
    logger.warning("%s (%s)", message, describe_error(exc), exc_info=None if expected else exc)


class Timer:
    """Context manager: `.duration_ms` and `.ok` are set on exit."""

    def __enter__(self) -> "Timer":
        self._start = time.perf_counter()
        self.duration_ms: float = 0.0
        self.ok: bool = True
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        self.duration_ms = round((time.perf_counter() - self._start) * 1000, 1)
        self.ok = exc_type is None
        return False  # never suppress the exception


def log_step(logger: logging.Logger, *, ok: bool = True, **fields: Any) -> None:
    """One structured log line per step/tool call: `key=value` pairs, a
    consistent grep/parse target across every agent. Logs at WARNING when
    `ok=False` (or an `error` field is present) so failures stand out."""
    level = logging.INFO if ok and "error" not in fields else logging.WARNING
    rendered = " ".join(f"{key}={value!r}" for key, value in fields.items())
    logger.log(level, "%s", rendered)
