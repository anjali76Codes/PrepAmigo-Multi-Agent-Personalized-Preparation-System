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
import logging
import time
from typing import Any


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
