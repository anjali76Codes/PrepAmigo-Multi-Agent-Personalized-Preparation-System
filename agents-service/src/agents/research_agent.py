"""
Content Research Agent: turns one skill gap into a curated learning module.

Pipeline (each step emits running -> completed | failed events, see
graph/events.py; each completed/failed event carries duration_ms):

  fetch_user_context          long-term memory: what we already know about
                              this candidate, for personalisation
  identify_curation_scope     depth (foundational/intermediate/advanced/
                              revision) and how many of each resource type
                              to fetch
  execute_searches            docs, books, papers and videos in parallel,
                              then transcripts for the top videos in parallel
  synthesize_learning_module  LLM writes explanation, examples, exercises;
                              curated links come straight from tool results,
                              never from the LLM

Not wired to the user knowledge graph: depth comes from an explicit
depth_hint (parsed from the conversation by agents/research_node.py) or
defaults to foundational. The knowledge graph (graph/knowledge_graph.py)
is reserved for the skill-gap/assessment agents.

Two separate time budgets, not one shared clock: RESEARCH_TIMEOUT_SECONDS
(default 30s) bounds the research phase (fetch_user_context through
execute_searches) — the part tool parallelism and caching actually speed
up — and RESEARCH_SYNTHESIS_TIMEOUT_SECONDS (default 45s) separately
bounds the LLM call that writes the module, since that time is set by
model speed, not by how the tools are orchestrated. Charging both to one
clock would let a slow model eat the research phase's budget (or a slow
model's failure get blamed on "research"), so they're independent. Tool
calls run in parallel (asyncio.gather) and their raw responses are cached
(tools/cache.py) so repeated runs during development don't re-spend
SerpApi credits or wait on the network.

Not a BaseAgent subclass: this is a fixed workflow with one LLM call, not a
tool-calling chat loop. Use it three ways:
  - async for event in agent.astream(request)     (SSE endpoints)
  - result = await agent.run(request, on_event)   (callers wanting the result)
  - graph.add_node("research_agent", agent)       (LangGraph node over AgentState)
"""
import asyncio
import logging
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Awaitable, Callable

from langchain_core.messages import HumanMessage, SystemMessage

from config import get_llm, settings
from graph.events import AgentEvent, EventCallback, dispatch_event, emit_to_graph_stream, make_event
from memory.base import BaseMemoryProvider
from memory.store import get_memory_provider
from observability.timing import Timer, log_step
from prompts.research_prompts import DEPTH_GUIDANCE, RESEARCH_AGENT_PROMPT, RESEARCH_SYNTHESIS_TEMPLATE
from tools.research_tools import (
    MAX_QUERY_LENGTH,
    fetch_youtube_transcript,
    search_academic_papers,
    search_books,
    search_technical_docs,
    search_youtube_tutorials,
)

logger = logging.getLogger(__name__)

AGENT_NAME = "research_agent"
MAX_FIELD_LENGTH = 120
VALID_DEPTHS = ("foundational", "intermediate", "advanced", "revision")
DEFAULT_DEPTH = "foundational"

# resources fetched per curation depth. Papers are skipped for
# foundational/revision: a beginner or a candidate doing a revision pass
# is better served by tutorials than primary sources.
SCOPE_LIMITS = {
    "foundational": {"docs": 5, "books": 3, "papers": 0, "videos": 4, "transcripts": 1},
    "intermediate": {"docs": 5, "books": 2, "papers": 1, "videos": 3, "transcripts": 1},
    "advanced": {"docs": 5, "books": 2, "papers": 2, "videos": 3, "transcripts": 1},
    "revision": {"docs": 3, "books": 0, "papers": 0, "videos": 2, "transcripts": 0},
}

SEARCH_TOOLS = {
    "docs": search_technical_docs,
    "books": search_books,
    "papers": search_academic_papers,
    "videos": search_youtube_tutorials,
}


class ResearchAgentError(RuntimeError):
    """A pipeline step failed; its `failed` event has already been emitted."""


@dataclass(frozen=True)
class ResearchRequest:
    user_id: str
    target_role: str
    target_company: str
    topic_or_skill_gap: str
    # foundational/intermediate/advanced/revision, or None to default to
    # foundational (a topic reaching us as a gap is assumed to need the basics)
    depth_hint: str | None = None

    def __post_init__(self):
        for field in ("user_id", "target_role", "target_company", "topic_or_skill_gap"):
            value = getattr(self, field)
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"{field} must be a non-empty string")
            if len(value) > MAX_FIELD_LENGTH:
                raise ValueError(f"{field} must be at most {MAX_FIELD_LENGTH} characters")
            object.__setattr__(self, field, " ".join(value.split()))
        if self.depth_hint is not None:
            depth_hint = self.depth_hint.strip().lower()
            if depth_hint not in VALID_DEPTHS:
                raise ValueError(f"depth_hint must be one of {VALID_DEPTHS} or None")
            object.__setattr__(self, "depth_hint", depth_hint)


def classify_depth(depth_hint: str | None) -> str:
    return depth_hint if depth_hint in VALID_DEPTHS else DEFAULT_DEPTH


def _query(*parts: str) -> str:
    return " ".join(p for p in parts if p)[:MAX_QUERY_LENGTH].strip()


def build_queries(topic: str, role: str, company: str, depth: str) -> dict[str, str]:
    if depth == "foundational":
        return {
            "docs": _query(topic, "fundamentals official documentation"),
            "books": _query(topic, "fundamentals"),
            "videos": _query(topic, "explained for beginners"),
        }
    if depth == "intermediate":
        return {
            "docs": _query(topic, "best practices guide"),
            "books": _query(topic),
            "papers": _query(topic, "survey OR review paper"),
            "videos": _query(topic, "tutorial for", role),
        }
    if depth == "advanced":
        return {
            "docs": _query(topic, "internals deep dive"),
            "books": _query("advanced", topic),
            "papers": _query(topic, "paper"),
            "videos": _query(topic, company, "interview deep dive"),
        }
    return {
        "docs": _query(topic, "cheat sheet"),
        "books": _query(topic),
        "videos": _query(topic, company, "interview questions"),
    }


class ContentResearchAgent:
    name = AGENT_NAME

    def __init__(
        self,
        llm: Any | None = None,
        memory: BaseMemoryProvider | None = None,
        tools: dict[str, Any] | None = None,
    ):
        """All collaborators are injectable for tests. `tools` overrides
        entries of {"docs", "books", "papers", "videos", "transcript"};
        each needs an .invoke(dict) method like a LangChain tool."""
        self._llm = llm
        self.memory = memory or get_memory_provider()
        self.tools = {**SEARCH_TOOLS, "transcript": fetch_youtube_transcript, **(tools or {})}

    @property
    def llm(self):
        # built lazily so constructing the agent needs no running model
        if self._llm is None:
            self._llm = get_llm(temperature=0.3)
        return self._llm

    # ---- public entry points ---------------------------------------------

    async def astream(self, request: ResearchRequest) -> AsyncIterator[AgentEvent]:
        """Yield step events. The final learning module is the payload of
        the `synthesize_learning_module` completed event. Raises
        ResearchAgentError after yielding a `failed` event."""
        async for event in self._execute(request, {}):
            yield event

    async def run(
        self,
        request: ResearchRequest,
        on_event: EventCallback | None = None,
        memories: list[str] | None = None,
    ) -> dict[str, Any]:
        """Run to completion, forwarding events to `on_event`. Pass
        `memories` already recalled this turn to skip a second memory
        search."""
        ctx: dict[str, Any] = {}
        if memories is not None:
            ctx["prefetched_memories"] = [{"memory": m} for m in memories]
        events: list[AgentEvent] = []
        async for event in self._execute(request, ctx):
            events.append(event)
            await dispatch_event(event, on_event)
        return {"module": ctx["module"], "handoff": _handoff(ctx["module"]), "events": events}

    async def __call__(self, state: dict) -> dict:
        """LangGraph node: research every entry in state["skill_gaps"]. A
        failed gap is recorded in execution_events and does not stop the
        others."""
        context = state.get("task_context") or {}
        materials: list[dict[str, Any]] = []
        events: list[AgentEvent] = []
        handoffs: list[dict[str, Any]] = []

        for gap in state.get("skill_gaps") or []:
            try:
                request = ResearchRequest(
                    user_id=state.get("user_id", ""),
                    target_role=context.get("target_role", ""),
                    target_company=context.get("target_company", ""),
                    topic_or_skill_gap=gap,
                )
            except ValueError as exc:
                event = make_event(AGENT_NAME, "validate_request", "failed", {"topic": gap, "error": str(exc)})
                events.append(event)
                emit_to_graph_stream(event)
                continue
            try:
                result = await self.run(request, on_event=events.append)
            except ResearchAgentError:
                continue  # failure already recorded in events
            materials.append(result["module"])
            handoffs.append(result["handoff"])

        return {"researched_materials": materials, "execution_events": events, "handoffs": handoffs}

    # ---- pipeline --------------------------------------------------------

    async def _execute(self, request: ResearchRequest, ctx: dict[str, Any]) -> AsyncIterator[AgentEvent]:
        research_steps: list[tuple[str, Callable[[ResearchRequest, dict], Awaitable[dict]]]] = [
            ("fetch_user_context", self._fetch_user_context),
            ("identify_curation_scope", self._identify_curation_scope),
            ("execute_searches", self._execute_searches),
        ]
        topic = request.topic_or_skill_gap

        # research phase: memory recall, scoping, and the parallel tool
        # calls, all bounded by one shared clock (RESEARCH_TIMEOUT_SECONDS)
        deadline = time.monotonic() + settings.research_timeout_seconds
        for step, handler in research_steps:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                error = f"research phase exceeded its {settings.research_timeout_seconds:.0f}s budget"
                log_step(logger, ok=False, agent=AGENT_NAME, step=step, topic=topic, error=error)
                yield make_event(AGENT_NAME, step, "failed", {"topic": topic, "error": error})
                raise ResearchAgentError(f"{step} failed: {error}")
            async for event in self._run_step(step, handler, request, ctx, remaining):
                yield event

        # writing the module is bound by LLM generation speed, not tool-call
        # efficiency, so it gets its own budget instead of sharing the clock
        # above (RESEARCH_SYNTHESIS_TIMEOUT_SECONDS)
        async for event in self._run_step(
            "synthesize_learning_module", self._synthesize_learning_module, request, ctx,
            settings.research_synthesis_timeout_seconds,
        ):
            yield event

    async def _run_step(
        self,
        step: str,
        handler: Callable[[ResearchRequest, dict], Awaitable[dict]],
        request: ResearchRequest,
        ctx: dict[str, Any],
        timeout: float,
    ) -> AsyncIterator[AgentEvent]:
        topic = request.topic_or_skill_gap
        yield make_event(AGENT_NAME, step, "running", {"topic": topic})
        # measured inline, not via Timer's __exit__: the except branches need
        # the elapsed time *before* the `with` block exits, and Timer only
        # sets .duration_ms on exit (see observability/timing.py)
        start = time.perf_counter()
        try:
            payload = await asyncio.wait_for(handler(request, ctx), timeout=timeout)
        except asyncio.TimeoutError as exc:
            duration_ms = round((time.perf_counter() - start) * 1000, 1)
            error = f"{step} exceeded its {timeout:.1f}s budget"
            log_step(logger, ok=False, agent=AGENT_NAME, step=step, topic=topic,
                      duration_ms=duration_ms, error=error)
            yield make_event(AGENT_NAME, step, "failed",
                              {"topic": topic, "error": error, "duration_ms": duration_ms})
            raise ResearchAgentError(f"{step} failed: {error}") from exc
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start) * 1000, 1)
            logger.exception("Research step %s failed for topic %r", step, topic)
            yield make_event(AGENT_NAME, step, "failed",
                              {"topic": topic, "error": str(exc), "duration_ms": duration_ms})
            raise ResearchAgentError(f"{step} failed: {exc}") from exc
        duration_ms = round((time.perf_counter() - start) * 1000, 1)
        log_step(logger, agent=AGENT_NAME, step=step, topic=topic, duration_ms=duration_ms)
        yield make_event(AGENT_NAME, step, "completed", {"topic": topic, "duration_ms": duration_ms, **payload})

    async def _fetch_user_context(self, request: ResearchRequest, ctx: dict) -> dict:
        topic = request.topic_or_skill_gap
        payload: dict[str, Any] = {}
        if "prefetched_memories" in ctx:
            memories = ctx["prefetched_memories"]
            payload["memory_source"] = "prefetched"
        else:
            # memory is enrichment, not a hard dependency: degrade on failure
            try:
                memories = await self.memory.search(
                    f"{topic} {request.target_role} {request.target_company}", request.user_id, limit=5
                )
            except Exception as exc:
                logger.warning("Memory search failed; continuing without memories", exc_info=True)
                memories = []
                payload["memory_error"] = str(exc)

        ctx["memories"] = memories
        return {**payload, "memories_found": len(memories)}

    async def _identify_curation_scope(self, request: ResearchRequest, ctx: dict) -> dict:
        depth = classify_depth(request.depth_hint)
        ctx["depth"] = depth
        ctx["limits"] = SCOPE_LIMITS[depth]
        ctx["queries"] = build_queries(
            request.topic_or_skill_gap, request.target_role, request.target_company, depth
        )
        return {"depth": depth, "limits": ctx["limits"], "queries": ctx["queries"]}

    async def _execute_searches(self, request: ResearchRequest, ctx: dict) -> dict:
        kinds = [kind for kind in SEARCH_TOOLS if ctx["limits"].get(kind, 0) > 0]
        timings: dict[str, float] = {}

        async def call(kind: str) -> dict:
            with Timer() as t:
                result = await asyncio.to_thread(
                    self.tools[kind].invoke,
                    {("topic" if kind in ("books", "papers") else "query"): ctx["queries"][kind],
                     "limit": ctx["limits"][kind]},
                )
            timings[kind] = t.duration_ms
            return result

        outcomes = await asyncio.gather(*(call(kind) for kind in kinds), return_exceptions=True)

        materials: list[dict[str, Any]] = []
        seen_urls: set[str] = set()
        sources: dict[str, str] = {}
        errors: dict[str, str] = {}
        for kind, outcome in zip(kinds, outcomes):
            if isinstance(outcome, BaseException):
                logger.warning("Research tool %s failed: %s", kind, outcome)
                errors[kind] = str(outcome)
                continue
            sources[kind] = outcome.get("source", "unknown")
            for item in outcome.get("results", []):
                if item.get("url") and item["url"] not in seen_urls:
                    seen_urls.add(item["url"])
                    materials.append(item)
        if not sources:
            raise RuntimeError(f"All research sources failed: {errors}")

        transcripts, transcript_timings = await self._fetch_transcripts(materials, ctx["limits"]["transcripts"], errors)
        timings.update(transcript_timings)
        ctx.update(materials=materials, transcripts=transcripts, sources=sources)
        counts = {kind: sum(1 for m in materials if m.get("resource_type") == rtype)
                  for kind, rtype in (("docs", "documentation"), ("books", "book"),
                                      ("papers", "paper"), ("videos", "video"))}
        return {"counts": counts, "sources": sources, "transcripts": len(transcripts),
                "errors": errors, "tool_timings_ms": timings}

    async def _fetch_transcripts(
        self, materials: list[dict], limit: int, errors: dict[str, str]
    ) -> tuple[list[dict], dict[str, float]]:
        videos = [m for m in materials if m.get("video_id")][:limit]
        timings: dict[str, float] = {}

        async def call(video: dict) -> dict | None:
            with Timer() as t:
                try:
                    result = await asyncio.to_thread(self.tools["transcript"].invoke, {"video_id": video["video_id"]})
                except Exception as exc:
                    errors[f"transcript:{video['video_id']}"] = str(exc)
                    return None
            timings[f"transcript:{video['video_id']}"] = t.duration_ms
            return {**result, "title": video.get("title", ""), "url": video["url"]} if result.get("available") else None

        results = await asyncio.gather(*(call(video) for video in videos))
        return [r for r in results if r is not None], timings

    async def _synthesize_learning_module(self, request: ResearchRequest, ctx: dict) -> dict:
        prompt = RESEARCH_SYNTHESIS_TEMPLATE.format(
            topic=request.topic_or_skill_gap,
            target_role=request.target_role,
            target_company=request.target_company,
            depth=ctx["depth"],
            depth_guidance=DEPTH_GUIDANCE[ctx["depth"]],
            memories="\n".join(f"- {m['memory']}" for m in ctx["memories"]) or "- nothing yet",
            docs=_format_resources(ctx["materials"], "documentation"),
            books=_format_resources(ctx["materials"], "book"),
            papers=_format_resources(ctx["materials"], "paper"),
            videos=_format_resources(ctx["materials"], "video"),
            transcripts="\n\n".join(f"{t['title']} <{t['url']}>:\n{t['excerpt']}" for t in ctx["transcripts"])
            or "none",
        )
        response = await self.llm.ainvoke([SystemMessage(content=RESEARCH_AGENT_PROMPT), HumanMessage(content=prompt)])
        content = _message_text(response).strip()
        if not content:
            raise RuntimeError("LLM returned an empty learning module")

        module = {
            "id": f"module-{uuid.uuid4().hex[:12]}",
            "topic": request.topic_or_skill_gap,
            "target_role": request.target_role,
            "target_company": request.target_company,
            "depth": ctx["depth"],
            "content_markdown": content,
            "resources": ctx["materials"],
            "transcripts": [
                {k: t[k] for k in ("video_id", "title", "url", "truncated", "total_chars") if k in t}
                for t in ctx["transcripts"]
            ],
            "uses_mock_sources": any(source in {"mock", "dummy"} for source in ctx["sources"].values()),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
        ctx["module"] = module
        return {"module": module}


# prompt-only cap on a resource's snippet; the full snippet SerpApi
# returned is still kept in module["resources"] for the frontend/handoff
PROMPT_SNIPPET_CHARS = 220


def _truncate(text: str, limit: int) -> str:
    text = (text or "").strip()
    return text if len(text) <= limit else text[:limit].rstrip() + "..."


def _format_resources(materials: list[dict[str, Any]], resource_type: str) -> str:
    """One bullet per resource of `resource_type`, snippet capped for
    prompt size — grouped by type so the LLM doesn't have to re-classify
    what's already known, and its output sections map 1:1 onto this."""
    items = [m for m in materials if m.get("resource_type") == resource_type]
    if not items:
        return "none provided"
    return "\n".join(
        f"- {m.get('title')} <{m['url']}>: {_truncate(m.get('snippet', ''), PROMPT_SNIPPET_CHARS)}"
        for m in items
    )


def _handoff(module: dict[str, Any]) -> dict[str, Any]:
    """Compact, structured summary of this run for a downstream agent or
    orchestration step to consume — see graph/state.py:AgentHandoff. Keeps
    the full markdown out of state; that's only needed by the chat reply."""
    return {
        "agent": AGENT_NAME,
        "kind": "learning_module",
        "summary": (
            f"Researched {module['topic']} at {module['depth']} depth: "
            f"{len(module['resources'])} resources, {len(module['transcripts'])} transcripts."
        ),
        "data": {
            "module_id": module["id"],
            "topic": module["topic"],
            "depth": module["depth"],
            "resource_urls": [r["url"] for r in module["resources"]],
            "uses_mock_sources": module["uses_mock_sources"],
        },
    }


def _message_text(message: Any) -> str:
    content = getattr(message, "content", message)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            item.get("text", "") for item in content if isinstance(item, dict) and item.get("type") == "text"
        )
    return str(content)
