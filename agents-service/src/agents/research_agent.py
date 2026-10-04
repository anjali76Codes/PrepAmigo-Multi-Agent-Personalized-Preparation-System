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
import dataclasses
import difflib
import logging
import re
import time
import uuid
from urllib.parse import urlparse
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Awaitable, Callable

from langchain_core.messages import HumanMessage, SystemMessage

from agents.company_brief import company_focus
from core.config import get_llm, llm_concurrency, settings
from graph.events import (
    INTERNAL_LLM_CONFIG,
    AgentEvent,
    EventCallback,
    dispatch_event,
    emit_to_graph_stream,
    invoke_tool_with_events,
    make_event,
)
from memory.base import BaseMemoryProvider
from memory.store import get_memory_provider
from observability.metrics import track_tool
from observability.timing import log_failure, log_step
from storage.llm_cache import forget_response
from tools.plan_builder import parse_json_object
from tools.text_sanitize import sanitize_data, sanitize_text
from prompts.research_prompts import (
    DEPTH_GUIDANCE,
    RESEARCH_AGENT_PROMPT,
    RESEARCH_COMPACT_PROMPT,
    RESEARCH_COMPACT_TEMPLATE,
    RESEARCH_SYNTHESIS_TEMPLATE,
)
from tools.research_tools import (
    MAX_QUERY_LENGTH,
    fetch_youtube_transcript,
    search_academic_papers,
    search_books,
    search_technical_docs,
    search_youtube_tutorials,
)
from tools.relevance import canonical_url, not_learning_material, relevance, title_key, youtube_video_id

logger = logging.getLogger(__name__)

AGENT_NAME = "research_agent"
MAX_FIELD_LENGTH = 120
ROLE_FOCUS_LENGTH = 600
MAX_FOCUS_LENGTH = 900  # role focus (up to 600) + company focus (up to 300)
VALID_DEPTHS = ("foundational", "intermediate", "advanced", "revision")
DEFAULT_DEPTH = "foundational"

# resources fetched per curation depth. Books and papers come from free
# catalogues (Google Books, arXiv: tools/research_tools.py), so they cost no
# SerpApi credit; a revision pass skips both.
# each search asks for this many times its kind's limit (one API call
# either way), so dropping off-topic/duplicate results doesn't leave gaps
OVERFETCH_FACTOR = 2

SCOPE_LIMITS = {
    "foundational": {"docs": 5, "books": 2, "papers": 1, "videos": 4, "transcripts": 1},
    "intermediate": {"docs": 5, "books": 2, "papers": 1, "videos": 3, "transcripts": 1},
    "advanced": {"docs": 5, "books": 2, "papers": 2, "videos": 3, "transcripts": 1},
    "revision": {"docs": 3, "books": 0, "papers": 0, "videos": 2, "transcripts": 0},
}

# the company-platform module: official docs, code repositories, the
# company's own research and a couple of developer videos; no books
OFFICIAL_LIMITS = {"docs": 5, "repos": 3, "books": 0, "papers": 2, "videos": 2, "transcripts": 0}

SEARCH_TOOLS = {
    "docs": search_technical_docs,
    "repos": search_technical_docs,  # the same web search, with a site:github.com query
    "books": search_books,
    "papers": search_academic_papers,
    "videos": search_youtube_tutorials,
}


JUDGE_MAX_ITEMS = 18
JUDGE_SNIPPET_CHARS = 110
JUDGE_TIMEOUT_SECONDS = 15
JUDGE_PROMPT = """A candidate is studying "{topic}"{domain} to prepare for a {role} role.
Below are search results. Reject every result that is NOT material to study this topic from:
job adverts, company sales or service pages, product landing pages, news about deals or funding,
market reports, and anything about a different meaning of the words. Keep tutorials, guides,
documentation, courses, books, papers and explanatory talks about the topic.

{listing}

Return ONLY a JSON object, no prose: {{"reject": [numbers of the results to reject]}}"""


SCOPE_KINDS = ("docs", "videos", "books", "papers")
SCOPE_PROMPT = """A candidate is preparing for a {role} role. For each skill below, choose which kinds of study
resource are worth searching for. Pick a kind only when good material of that kind is likely to exist:
- docs: written guides, tutorials or official documentation
- videos: explanatory videos or talks
- books: established textbooks. Not for a new tool or product, and rarely for a soft skill
- papers: academic papers. Only for research-heavy technical subjects

{listing}

Return ONLY a JSON object, no prose, mapping each skill's number to its list of kinds:
{{"1": ["docs", "videos"], "2": ["docs", "videos", "books"]}}"""


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
    # what the role actually does, from current job postings (responsibilities,
    # related skills): steers Key Concepts toward hands-on, role-relevant parts
    # of the topic instead of its generic end-user surface. Optional.
    focus: str = ""
    # the skill's category from job intelligence (e.g. "AI tools", "Sales"):
    # a short search disambiguator for ambiguous topic names. Optional.
    domain: str = ""
    # set for the company-platform module (see company_module_request): the
    # exact search query per kind ("docs", "repos", "papers", "videos").
    # Those queries are already scoped to the company's own site and
    # GitHub, so results are not re-checked against the topic's wording.
    official_queries: dict[str, str] | None = None
    # the resource kinds worth searching for this topic, chosen before any
    # search (see ContentResearchAgent._select_kinds); None = every kind
    kinds: tuple[str, ...] | None = None
    # True for the interview-prep pipeline: a short note (overview, key
    # concepts, practice) instead of the full reference sheet with every
    # link re-listed, which only a chat reply needs
    compact: bool = False

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
        # context, not a key field: normalised and clipped rather than rejected
        object.__setattr__(self, "focus", " ".join(str(self.focus or "").split())[:MAX_FOCUS_LENGTH])
        object.__setattr__(self, "domain", " ".join(str(self.domain or "").split())[:MAX_FIELD_LENGTH])


def role_focus(job_intelligence: dict[str, Any] | None) -> str:
    """A short "what this role does" line from a job-intelligence profile
    (agents/job_intelligence_agent.py): the most common responsibilities
    and must-have skills seen in current postings for the role."""
    profile = job_intelligence or {}
    responsibilities = [str(r).strip() for r in profile.get("commonResponsibilities") or [] if str(r).strip()]
    skills = [
        str(s.get("name", "")).strip() for s in profile.get("skills") or []
        if isinstance(s, dict) and s.get("name")
    ]
    parts = []
    if responsibilities:
        parts.append("Responsibilities: " + "; ".join(responsibilities[:4]))
    if skills:
        parts.append("Skills employers list: " + ", ".join(skills[:10]))
    return ". ".join(parts)[:ROLE_FOCUS_LENGTH]


def prep_focus(job_intelligence: dict[str, Any] | None, company_profile: dict[str, Any] | None = None) -> str:
    """role_focus plus, when company research wrote a brief, the company's
    own stack and engineering focus (agents/company_brief.company_focus):
    the context line for the research and planner prompts."""
    return ". ".join(part for part in (role_focus(job_intelligence), company_focus(company_profile)) if part)


def company_module_request(
    company_profile: dict[str, Any] | None, user_id: str, role: str, company: str, focus: str = "",
) -> "ResearchRequest | None":
    """A research request for the target company's own platform: its
    official documentation, its code repositories, its research and a
    couple of developer videos. Everything is derived from the company
    profile (website, brief), nothing is specific to any company. None
    when the profile has neither a website nor a brief to go on."""
    profile = company_profile or {}
    brief = profile.get("brief") or {}
    name = str(profile.get("name") or company or "").strip()
    host = urlparse(str(profile.get("website") or "")).netloc or str(profile.get("website") or "")
    host = host.casefold().removeprefix("www.").strip("/ ")
    if not name or not (host or brief):
        return None
    product = next(iter(brief.get("products") or []), "")
    subject = next(iter(brief.get("tech_stack") or []), "") or product or name
    # "Uber" + "Uber Marketplace" is "Uber Marketplace", not "Uber Uber Marketplace"
    title = product if name.casefold() in product.casefold() else " ".join(part for part in (name, product) if part)
    docs = (f"site:{host} documentation OR docs OR API OR \"getting started\"" if host
            else f'"{name}" official developer documentation')
    return ResearchRequest(
        user_id=user_id, target_role=role, target_company=company or name,
        topic_or_skill_gap=_query(title, "platform")[:MAX_FIELD_LENGTH],
        focus=focus,
        compact=True,
        official_queries={
            "docs": _query(docs),
            "repos": _query("site:github.com", title, "SDK OR examples OR cookbook"),
            "papers": _query(subject),
            "videos": _query(title, "developer tutorial"),
        },
    )


def skill_domains(job_intelligence: dict[str, Any] | None) -> dict[str, str]:
    """{skill name (casefolded): its category} from a job-intelligence
    profile, so each researched gap can carry its category as a search hint."""
    domains = {}
    for skill in (job_intelligence or {}).get("skills") or []:
        if isinstance(skill, dict) and skill.get("name") and skill.get("category"):
            domains[str(skill["name"]).strip().casefold()] = str(skill["category"]).strip()
    return domains


def domain_for(topic: str, domains: dict[str, str]) -> str:
    """The category of the job skill `topic` names, allowing for a slightly
    reworded name ("REST API" for "REST APIs")."""
    key = topic.strip().casefold()
    if key in domains:
        return domains[key]
    close = difflib.get_close_matches(key, domains, n=1, cutoff=0.8)
    return domains[close[0]] if close else ""


def classify_depth(depth_hint: str | None) -> str:
    return depth_hint if depth_hint in VALID_DEPTHS else DEFAULT_DEPTH


# excluded from web (docs) queries: page kinds that rank for a skill's name
# without teaching it
NOT_LEARNING_TERMS = "-jobs -vacancy -careers -pricing"


def _query(*parts: str) -> str:
    return " ".join(p for p in parts if p)[:MAX_QUERY_LENGTH].strip()


def build_queries(topic: str, role: str, company: str, depth: str, domain: str = "") -> dict[str, str]:
    """Search queries per resource kind. Web queries (docs, books) put the
    topic in quotes so Google must match it — without that it dropped the
    topic words and matched on the rest ("Pre-Sales Engineering ... guide"
    returned a voting-assistance guide). `domain` (the skill's category from
    job intelligence, e.g. "AI tools") disambiguates names like "Claude".
    The role title is deliberately not appended: tested live, it took over
    the ranking and returned career articles about the role instead of the
    topic. Video queries carry the domain too: a bare "Pinecone explained
    for beginners" returned a pine-cone wreath tutorial, which no
    word-matching filter can reject (it does say "pinecone")."""
    phrase = f'"{topic.replace(chr(34), "")}"'
    if depth == "foundational":
        return {
            "docs": _query(phrase, domain, "guide OR tutorial", NOT_LEARNING_TERMS),
            "books": _query(topic, domain),
            "papers": _query(topic, domain),
            "videos": _query(topic, domain, "explained for beginners"),
        }
    if depth == "intermediate":
        return {
            "docs": _query(phrase, domain, "best practices", NOT_LEARNING_TERMS),
            "books": _query(topic, domain),
            "papers": _query(topic, "survey OR review paper"),
            "videos": _query(topic, domain, "tutorial for", role),
        }
    if depth == "advanced":
        return {
            "docs": _query(phrase, domain, "internals deep dive", NOT_LEARNING_TERMS),
            "books": _query("advanced", topic, domain),
            "papers": _query(topic, "paper"),
            "videos": _query(topic, domain, company, "interview deep dive"),
        }
    return {
        "docs": _query(phrase, domain, "cheat sheet", NOT_LEARNING_TERMS),
        "books": _query(topic, domain),
        "videos": _query(topic, domain, company, "interview questions"),
    }


class ContentResearchAgent:
    name = AGENT_NAME

    def __init__(
        self,
        llm: Any | None = None,
        memory: BaseMemoryProvider | None = None,
        tools: dict[str, Any] | None = None,
        judge_llm: Any | None = None,
        scope_llm: Any | None = None,
    ):
        """All collaborators are injectable for tests. `tools` overrides
        entries of {"docs", "books", "papers", "videos", "transcript"};
        each needs an .invoke(dict) method like a LangChain tool."""
        self._llm = llm
        self._judge_llm = judge_llm
        self._scope_llm = scope_llm
        self._compact_llm = None
        self.memory = memory or get_memory_provider()
        self.tools = {**SEARCH_TOOLS, "transcript": fetch_youtube_transcript, **(tools or {})}

    @property
    def llm(self):
        # built lazily so constructing the agent needs no running model
        if self._llm is None:
            # capped: an uncapped write-up once ran to 4,800 tokens (27s)
            self._llm = get_llm(temperature=0.3, max_tokens=settings.research_max_output_tokens or None,
                                model=getattr(settings, "research_model", "") or None)
        return self._llm

    @property
    def compact_llm(self):
        """The model for compact write-ups: the injected one in tests, else
        the research model with the smaller output cap (three short
        sections, ~350 tokens)."""
        if self._llm is not None:
            return self._llm
        if self._compact_llm is None:
            self._compact_llm = get_llm(
                temperature=0.3, max_tokens=getattr(settings, "research_compact_max_output_tokens", 0) or None,
                model=getattr(settings, "research_model", "") or None)
        return self._compact_llm

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
        """LangGraph node: research every entry in state["skill_gaps"]
        concurrently (see research_many). A failed gap is recorded in
        execution_events and does not stop the others."""
        context = state.get("task_context") or {}
        events: list[AgentEvent] = []
        requests: list[ResearchRequest] = []
        focus = prep_focus(context.get("job_intelligence"), context.get("company_profile"))
        # a skill the candidate partly has is researched past the basics
        # (skill-gap status "partial" -> intermediate depth); a missing one
        # from first principles
        partial = {
            str(g.get("skill", "")).strip().casefold()
            for g in (context.get("skill_gap") or {}).get("priority_gaps") or [] if g.get("status") == "partial"
        }
        domains = skill_domains(context.get("job_intelligence"))

        for gap in state.get("skill_gaps") or []:
            try:
                requests.append(ResearchRequest(
                    user_id=state.get("user_id", ""),
                    target_role=context.get("target_role", ""),
                    target_company=context.get("target_company", ""),
                    topic_or_skill_gap=gap,
                    focus=focus,
                    domain=domain_for(str(gap), domains),
                    depth_hint="intermediate" if str(gap).strip().casefold() in partial else None,
                    compact=True,
                ))
            except ValueError as exc:
                event = make_event(AGENT_NAME, "validate_request", "failed", {"topic": gap, "error": str(exc)})
                events.append(event)
                emit_to_graph_stream(event)

        if not requests:
            return {"researched_materials": [], "execution_events": events, "handoffs": []}

        requests = await self._select_kinds(requests)

        async def forward_event(event: AgentEvent) -> None:
            events.append(event)
            await dispatch_event(event, None)

        results = await self.research_many(
            requests,
            on_event=forward_event,
            memories=await self._recall_once(state, requests),
        )

        return {
            "researched_materials": [r["module"] for r in results if r],
            "execution_events": events,
            "handoffs": [r["handoff"] for r in results if r],
        }

    async def _select_kinds(self, requests: list[ResearchRequest]) -> list[ResearchRequest]:
        """Decide, in one small model call for the whole batch and before
        any search runs, which kinds of resource are worth searching for
        each topic (RESEARCH_SCOPE_LLM; off = every kind). Searching all
        four for everything and dropping the misses afterwards cost the
        search time and credits: a soft skill has no papers, a brand-new
        tool has no books. Every topic keeps docs or videos at least; any
        failure leaves the requests unchanged."""
        scope = getattr(settings, "research_scope_llm", "off")
        if scope == "off" or not requests:
            return requests
        listing = "\n".join(
            f"{i}. {r.topic_or_skill_gap}" + (f" ({r.domain})" if r.domain else "")
            for i, r in enumerate(requests, start=1)
        )
        prompt = SCOPE_PROMPT.format(role=requests[0].target_role, listing=listing)
        response = None
        try:
            if self._scope_llm is None:
                self._scope_llm = get_llm(temperature=0, max_tokens=40 + 30 * len(requests), profile=scope)
            response = await asyncio.wait_for(
                self._scope_llm.ainvoke(prompt, config=INTERNAL_LLM_CONFIG), timeout=JUDGE_TIMEOUT_SECONDS)
            text = re.sub(r"<think>.*?</think>", "", _message_text(response), flags=re.S)
            chosen = parse_json_object(text)
        except Exception as exc:
            forget_response(response)
            log_failure(logger, "Research scope selection unavailable; searching every resource kind", exc)
            return requests
        scoped = []
        for i, request in enumerate(requests, start=1):
            picked = chosen.get(str(i))
            kinds = tuple(k for k in SCOPE_KINDS if isinstance(picked, list) and k in picked)
            if not isinstance(picked, list):
                scoped.append(request)  # the model skipped this topic: search everything
                continue
            if "docs" not in kinds and "videos" not in kinds:
                kinds = ("docs", "videos") + kinds  # never research a topic with nothing to read or watch
            scoped.append(dataclasses.replace(request, kinds=kinds))
        logger.info("Research scope: %s", {r.topic_or_skill_gap: list(r.kinds) if r.kinds else "all" for r in scoped})
        return scoped

    async def _recall_once(self, state: dict, requests: list[ResearchRequest]) -> list[str]:
        """What we know about the candidate, recalled once for every gap of
        this run instead of once per gap (six identical-user lookups became
        one): the turn's already-loaded memory_context when the graph has
        one, else a single search on the role and company."""
        if state.get("memory_context") is not None:
            return [str(m) for m in state["memory_context"]]
        first = requests[0]
        try:
            with track_tool("memory:search"):
                found = await self.memory.search(
                    f"{first.target_role} {first.target_company} preparation", first.user_id, limit=5)
        except Exception:
            logger.warning("Memory search failed; continuing without memories", exc_info=True)
            return []
        return [str(m.get("memory", "")) for m in found if m.get("memory")]

    # ---- pipeline --------------------------------------------------------

    async def _execute(self, request: ResearchRequest, ctx: dict[str, Any]) -> AsyncIterator[AgentEvent]:
        async for event in self._research_phase(request, ctx):
            yield event
        async for event in self._synthesis_phase(request, ctx):
            yield event

    async def _research_phase(self, request: ResearchRequest, ctx: dict[str, Any]) -> AsyncIterator[AgentEvent]:
        """Memory recall, scoping, and the parallel tool calls — bounded by
        one shared clock (RESEARCH_TIMEOUT_SECONDS). No LLM call in here, so
        it's always safe to run several of these concurrently (see
        research_many below) regardless of LLM backend."""
        research_steps: list[tuple[str, Callable[[ResearchRequest, dict], Awaitable[dict]]]] = [
            ("fetch_user_context", self._fetch_user_context),
            ("identify_curation_scope", self._identify_curation_scope),
            ("execute_searches", self._await_searches),
        ]
        topic = request.topic_or_skill_gap

        # the searches don't depend on the memory recall (a ~1s network
        # call), so they start first and the recall runs while they're in
        # flight; the steps and their events still report in the usual order
        await self._identify_curation_scope(request, ctx)
        searches = asyncio.create_task(self._execute_searches(request, ctx))
        ctx["search_task"] = searches
        deadline = time.monotonic() + settings.research_timeout_seconds
        try:
            for step, handler in research_steps:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    error = f"research phase exceeded its {settings.research_timeout_seconds:.0f}s budget"
                    log_step(logger, ok=False, agent=AGENT_NAME, step=step, topic=topic, error=error)
                    yield make_event(AGENT_NAME, step, "failed", {"topic": topic, "error": error})
                    raise ResearchAgentError(f"{step} failed: {error}")
                async for event in self._run_step(step, handler, request, ctx, remaining):
                    yield event
        finally:
            ctx.pop("search_task", None)
            if not searches.done():
                searches.cancel()
            elif not searches.cancelled():
                searches.exception()  # already reported by its step; don't warn again at exit

    async def _synthesis_phase(self, request: ResearchRequest, ctx: dict[str, Any]) -> AsyncIterator[AgentEvent]:
        """Writing the module is bound by LLM generation speed, not tool-call
        efficiency, so it gets its own budget instead of sharing the research
        phase's clock (RESEARCH_SYNTHESIS_TIMEOUT_SECONDS)."""
        async for event in self._run_step(
            "synthesize_learning_module", self._synthesize_learning_module, request, ctx,
            settings.research_synthesis_timeout_seconds,
        ):
            yield event

    async def research_many(
        self,
        requests: list[ResearchRequest],
        on_event: EventCallback | None = None,
        memories: list[str] | None = None,
    ) -> list[dict[str, Any] | None]:
        """Research several skill gaps as independent pipelines. Every
        request's research phase (memory recall + parallel SerpApi calls —
        network-bound, no LLM involved) starts at once, and each request
        goes on to its write-up as soon as its own searches finish — there
        is no barrier waiting for the slowest search of all requests (one
        24s SerpApi call used to hold every write-up back). Write-ups take
        an LLM slot first (config.llm_concurrency: 1 on Ollama, which
        serves one generation at a time), so a queued write-up's timeout
        doesn't run while it waits. One request's failure doesn't stop the
        others; returns one outcome per request in request order, None
        where that request failed."""
        contexts: list[dict[str, Any]] = [
            {"prefetched_memories": [{"memory": m} for m in memories]} if memories is not None else {}
            for _ in requests
        ]

        async def drain(agen: AsyncIterator[AgentEvent]) -> None:
            async for event in agen:
                await dispatch_event(event, on_event)

        # write-ups wait for a slot before their step (and its timeout) starts,
        # so queued ones never time out while waiting their turn
        semaphore = asyncio.Semaphore(llm_concurrency(settings))

        async def run_one(index: int) -> dict[str, Any] | None:
            try:
                await drain(self._research_phase(requests[index], contexts[index]))
                async with semaphore:
                    await drain(self._synthesis_phase(requests[index], contexts[index]))
            except ResearchAgentError:
                return None
            module = contexts[index]["module"]
            return {"module": module, "handoff": _handoff(module)}

        return list(await asyncio.gather(*(run_one(i) for i in range(len(requests)))))

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
        # per-tool timings and LLM token usage, when the step has them, so a
        # slow step can be traced to one API call or to long model output
        extra = {key: payload[key] for key in ("tool_timings_ms", "usage") if payload.get(key)}
        log_step(logger, agent=AGENT_NAME, step=step, topic=topic, duration_ms=duration_ms, **extra)
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
                with track_tool("memory:search"):
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
        # RESEARCH_KINDS: kinds switched off for every topic
        enabled = getattr(settings, "enabled_research_kinds", lambda: tuple(SEARCH_TOOLS))()

        def allowed(kind: str) -> bool:
            # the compact note takes nothing from a transcript worth its
            # fetch: the first minute of a video is its intro, and two
            # fetches that hung cost 20s each in one run
            if kind == "transcripts" and request.compact:
                return False
            return ("videos" if kind == "transcripts" else kind) in enabled

        if request.official_queries:
            ctx["queries"] = dict(request.official_queries)
            ctx["limits"] = {kind: (limit if (kind in ctx["queries"] or kind == "transcripts") and allowed(kind) else 0)
                             for kind, limit in OFFICIAL_LIMITS.items()}
        else:
            wanted = request.kinds
            ctx["limits"] = {
                kind: (limit if allowed(kind) and (wanted is None or ("videos" if kind == "transcripts" else kind) in wanted) else 0)
                for kind, limit in SCOPE_LIMITS[depth].items()
            }
            ctx["queries"] = build_queries(
                request.topic_or_skill_gap, request.target_role, request.target_company, depth, request.domain
            )
        return {"depth": depth, "limits": ctx["limits"], "queries": ctx["queries"]}

    async def _await_searches(self, request: ResearchRequest, ctx: dict) -> dict:
        """The execute_searches step: the searches were started at the
        beginning of the research phase (see _research_phase)."""
        return await ctx["search_task"]

    async def _execute_searches(self, request: ResearchRequest, ctx: dict) -> dict:
        kinds = [kind for kind in SEARCH_TOOLS if ctx["limits"].get(kind, 0) > 0]
        timings: dict[str, float] = {}

        async def call(kind: str) -> dict:
            query = ctx["queries"][kind]
            limit = ctx["limits"][kind] * OVERFETCH_FACTOR
            tool_input = {
                ("topic" if kind in ("books", "papers") else "query"): query,
                "limit": limit,
            }
            result, metadata = await invoke_tool_with_events(
                self.tools[kind],
                tool_input,
                agent=AGENT_NAME,
                timeout=settings.research_tool_timeout_seconds,
                fallback_name=kind,
            )
            timings[kind] = metadata["duration_ms"]
            return result

        outcomes = await asyncio.gather(*(call(kind) for kind in kinds), return_exceptions=True)

        topic = request.topic_or_skill_gap
        candidates: list[dict[str, Any]] = []
        seen_urls: set[str] = set()
        seen_titles: set[str] = set()
        sources: dict[str, str] = {}
        errors: dict[str, str] = {}
        filtered: dict[str, int] = {}
        for kind, outcome in zip(kinds, outcomes):
            if isinstance(outcome, BaseException):
                logger.warning("Research tool %s failed: %s", kind, outcome or type(outcome).__name__)
                errors[kind] = str(outcome) or type(outcome).__name__
                continue
            sources[kind] = outcome.get("source", "unknown")
            # mock/fixture results aren't real search output; filtering them
            # would only empty offline development runs
            live = sources[kind] not in {"mock", "dummy"}
            for item in outcome.get("results", []):
                url = item.get("url")
                if not url:
                    continue
                url_key, name_key = canonical_url(url), title_key(item.get("title", ""))
                if url_key in seen_urls or (name_key and name_key in seen_titles):
                    continue  # same resource under another URL, or found by another search
                # titles/snippets as scraped carry emoji, invisible characters
                # and typographic punctuation; URLs are left exactly as found
                item = sanitize_data(item)
                title, snippet = item.get("title", ""), item.get("snippet", "")
                # a paper must be about the whole topic: half of a two-word
                # topic matches a paper from any field ("solutions")
                needed = 1.0 if kind == "papers" else settings.research_min_relevance
                off_topic = (not request.official_queries and settings.research_min_relevance > 0
                             and relevance(topic, title, snippet) < needed)
                # a job advert or sales page for the skill is on-topic by
                # every word and still nothing to study from
                if live and (off_topic or not_learning_material(url, title, snippet)):
                    filtered[kind] = filtered.get(kind, 0) + 1
                    continue
                video_id = youtube_video_id(url)
                if video_id and item.get("resource_type") != "video":
                    # a web search that returned a YouTube page found a video
                    item = {**item, "resource_type": "video", "video_id": video_id}
                seen_urls.add(url_key)
                if name_key:
                    seen_titles.add(name_key)
                candidates.append({**item, "_kind": kind, "_live": live})
        if not sources:
            raise RuntimeError(f"All research sources failed: {errors}")

        rejected = await self._judge(request, [c for c in candidates if c["_live"]])
        materials: list[dict[str, Any]] = []
        kept: dict[str, int] = {}
        for item in candidates:
            kind = item.pop("_kind")
            item.pop("_live")
            if id(item) in rejected:
                filtered[kind] = filtered.get(kind, 0) + 1
            elif kept.get(kind, 0) < ctx["limits"][kind]:
                kept[kind] = kept.get(kind, 0) + 1
                materials.append(item)
        if filtered:
            logger.info("Research %r: dropped off-topic or non-learning results %s", topic, filtered)

        transcripts, transcript_timings = await self._fetch_transcripts(materials, ctx["limits"]["transcripts"], errors)
        timings.update(transcript_timings)
        ctx.update(materials=materials, transcripts=transcripts, sources=sources)
        counts = {kind: sum(1 for m in materials if m.get("resource_type") == rtype)
                  for kind, rtype in (("docs", "documentation"), ("books", "book"),
                                      ("papers", "paper"), ("videos", "video"))}
        return {"counts": counts, "sources": sources, "transcripts": len(transcripts),
                "errors": errors, "filtered_off_topic": filtered, "tool_timings_ms": timings}

    async def _judge(self, request: ResearchRequest, candidates: list[dict[str, Any]]) -> set[int]:
        """ids of the candidates a model says are not study material for this
        topic and role (RESEARCH_JUDGE_LLM; off by default). Any failure —
        timeout, rate limit, unusable answer — rejects nothing: the
        word-level filters above still applied."""
        judge = getattr(settings, "research_judge_llm", "off")
        if judge == "off" or not candidates:
            return set()
        candidates = candidates[:JUDGE_MAX_ITEMS]
        listing = "\n".join(
            f"{i}. [{c['_kind']}] {_truncate(c.get('title', ''), 90)} — {_truncate(c.get('snippet', ''), JUDGE_SNIPPET_CHARS)}"
            for i, c in enumerate(candidates, start=1)
        )
        prompt = JUDGE_PROMPT.format(
            topic=request.topic_or_skill_gap, domain=f" ({request.domain})" if request.domain else "",
            role=request.target_role, listing=listing,
        )
        response = None
        try:
            if self._judge_llm is None:
                self._judge_llm = get_llm(temperature=0, max_tokens=120, profile=judge)
            response = await asyncio.wait_for(
                self._judge_llm.ainvoke(prompt, config=INTERNAL_LLM_CONFIG), timeout=JUDGE_TIMEOUT_SECONDS)
            text = re.sub(r"<think>.*?</think>", "", _message_text(response), flags=re.S)
            numbers = parse_json_object(text).get("reject")
            if not isinstance(numbers, list):
                raise ValueError("no reject list")
        except Exception as exc:
            forget_response(response)
            log_failure(logger, f"Research result check for {request.topic_or_skill_gap!r} unavailable; keeping all", exc)
            return set()
        rejected = {id(candidates[n - 1]) for n in numbers if isinstance(n, int) and 1 <= n <= len(candidates)}
        # a judge that rejects everything is more likely confused than right
        return set() if len(rejected) == len(candidates) else rejected

    async def _fetch_transcripts(
        self, materials: list[dict], limit: int, errors: dict[str, str]
    ) -> tuple[list[dict], dict[str, float]]:
        videos = [m for m in materials if m.get("video_id")][:limit]
        timings: dict[str, float] = {}

        async def call(video: dict) -> dict | None:
            tool = self.tools["transcript"]
            try:
                result, metadata = await invoke_tool_with_events(
                    tool,
                    {"video_id": video["video_id"]},
                    agent=AGENT_NAME,
                    timeout=settings.research_tool_timeout_seconds,
                )
            except Exception as exc:
                errors[f"transcript:{video['video_id']}"] = str(exc)
                return None
            timings[f"transcript:{video['video_id']}"] = metadata["duration_ms"]
            return {**result, "title": video.get("title", ""), "url": video["url"]} if result.get("available") else None

        results = await asyncio.gather(*(call(video) for video in videos))
        return [r for r in results if r is not None], timings

    async def _synthesize_learning_module(self, request: ResearchRequest, ctx: dict) -> dict:
        if request.compact:
            return await self._write_module(request, ctx, self.compact_llm, RESEARCH_COMPACT_PROMPT,
                                            RESEARCH_COMPACT_TEMPLATE.format(
                topic=request.topic_or_skill_gap,
                target_role=request.target_role,
                target_company=request.target_company,
                depth=ctx["depth"],
                depth_guidance=DEPTH_GUIDANCE[ctx["depth"]],
                focus=request.focus or "not available",
                memories="\n".join(f"- {m['memory']}" for m in ctx["memories"]) or "- nothing yet",
                # titles and a short snippet only: enough to ground the
                # concepts, a third of the full listing's tokens
                resources="\n".join(
                    f"- {_truncate(m.get('title', ''), 90)}: {_truncate(m.get('snippet', ''), COMPACT_SNIPPET_CHARS)}"
                    for m in ctx["materials"]) or "none",
            ))
        prompt = RESEARCH_SYNTHESIS_TEMPLATE.format(
            topic=request.topic_or_skill_gap,
            target_role=request.target_role,
            target_company=request.target_company,
            depth=ctx["depth"],
            depth_guidance=DEPTH_GUIDANCE[ctx["depth"]],
            focus=request.focus or "not available",
            memories="\n".join(f"- {m['memory']}" for m in ctx["memories"]) or "- nothing yet",
            docs=_format_resources(ctx["materials"], "documentation"),
            books=_format_resources(ctx["materials"], "book"),
            papers=_format_resources(ctx["materials"], "paper"),
            videos=_format_resources(ctx["materials"], "video"),
            transcripts="\n\n".join(f"[{t['title']}]({t['url']}):\n{t['excerpt']}" for t in ctx["transcripts"])
            or "none",
        )
        return await self._write_module(request, ctx, self.llm, RESEARCH_AGENT_PROMPT, prompt)

    async def _write_module(self, request: ResearchRequest, ctx: dict, llm: Any, system_prompt: str, prompt: str) -> dict:
        # compact notes arrive as JSON and are laid out as Markdown here, so
        # the sections and their order never depend on the model
        to_markdown = note_markdown if request.compact else module_markdown
        retry_instruction = (
            "Return the JSON object itself now, with no planning or commentary. Your answer must start with {"
            if request.compact else
            "Output the module itself now, with no planning or commentary. "
            "The first line of your answer must be exactly: ## Overview")
        messages = [SystemMessage(content=system_prompt), HumanMessage(content=prompt)]
        response = await llm.ainvoke(messages)
        content = sanitize_text(to_markdown(_message_text(response)))
        if not content:
            # the model wrote its planning notes instead of the module (seen
            # live: "We need to produce a reference sheet with sections...").
            # One retry with the opening spelled out; never store the notes.
            forget_response(response)
            logger.warning("Research %r: the write-up was not a usable module; retrying once",
                           request.topic_or_skill_gap)
            messages.append(HumanMessage(content=retry_instruction))
            response = await llm.ainvoke(messages)
            content = sanitize_text(to_markdown(_message_text(response)))
            if not content:
                forget_response(response)
                raise RuntimeError("LLM did not return a learning module (no usable overview and concepts)")
        content, invented_links = normalize_links(
            content, [m["url"] for m in ctx["materials"]] + [t["url"] for t in ctx["transcripts"]]
        )
        if invented_links:
            logger.info("Research %r: unlinked %d URL(s) the model cited but search never returned",
                        request.topic_or_skill_gap, invented_links)

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
        usage = getattr(response, "usage_metadata", None)
        return {"module": module, **({"usage": dict(usage)} if usage else {})}


_OVERVIEW_HEADING = re.compile(r"^##\s+Overview\s*$", re.M | re.I)


def module_markdown(text: str) -> str:
    """The module part of a model reply: everything from its "## Overview"
    heading on, with any reasoning before it dropped. "" when the reply has
    no such heading, i.e. it is not a module at all."""
    text = re.sub(r"<think>.*?</think>", "", text or "", flags=re.S)
    match = _OVERVIEW_HEADING.search(text)
    return text[match.start():].strip() if match else ""


NOTE_MIN_CONCEPTS, NOTE_MAX_CONCEPTS, NOTE_MAX_PRACTICE = 3, 8, 5


def note_markdown(text: str) -> str:
    """A compact note's Markdown, laid out here from the model's JSON
    ({"overview", "key_concepts": [{"name", "definition"}], "practice"}):
    always the same three sections in the same order, whatever the model
    does with formatting. A model that answered in Markdown anyway is
    accepted through module_markdown. "" when neither yields an overview
    and at least NOTE_MIN_CONCEPTS concepts."""
    cleaned = re.sub(r"<think>.*?</think>", "", text or "", flags=re.S)
    try:
        data = parse_json_object(cleaned)
    except ValueError:
        return module_markdown(cleaned)

    def line(value: Any, limit: int) -> str:
        return _truncate(" ".join(str(value or "").split()), limit)

    overview = line(data.get("overview"), 400)
    concepts = []
    for item in data.get("key_concepts") if isinstance(data.get("key_concepts"), list) else []:
        if isinstance(item, dict):
            name, definition = line(item.get("name"), 80).strip("*: "), line(item.get("definition"), 240)
        else:  # "Name: definition" as a plain string
            name, _, definition = line(item, 320).partition(":")
            name, definition = name.strip("*: "), definition.strip()
        if name:
            concepts.append(f"- **{name}**: {definition}" if definition else f"- **{name}**")
    if not overview or len(concepts) < NOTE_MIN_CONCEPTS:
        return ""
    practice = [f"- {line(item, 240)}" for item in data.get("practice") or [] if isinstance(item, str) and item.strip()]
    sections = [f"## Overview\n{overview}", "## Key Concepts\n" + "\n".join(concepts[:NOTE_MAX_CONCEPTS])]
    if practice:
        sections.append("## Practice\n" + "\n".join(practice[:NOTE_MAX_PRACTICE]))
    return "\n\n".join(sections)


# prompt-only cap on a resource's snippet; the full snippet SerpApi
# returned is still kept in module["resources"] for the frontend/handoff
PROMPT_SNIPPET_CHARS = 220
COMPACT_SNIPPET_CHARS = 100


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
    # shown as Markdown links so the model copies that exact form; a
    # "title <url>" listing here was copied back as "[title <url>]" links
    return "\n".join(
        f"- [{m.get('title')}]({m['url']}): {_truncate(m.get('snippet', ''), PROMPT_SNIPPET_CHARS)}"
        for m in items
    )


# a link's display text may itself contain one level of [brackets]
_LINK_TEXT = r"((?:[^\[\]]|\[[^\[\]]*\])+?)"
# the closing ">" is optional: the model has also written "[title <url]"
_ANGLED_IN_BRACKETS = re.compile(r"\[" + _LINK_TEXT + r"\s*<\s*(https?://[^>\s\]]+)\s*>?\s*\]")
_MD_LINK = re.compile(r"\[" + _LINK_TEXT + r"\]\((https?://[^)\s]+)\)")
_AUTOLINK = re.compile(r"\s*<(https?://[^>\s]+)>")


def normalize_links(markdown: str, allowed_urls: list[str]) -> tuple[str, int]:
    """Enforce the grounding rule on the model's output instead of trusting
    it: repair "[title <url>]" into "[title](url)", then unlink any URL
    that wasn't among the retrieved resources (keeping its text). Returns
    the fixed markdown and how many invented links were removed."""
    allowed = {canonical_url(u) for u in allowed_urls}
    removed = 0
    markdown = _ANGLED_IN_BRACKETS.sub(lambda m: f"[{m.group(1).strip()}]({m.group(2)})", markdown)

    def check_link(match: re.Match) -> str:
        nonlocal removed
        if canonical_url(match.group(2)) in allowed:
            return match.group(0)
        removed += 1
        return match.group(1)

    def check_autolink(match: re.Match) -> str:
        nonlocal removed
        if canonical_url(match.group(1)) in allowed:
            return match.group(0)
        removed += 1
        return ""

    markdown = _MD_LINK.sub(check_link, markdown)
    markdown = _AUTOLINK.sub(check_autolink, markdown)
    return markdown, removed


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
