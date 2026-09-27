"""Research interview rounds and candidate-reported patterns for a role."""
import asyncio
import logging
import re
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, AsyncIterator
from urllib.parse import urlparse

from langchain_core.messages import HumanMessage, SystemMessage

from config import get_llm, settings
from graph.events import AgentEvent, EventCallback, dispatch_event, make_event
from observability.timing import Timer, log_step
from prompts.interview_intelligence_prompts import INTERVIEW_INTELLIGENCE_PROMPT
from tools.research_tools import (
    MAX_QUERY_LENGTH,
    TRANSCRIPT_EXCERPT_CHARS,
    fetch_youtube_transcript,
    search_google_ai_overview,
    search_google_interview_sources,
    search_google_news,
    search_google_related_questions,
    search_youtube_tutorials,
)

logger = logging.getLogger(__name__)

AGENT_NAME = "interview_intelligence"
MAX_FIELD_LENGTH = 120
MAX_RESULTS_PER_SOURCE = 5
PROMPT_SNIPPET_CHARS = 400
TRANSCRIPT_LIMIT = 3
SEARCH_TOOLS = {
    "search": search_google_interview_sources,
    "questions": search_google_related_questions,
    "videos": search_youtube_tutorials,
    "news": search_google_news,
}
SOURCE_PREFIXES = {"search": "S", "ai_overview": "A", "questions": "Q", "videos": "V", "news": "N"}


class InterviewIntelligenceError(RuntimeError):
    """An interview-research stage failed after emitting its failure event."""


@dataclass(frozen=True)
class InterviewIntelligenceRequest:
    target_company: str
    target_role: str

    def __post_init__(self):
        for field in ("target_company", "target_role"):
            value = getattr(self, field)
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"{field} must be a non-empty string")
            if len(value) > MAX_FIELD_LENGTH:
                raise ValueError(f"{field} must be at most {MAX_FIELD_LENGTH} characters")
            object.__setattr__(self, field, " ".join(value.split()))


def build_interview_queries(company: str, role: str) -> dict[str, str]:
    queries = {
        "search": f'{company} {role} interview experience rounds questions candidate reports',
        "questions": f'{company} {role} interview rounds common questions',
        "videos": f'{company} {role} interview experience coding system design walkthrough',
        "news": f'{company} hiring interview process changes',
    }
    return {kind: " ".join(query.split())[:MAX_QUERY_LENGTH] for kind, query in queries.items()}


class InterviewIntelligenceAgent:
    name = AGENT_NAME

    def __init__(self, llm: Any | None = None, tools: dict[str, Any] | None = None):
        self._llm = llm
        self.tools = {
            **SEARCH_TOOLS,
            "ai_overview": search_google_ai_overview,
            "transcript": fetch_youtube_transcript,
            **(tools or {}),
        }

    @property
    def llm(self):
        if self._llm is None:
            self._llm = get_llm(temperature=0.2)
        return self._llm

    async def astream(self, request: InterviewIntelligenceRequest) -> AsyncIterator[AgentEvent]:
        async for event in self._execute(request, {}):
            yield event

    async def run(
        self,
        request: InterviewIntelligenceRequest,
        on_event: EventCallback | None = None,
    ) -> dict[str, Any]:
        context: dict[str, Any] = {}
        events: list[AgentEvent] = []
        async for event in self._execute(request, context):
            events.append(event)
            await dispatch_event(event, on_event)
        return {"brief": context["brief"], "events": events, "handoff": _handoff(context["brief"])}

    async def _execute(
        self, request: InterviewIntelligenceRequest, context: dict[str, Any]
    ) -> AsyncIterator[AgentEvent]:
        context["queries"] = build_interview_queries(request.target_company, request.target_role)
        steps = (
            ("search_interview_sources", self._search_sources, settings.research_timeout_seconds),
            ("synthesize_interview_brief", self._synthesize_brief, settings.research_synthesis_timeout_seconds),
        )
        for step, handler, timeout in steps:
            async for event in self._run_step(step, handler, request, context, timeout):
                yield event

    async def _run_step(self, step, handler, request, context, timeout):
        yield make_event(AGENT_NAME, step, "running", {"company": request.target_company})
        started = time.perf_counter()
        try:
            payload = await asyncio.wait_for(handler(request, context), timeout=timeout)
        except asyncio.TimeoutError as exc:
            duration_ms = round((time.perf_counter() - started) * 1000, 1)
            error = f"{step} exceeded its {timeout:.1f}s budget"
            log_step(logger, ok=False, agent=AGENT_NAME, step=step, company=request.target_company,
                     duration_ms=duration_ms, error=error)
            yield make_event(AGENT_NAME, step, "failed", {"error": error, "duration_ms": duration_ms})
            raise InterviewIntelligenceError(error) from exc
        except Exception as exc:
            duration_ms = round((time.perf_counter() - started) * 1000, 1)
            logger.exception("Interview intelligence step %s failed", step)
            yield make_event(AGENT_NAME, step, "failed", {"error": str(exc), "duration_ms": duration_ms})
            raise InterviewIntelligenceError(f"{step} failed") from exc
        duration_ms = round((time.perf_counter() - started) * 1000, 1)
        log_step(logger, agent=AGENT_NAME, step=step, company=request.target_company, duration_ms=duration_ms)
        yield make_event(AGENT_NAME, step, "completed", {"duration_ms": duration_ms, **payload})

    async def _search_sources(self, request, context) -> dict[str, Any]:
        timings: dict[str, float] = {}

        async def call(kind: str, payload: dict[str, Any]):
            with Timer() as timer:
                result = await asyncio.to_thread(self.tools[kind].invoke, payload)
            timings[kind] = timer.duration_ms
            return result

        async def search_with_overview():
            search_result = await call("search", {
                "query": context["queries"]["search"], "limit": MAX_RESULTS_PER_SOURCE,
            })
            overview_data = search_result.get("ai_overview") or {}
            page_token = overview_data.get("page_token")
            if page_token:
                try:
                    overview_result = await call("ai_overview", {"page_token": page_token})
                except Exception as exc:
                    return {"search": search_result, "overview_error": str(exc)}
                return {"search": search_result, "overview": overview_result}
            if overview_data.get("text") or overview_data.get("references"):
                return {
                    "search": search_result,
                    "overview": {
                        "source": search_result.get("source", "unknown"),
                        "text": overview_data.get("text", ""),
                        "results": overview_data.get("references", []),
                    },
                }
            return {"search": search_result}

        other_kinds = ("questions", "videos", "news")
        outcomes = await asyncio.gather(
            search_with_overview(),
            *(
                call(kind, {"query": context["queries"][kind], "limit": MAX_RESULTS_PER_SOURCE})
                for kind in other_kinds
            ),
            return_exceptions=True,
        )
        groups: dict[str, list[dict[str, Any]]] = {}
        providers: dict[str, str] = {}
        errors: dict[str, str] = {}
        overview_text = ""

        def collect_results(kind: str, outcome: dict[str, Any]) -> None:
            providers[kind] = outcome.get("source", "unknown")
            groups[kind] = [
                item for item in outcome.get("results", [])
                if isinstance(item, dict) and _is_http_url(item.get("url"))
            ][:MAX_RESULTS_PER_SOURCE]

        search_outcome = outcomes[0]
        if isinstance(search_outcome, BaseException):
            errors["search"] = str(search_outcome)
            logger.warning("Interview intelligence source search failed: %s", search_outcome)
        else:
            collect_results("search", search_outcome["search"])
            if search_outcome.get("overview_error"):
                errors["ai_overview"] = search_outcome["overview_error"]
            elif search_outcome.get("overview"):
                overview = search_outcome["overview"]
                overview_text = overview.get("text", "")
                collect_results("ai_overview", overview)

        for kind, outcome in zip(other_kinds, outcomes[1:]):
            if isinstance(outcome, BaseException):
                errors[kind] = str(outcome)
                logger.warning("Interview intelligence source %s failed: %s", kind, outcome)
                continue
            collect_results(kind, outcome)
        if not providers:
            raise RuntimeError(f"All interview research sources failed: {errors}")
        transcripts = await self._fetch_transcripts(groups.get("videos", []), errors, timings)
        context.update(
            groups=groups,
            providers=providers,
            errors=errors,
            tool_timings_ms=timings,
            transcripts=transcripts,
            ai_overview_text=overview_text,
        )
        return {
            "result_counts": {kind: len(groups.get(kind, [])) for kind in (*SEARCH_TOOLS, "ai_overview")},
            "sources": providers,
            "errors": errors,
            "tool_timings_ms": timings,
            "transcript_count": len(transcripts),
        }

    async def _fetch_transcripts(self, videos, errors, timings):
        candidates = [video for video in videos if video.get("video_id")][:TRANSCRIPT_LIMIT]

        async def fetch(video):
            video_id = video["video_id"]
            key = f"transcript:{video_id}"
            started = time.perf_counter()
            try:
                with Timer() as timer:
                    result = await asyncio.to_thread(
                        self.tools["transcript"].invoke, {"video_id": video_id}
                    )
            except Exception as exc:
                errors[key] = str(exc)
                timings[key] = round((time.perf_counter() - started) * 1000, 1)
                return None
            timings[key] = timer.duration_ms
            if not result.get("available") or not result.get("excerpt"):
                return None
            return {
                "video_id": video_id,
                "title": video.get("title", ""),
                "url": video["url"],
                "excerpt": result["excerpt"][:TRANSCRIPT_EXCERPT_CHARS],
            }

        transcripts = await asyncio.gather(*(fetch(video) for video in candidates))
        return [transcript for transcript in transcripts if transcript]

    async def _synthesize_brief(self, request, context) -> dict[str, Any]:
        evidence, citations = _format_evidence(
            context["groups"], context["transcripts"], context["ai_overview_text"]
        )
        prompt = INTERVIEW_INTELLIGENCE_PROMPT.format(
            target_company=request.target_company,
            target_role=request.target_role,
            sources=evidence,
            errors="\n".join(f"- {kind}: {error}" for kind, error in context["errors"].items()) or "none",
        )
        response = await self.llm.ainvoke([
            SystemMessage(content="Follow the evidence and citation rules exactly."),
            HumanMessage(content=prompt),
        ])
        content = _message_text(response).strip()
        if not content:
            raise RuntimeError("LLM returned an empty interview intelligence brief")
        content = _link_citations(content, citations)
        source_records = [item for group in context["groups"].values() for item in group]
        content += _format_source_index(context["groups"])
        brief = {
            "id": f"interview-brief-{uuid.uuid4().hex[:12]}",
            "target_company": request.target_company,
            "target_role": request.target_role,
            "content_markdown": content,
            "sources": source_records,
            "video_transcripts": context["transcripts"],
            "source_providers": context["providers"],
            "source_errors": context["errors"],
            "uses_mock_sources": any(source == "mock" for source in context["providers"].values()),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
        context["brief"] = brief
        return {
            "source_count": len(source_records),
            "brief_id": brief["id"],
        }


def _format_evidence(
    groups: dict[str, list[dict[str, Any]]],
    transcripts: list[dict[str, str]],
    ai_overview_text: str = "",
) -> tuple[str, dict[str, dict[str, str]]]:
    lines: list[str] = []
    citations: dict[str, dict[str, str]] = {}
    if ai_overview_text:
        lines.extend(("Google AI Overview (secondary summary; verify against references):", ai_overview_text))
    transcripts_by_video = {item["video_id"]: item for item in transcripts}
    for kind, prefix in SOURCE_PREFIXES.items():
        lines.append(f"{kind.title()}:")
        records = groups.get(kind, [])
        if not records:
            lines.append("- no usable results")
            continue
        for index, item in enumerate(records, start=1):
            source_id = f"{prefix}{index}"
            citations[source_id] = item
            title = _truncate(item.get("title", "Untitled result"), 200)
            snippet = _truncate(item.get("snippet", ""), PROMPT_SNIPPET_CHARS)
            source = _truncate(item.get("source", ""), 100)
            date = _truncate(item.get("date", ""), 40)
            transcript = transcripts_by_video.get(item.get("video_id"), {}).get("excerpt", "")
            transcript = _truncate(transcript, TRANSCRIPT_EXCERPT_CHARS)
            transcript_text = f" | transcript excerpt: {transcript}" if transcript else ""
            lines.append(f"- [{source_id}] {title} | {source} | {date} | {item['url']} | {snippet}{transcript_text}")
    return "\n".join(lines), citations


def _link_citations(content: str, citations: dict[str, dict[str, str]]) -> str:
    def replace(match: re.Match) -> str:
        source_id = match.group(1)
        item = citations.get(source_id)
        return f"[{source_id}]({_markdown_url(item['url'])})" if item else "[source not provided]"

    return re.sub(r"\[([SAQVN]\d+)\]", replace, content)


def _format_source_index(groups: dict[str, list[dict[str, Any]]]) -> str:
    headings = (
        ("videos", "YouTube Videos"),
        ("search", "Google Search Results"),
        ("ai_overview", "Google AI Overview References"),
        ("questions", "Related Questions"),
        ("news", "Recent News Articles"),
    )
    lines = ["\n\n## Sources by Resource Type"]
    for kind, heading in headings:
        lines.append(f"### {heading}")
        items = groups.get(kind, [])
        if not items:
            lines.append("- No usable sources were returned.")
            continue
        for item in items:
            title = _markdown_text(item.get("title") or "Untitled result")
            source = _markdown_text(item.get("source") or "Source")
            date = f" ({_markdown_text(item['date'])})" if item.get("date") else ""
            snippet = _markdown_text(_truncate(item.get("snippet", ""), 240))
            detail = f" - {snippet}" if snippet else ""
            lines.append(f"- [{title}]({_markdown_url(item['url'])}) - {source}{date}{detail}")
    return "\n".join(lines)


def _is_http_url(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _markdown_url(value: str) -> str:
    return value.replace("(", "%28").replace(")", "%29").replace(" ", "%20")


def _markdown_text(value: str) -> str:
    return value.replace("[", "\\[").replace("]", "\\]").replace("\n", " ").strip()


def _truncate(value: Any, limit: int) -> str:
    text = value.strip() if isinstance(value, str) else ""
    return text if len(text) <= limit else text[:limit].rstrip() + "..."


def _message_text(message: Any) -> str:
    content = getattr(message, "content", message)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            item.get("text", "") for item in content
            if isinstance(item, dict) and item.get("type") == "text"
        )
    return str(content)


def _handoff(brief: dict[str, Any]) -> dict[str, Any]:
    return {
        "agent": AGENT_NAME,
        "kind": "interview_intelligence_brief",
        "summary": (
            f"Interview research for {brief['target_role']} at {brief['target_company']}: "
            f"{len(brief['sources'])} sources."
        ),
        "data": {
            "brief_id": brief["id"],
            "target_company": brief["target_company"],
            "target_role": brief["target_role"],
            "source_count": len(brief["sources"]),
            "uses_mock_sources": brief["uses_mock_sources"],
        },
    }