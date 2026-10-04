"""
Direct company research for interview prep (COMPANY_RESEARCH_MODE=direct).

The tool-calling agent (agents/company_research_agent.py) needs a model
turn per search plus a closing dossier turn: 3-4 calls, each resending the
growing conversation. Here the two searches run straight away, in parallel,
and ONE small model call condenses them into a brief that the skill-gap,
research and planner prompts actually use:

  search_company_overview + search_company_news   (parallel, cached)
  -> normalize_company_profile                    (same profile shape as the agent)
  -> one model call -> CompanyBrief               (profile["brief"])

Token budget: the evidence sent to the model is capped (EVIDENCE_CHARS)
and the answer is capped (BRIEF_MAX_TOKENS), so one run costs roughly
2-3k tokens whatever the company — small enough for a free-tier fast
model (COMPANY_RESEARCH_LLM=fast, see config.get_llm).

The brief is optional by construction: if the model call fails, is rate
limited (429) or returns something unusable, the profile built from the
search results is returned without it and the pipeline carries on.
"""
import asyncio
import json
import logging
import re
from typing import Any

from pydantic import BaseModel, Field, ValidationError, field_validator

from core.config import get_llm, settings
from graph.events import INTERNAL_LLM_CONFIG
from observability.timing import log_failure
from storage.llm_cache import forget_response
from tools.company_research_tools import normalize_company_profile, search_company_news, search_company_overview
from tools.plan_builder import parse_json_object

logger = logging.getLogger(__name__)

EVIDENCE_CHARS = 5000  # ~1,250 tokens of search evidence in the prompt
SNIPPET_CHARS = 220
BRIEF_MAX_TOKENS = 400
BRIEF_TIMEOUT_SECONDS = 30

BRIEF_PROMPT = """You are preparing a candidate for a {role} interview at {company}.
From the search evidence below, extract only what helps decide WHAT TO STUDY. Use only facts stated in the
evidence; when the evidence does not say, use an empty list or empty string. No opinions, no filler.

Return ONLY a JSON object, no prose, no markdown:
{{"summary": "what the company builds, in at most 40 words",
 "products": ["up to 5 product or platform names"],
 "tech_stack": ["up to 10 languages, frameworks, tools or platforms the company uses or builds"],
 "engineering_focus": ["up to 5 short phrases: what its engineers work on"],
 "recent_developments": ["up to 3 short phrases from recent news that an interviewer might bring up"]}}

Evidence:
{evidence}"""


def _short_list(limit: int, chars: int = 80):
    def clean(value: Any) -> list[str]:
        items = value if isinstance(value, list) else []
        cleaned = [" ".join(str(item).split())[:chars] for item in items if isinstance(item, (str, int, float))]
        return [item for item in cleaned if item][:limit]
    return clean


class CompanyBrief(BaseModel):
    summary: str = ""
    products: list[str] = Field(default_factory=list)
    tech_stack: list[str] = Field(default_factory=list)
    engineering_focus: list[str] = Field(default_factory=list)
    recent_developments: list[str] = Field(default_factory=list)

    @field_validator("summary", mode="before")
    @classmethod
    def _clip_summary(cls, value: Any) -> str:
        return " ".join(str(value or "").split())[:400]

    _products = field_validator("products", mode="before")(_short_list(5))
    _tech_stack = field_validator("tech_stack", mode="before")(_short_list(10))
    _engineering_focus = field_validator("engineering_focus", mode="before")(_short_list(5, 120))
    _recent = field_validator("recent_developments", mode="before")(_short_list(3, 160))

    def is_empty(self) -> bool:
        return not (self.summary or self.products or self.tech_stack or self.engineering_focus)


def company_focus(profile: dict[str, Any] | None) -> str:
    """One short line of company context for the skill-gap, research and
    planner prompts, from a profile's brief ("" when there is none)."""
    brief = (profile or {}).get("brief") or {}
    parts = []
    if brief.get("tech_stack"):
        parts.append("Company stack: " + ", ".join(brief["tech_stack"][:8]))
    if brief.get("engineering_focus"):
        parts.append("Engineering focus: " + "; ".join(brief["engineering_focus"][:3]))
    return ". ".join(parts)[:300]


def company_context(profile: dict[str, Any] | None) -> str:
    """What company research found, as a few lines for another agent's
    prompt (job intelligence uses it when the company has no postings)."""
    profile = profile or {}
    brief = profile.get("brief") or {}
    parts = [str(brief.get("summary") or profile.get("description") or "").strip()]
    for label, key in (("Products", "products"), ("Tech stack", "tech_stack"), ("Engineering focus", "engineering_focus")):
        if brief.get(key):
            parts.append(f"{label}: " + ", ".join(brief[key]))
    return " ".join(part for part in parts if part)[:900]


def _clip(text: Any, limit: int = SNIPPET_CHARS) -> str:
    text = " ".join(str(text or "").split())
    return text if len(text) <= limit else text[:limit].rstrip() + "..."


def build_evidence(profile: dict[str, Any]) -> str:
    """The search results as compact text, most informative first, cut at
    EVIDENCE_CHARS so the prompt size never depends on what Google returned."""
    lines = []
    facts = {key: profile.get(key) for key in ("name", "industry", "founded", "headquarters", "description")}
    lines.append("Facts: " + json.dumps({k: v for k, v in facts.items() if v}))
    for item in (profile.get("organic_results") or [])[:8]:
        lines.append(f"- {_clip(item.get('title'), 100)}: {_clip(item.get('snippet'))}")
    for item in (profile.get("related_questions") or [])[:3]:
        lines.append(f"- Q: {_clip(item.get('question'), 100)} A: {_clip(item.get('snippet'))}")
    for item in (profile.get("recent_developments") or [])[:5]:
        lines.append(f"- News: {_clip(item.get('title'), 140)}")
    return "\n".join(lines)[:EVIDENCE_CHARS]


def _parse_tool_output(raw: Any) -> dict[str, Any]:
    """A company tool's JSON string as a dict; {} for an error payload."""
    try:
        data = json.loads(raw) if isinstance(raw, str) else raw
    except json.JSONDecodeError:
        return {}
    if not isinstance(data, dict) or data.get("status") == "error":
        return {}
    return {} if (data.get("search_metadata") or {}).get("status") == "Error" else data


class DirectCompanyResearch:
    def __init__(self, llm: Any | None = None, tools: dict[str, Any] | None = None):
        """`llm` and `tools` ({"overview", "news"}, each with .invoke) are
        injectable for tests."""
        self._llm = llm
        self.tools = {"overview": search_company_overview, "news": search_company_news, **(tools or {})}

    @property
    def llm(self):
        if self._llm is None:
            profile = "fast" if settings.company_research_llm == "fast" else "default"
            self._llm = get_llm(temperature=0, max_tokens=BRIEF_MAX_TOKENS, profile=profile)
        return self._llm

    async def run(self, company: str, role: str = "") -> dict[str, Any]:
        """{"profile": <company profile incl. "brief" when written>,
        "brief": <dict | None>}. Raises only if both searches failed."""
        overview, news = await self._search(company)
        # Google's spelling fix ("Antropic" -> "Anthropic"): the first
        # search ran on the typo, so search again under the real name
        corrected = str(overview.get("corrected_company") or "").strip()
        if corrected and corrected.casefold() != company.strip().casefold() and not overview.get("knowledge_graph"):
            logger.info("Company research: retrying as %r (spelling correction of %r)", corrected, company)
            fixed_overview, fixed_news = await self._search(corrected)
            overview, news = fixed_overview or overview, fixed_news or news
        if not overview and not news:
            raise RuntimeError("company searches returned no usable results")

        name = (overview.get("knowledge_graph") or {}).get("title") or corrected or company
        profile = normalize_company_profile(company_name=name, search_data=overview, news_data=news)
        brief = await self._brief(profile, role)
        if brief is not None:
            profile["brief"] = brief
        return {"profile": profile, "brief": brief}

    async def _search(self, company: str) -> tuple[dict[str, Any], dict[str, Any]]:
        async def call(kind: str) -> dict[str, Any]:
            try:
                raw = await asyncio.wait_for(
                    asyncio.to_thread(self.tools[kind].invoke, {"company_name": company}),
                    timeout=settings.research_tool_timeout_seconds,
                )
            except Exception as exc:
                log_failure(logger, f"Company {kind} search failed", exc)
                return {}
            return _parse_tool_output(raw)

        overview, news = await asyncio.gather(call("overview"), call("news"))
        return overview, news

    async def _brief(self, profile: dict[str, Any], role: str) -> dict[str, Any] | None:
        prompt = BRIEF_PROMPT.format(
            role=role or "software", company=profile.get("name") or "the company", evidence=build_evidence(profile)
        )
        try:
            response = await asyncio.wait_for(
                self.llm.ainvoke(prompt, config=INTERNAL_LLM_CONFIG), timeout=BRIEF_TIMEOUT_SECONDS
            )
        except Exception as exc:
            log_failure(logger, "Company brief unavailable; continuing with the search-based profile", exc)
            return None
        try:
            # a thinking model may prepend its reasoning in <think> tags
            text = re.sub(r"<think>.*?</think>", "", str(response.content), flags=re.S)
            brief = CompanyBrief.model_validate(parse_json_object(text))
        except (ValueError, ValidationError) as exc:
            forget_response(response)  # don't replay an unusable answer from the cache
            logger.warning("Company brief was not usable JSON (%s); continuing without it", str(exc)[:200])
            return None
        return None if brief.is_empty() else brief.model_dump()
