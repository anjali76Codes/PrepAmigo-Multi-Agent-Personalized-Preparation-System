"""
Per-run metrics: for each agent, its wall time and how much of it went to
LLM calls vs tool/API calls, token usage, peak prompt size, and what the
caches saved.

Recording is off unless a run is being collected, so agents pay nothing
for it in tests or in runs nobody reports on:

    with collect_metrics() as run:
        await graph.ainvoke(...)
    print("\n".join(format_report(run.summary())))

Attribution uses context variables, so nothing is threaded through call
signatures:
  - each orchestrator stage wraps its work in `agent_scope("research")`;
    asyncio tasks and asyncio.to_thread workers started inside it inherit
    the agent name
  - LLM calls are recorded by MetricsCallback (attached to every model in
    config.get_llm), tool/API calls by tools/cache.cached_fetch and
    `track_tool`

Overlap is counted once: "LLM time" is how long at least one model call
was in flight, not the sum of concurrent calls. The same goes for tool
time. Their sums would exceed the wall time whenever calls run in parallel.
"""
import asyncio
import contextvars
import logging
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Iterator
from uuid import UUID

from langchain_core.callbacks import AsyncCallbackHandler
from langchain_core.outputs import LLMResult

logger = logging.getLogger(__name__)

UNATTRIBUTED = "other"
ERROR_CHARS = 200


@dataclass
class Call:
    agent: str
    kind: str  # "llm" | "tool"
    name: str  # model name, or tool/API label such as "serpapi:youtube"
    start: float
    end: float
    ok: bool = True
    cache_hit: bool = False
    # on a cache hit: how long the original (cache-filling) call took
    saved_ms: float = 0.0
    input_tokens: int = 0
    output_tokens: int = 0
    error: str = ""  # why a failed call failed (first ERROR_CHARS characters)

    @property
    def ms(self) -> float:
        return (self.end - self.start) * 1000


class RunMetrics:
    def __init__(self) -> None:
        self.started = time.perf_counter()
        self.ended: float | None = None
        self.calls: list[Call] = []
        self.spans: dict[str, list[tuple[float, float]]] = {}
        self._lock = threading.Lock()  # tool calls record from worker threads

    def add_call(self, call: Call) -> None:
        with self._lock:
            self.calls.append(call)

    def add_span(self, agent: str, start: float, end: float) -> None:
        with self._lock:
            self.spans.setdefault(agent, []).append((start, end))

    def summary(self) -> dict[str, Any]:
        end = self.ended or time.perf_counter()
        agents = list(self.spans) + sorted({c.agent for c in self.calls} - set(self.spans))
        rows = {agent: self._agent_summary(agent) for agent in agents}
        llm = [c for c in self.calls if c.kind == "llm"]
        return {
            "wall_s": round(end - self.started, 2),
            "agents": rows,
            "totals": _totals(rows),
            "slowest": [
                {"agent": c.agent, "kind": c.kind, "name": c.name, "s": round(c.ms / 1000, 1),
                 **({"output_tokens": c.output_tokens} if c.kind == "llm" else {})}
                for c in sorted((c for c in self.calls if c.ok and not c.cache_hit),
                                key=lambda c: c.ms, reverse=True)[:3]
            ],
            "failures": self._failures(),
            "models": sorted({c.name for c in llm if c.name}),
        }

    def _failures(self) -> list[dict[str, Any]]:
        """Failed calls grouped by agent + call + error, so one outage
        reads as one line rather than one per call."""
        groups: dict[tuple[str, str, str, str], int] = {}
        for c in self.calls:
            if not c.ok:
                key = (c.agent, c.kind, c.name, c.error)
                groups[key] = groups.get(key, 0) + 1
        return [{"agent": a, "kind": k, "name": n, "error": e, "count": count}
                for (a, k, n, e), count in groups.items()]

    def _agent_summary(self, agent: str) -> dict[str, Any]:
        calls = [c for c in self.calls if c.agent == agent]
        llm = [c for c in calls if c.kind == "llm"]
        tools = [c for c in calls if c.kind == "tool"]
        intervals = lambda items: [(c.start, c.end) for c in items]  # noqa: E731
        spans = self.spans.get(agent) or intervals(calls)
        wall = _union(spans)
        llm_s, tool_s = _union(intervals(llm)), _union(intervals(tools))
        busy = _union(intervals(llm) + intervals(tools))
        live_llm = [c for c in llm if not c.cache_hit]
        return {
            "wall_s": round(wall, 2),
            "llm_s": round(llm_s, 2),
            "tool_s": round(tool_s, 2),
            "other_s": round(max(wall - busy, 0.0), 2),
            "llm_calls": len(llm),
            "llm_cache_hits": len(llm) - len(live_llm),
            "llm_failures": sum(1 for c in llm if not c.ok),
            "input_tokens": sum(c.input_tokens for c in live_llm),
            "output_tokens": sum(c.output_tokens for c in live_llm),
            "tokens_saved": sum(c.input_tokens + c.output_tokens for c in llm if c.cache_hit),
            "peak_context_tokens": max((c.input_tokens for c in llm), default=0),
            "avg_llm_call_s": round(sum(c.ms for c in live_llm) / 1000 / len(live_llm), 2) if live_llm else 0.0,
            "max_llm_call_s": round(max((c.ms for c in live_llm), default=0.0) / 1000, 2),
            "tool_calls": len(tools),
            "tool_cache_hits": sum(1 for c in tools if c.cache_hit),
            "tool_failures": sum(1 for c in tools if not c.ok),
            "max_tool_call_s": round(max((c.ms for c in tools if not c.cache_hit), default=0.0) / 1000, 2),
            "time_saved_s": round(sum(c.saved_ms for c in calls if c.cache_hit) / 1000, 2),
        }


def _union(intervals: list[tuple[float, float]]) -> float:
    """Total seconds covered by at least one interval."""
    total, current_start, current_end = 0.0, None, None
    for start, end in sorted(intervals):
        if current_end is None or start > current_end:
            if current_end is not None:
                total += current_end - current_start
            current_start, current_end = start, end
        else:
            current_end = max(current_end, end)
    if current_end is not None:
        total += current_end - current_start
    return total


def _totals(rows: dict[str, dict[str, Any]]) -> dict[str, Any]:
    keys = ("llm_calls", "llm_cache_hits", "input_tokens", "output_tokens", "tokens_saved",
            "tool_calls", "tool_cache_hits", "time_saved_s")
    totals = {key: round(sum(row[key] for row in rows.values()), 2) for key in keys}
    totals["peak_context_tokens"] = max((row["peak_context_tokens"] for row in rows.values()), default=0)
    return totals


_run: contextvars.ContextVar[RunMetrics | None] = contextvars.ContextVar("run_metrics", default=None)
_agent: contextvars.ContextVar[str] = contextvars.ContextVar("metrics_agent", default=UNATTRIBUTED)


@contextmanager
def collect_metrics() -> Iterator[RunMetrics]:
    run = RunMetrics()
    token = _run.set(run)
    try:
        yield run
    finally:
        run.ended = time.perf_counter()
        _run.reset(token)


def current_run() -> RunMetrics | None:
    return _run.get()


def current_agent() -> str:
    return _agent.get()


@contextmanager
def agent_scope(agent: str) -> Iterator[None]:
    """Attribute everything inside (including tasks and threads started in
    it) to `agent`, and record the agent's wall time."""
    token = _agent.set(agent)
    start = time.perf_counter()
    logger.info("stage=%s started", agent)
    try:
        yield
    finally:
        end = time.perf_counter()
        logger.info("stage=%s finished duration_s=%.1f", agent, end - start)
        run = _run.get()
        if run is not None:
            run.add_span(agent, start, end)
        _agent.reset(token)


def record_tool(name: str, start: float, end: float, *, ok: bool = True,
                cache_hit: bool = False, saved_ms: float = 0.0, error: str = "") -> None:
    run = _run.get()
    if run is not None:
        run.add_call(Call(_agent.get(), "tool", name, start, end, ok=ok, cache_hit=cache_hit,
                          saved_ms=saved_ms, error=error[:ERROR_CHARS]))


@contextmanager
def track_tool(name: str) -> Iterator[None]:
    """Record the wrapped block as one (uncached) tool/API call."""
    start = time.perf_counter()
    try:
        yield
    except BaseException as exc:
        record_tool(name, start, time.perf_counter(), ok=False, error=str(exc) or type(exc).__name__)
        raise
    record_tool(name, start, time.perf_counter())


class MetricsCallback(AsyncCallbackHandler):
    """Records every chat-model call (duration, tokens, cache hit) for the
    agent that made it. One shared instance serves all models; it records
    only while a run is being collected."""

    run_inline = True  # cheap bookkeeping; no need for a task per event

    def __init__(self) -> None:
        self._started: dict[UUID, tuple[RunMetrics, str, str, float]] = {}

    async def on_chat_model_start(self, serialized: dict[str, Any], messages: list, *, run_id: UUID,
                                  metadata: dict[str, Any] | None = None, **kwargs: Any) -> None:
        run = _run.get()
        if run is None:
            return
        model = str((metadata or {}).get("ls_model_name") or "")
        self._started[run_id] = (run, _agent.get(), model, time.perf_counter())
        # a caller's timeout cancels the call without any callback firing;
        # it would vanish from the table and its wait be reported as "Other"
        task = asyncio.current_task()
        if task is not None:
            task.add_done_callback(lambda _task: self._abandoned(run_id))

    def _abandoned(self, run_id: UUID) -> None:
        started = self._started.pop(run_id, None)
        if started is not None:
            run, agent, model, start = started
            run.add_call(Call(agent, "llm", model, start, time.perf_counter(), ok=False,
                              error="cancelled before it answered (caller's timeout)"))

    async def on_llm_end(self, response: LLMResult, *, run_id: UUID, **kwargs: Any) -> None:
        started = self._started.pop(run_id, None)
        if started is None:
            return
        run, agent, model, start = started
        generation = response.generations[0][0] if response.generations and response.generations[0] else None
        message = getattr(generation, "message", None)
        usage = getattr(message, "usage_metadata", None) or {}
        cache = ((getattr(generation, "generation_info", None) or {}).get("cache")) or {}
        run.add_call(Call(
            agent, "llm", model, start, time.perf_counter(),
            cache_hit=bool(cache.get("hit")), saved_ms=float(cache.get("latency_ms") or 0.0),
            input_tokens=int(usage.get("input_tokens") or 0), output_tokens=int(usage.get("output_tokens") or 0),
        ))

    async def on_llm_error(self, error: BaseException, *, run_id: UUID, **kwargs: Any) -> None:
        started = self._started.pop(run_id, None)
        if started is not None:
            run, agent, model, start = started
            run.add_call(Call(agent, "llm", model, start, time.perf_counter(), ok=False,
                              error=(str(error) or type(error).__name__)[:ERROR_CHARS]))


METRICS_CALLBACK = MetricsCallback()


def _s(value: float) -> str:
    return f"{value:.1f}s"


def format_report(summary: dict[str, Any]) -> list[str]:
    """The summary as plain-text table lines (no colours), for a terminal
    or a log file."""
    header = (f"{'Agent':<17}{'Wall':>8}{'LLM':>8}{'Tools':>8}{'Other':>8}  "
              f"{'LLM calls':>9}{'In tok':>9}{'Out tok':>9}{'Total':>9}{'Peak ctx':>9}  "
              f"{'API calls':>9}{'Slowest':>9}{'Saved':>8}")
    lines = [header, "─" * len(header)]
    for agent, row in summary["agents"].items():
        if not (row["llm_calls"] or row["tool_calls"]) and row["wall_s"] < 0.05:
            continue  # a stage that had nothing to do (e.g. no field extraction needed)
        llm_calls = f"{row['llm_calls']}" + (f" ({row['llm_cache_hits']}c)" if row["llm_cache_hits"] else "")
        api_calls = f"{row['tool_calls']}" + (f" ({row['tool_cache_hits']}c)" if row["tool_cache_hits"] else "")
        lines.append(
            f"{agent:<17}{_s(row['wall_s']):>8}{_s(row['llm_s']):>8}{_s(row['tool_s']):>8}{_s(row['other_s']):>8}  "
            f"{llm_calls:>9}{row['input_tokens']:>9,}{row['output_tokens']:>9,}"
            f"{row['input_tokens'] + row['output_tokens']:>9,}{row['peak_context_tokens']:>9,}  "
            f"{api_calls:>9}{_s(row['max_tool_call_s']):>9}{_s(row['time_saved_s']):>8}"
        )
    t = summary["totals"]
    llm_calls = f"{t['llm_calls']}" + (f" ({t['llm_cache_hits']}c)" if t["llm_cache_hits"] else "")
    api_calls = f"{t['tool_calls']}" + (f" ({t['tool_cache_hits']}c)" if t["tool_cache_hits"] else "")
    lines.append("─" * len(header))
    lines.append(
        f"{'TOTAL':<17}{_s(summary['wall_s']):>8}{'':>24}  "
        f"{llm_calls:>9}{t['input_tokens']:>9,}{t['output_tokens']:>9,}"
        f"{t['input_tokens'] + t['output_tokens']:>9,}{t['peak_context_tokens']:>9,}  "
        f"{api_calls:>9}{'':>9}{_s(t['time_saved_s']):>8}"
    )
    for failure in summary.get("failures", []):
        lines.append(f"FAILED {failure['count']}x {failure['agent']} {failure['kind']} {failure['name']}: "
                     f"{failure['error']}")
    if summary["slowest"]:
        lines.append("Slowest calls: " + " · ".join(
            f"{c['agent']} {c['kind']} {c['name']} {c['s']}s"
            + (f" ({c['output_tokens']:,} out tok)" if c.get("output_tokens") else "")
            for c in summary["slowest"]
        ))
    if t["tokens_saved"]:
        lines.append(f"Cache: {t['llm_cache_hits']} LLM + {t['tool_cache_hits']} API hits, "
                     f"{t['tokens_saved']:,} tokens and {t['time_saved_s']:.1f}s of original call time not spent")
    elif t["tool_cache_hits"]:
        lines.append(f"Cache: {t['tool_cache_hits']} API hits, {t['time_saved_s']:.1f}s of original call time not spent")
    lines.append("LLM/Tools: time with ≥1 call in flight (parallel calls counted once) · "
                 "Other: everything else · (Nc): N served from cache")
    return lines
