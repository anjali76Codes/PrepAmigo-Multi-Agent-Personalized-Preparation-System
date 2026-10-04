"""Reusable Job Intelligence service and LangGraph node."""
import asyncio
import json
import logging
import os
import re
from datetime import datetime, timedelta
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from core.config import get_llm, settings
from graph.events import INTERNAL_LLM_CONFIG, emit_to_graph_stream, invoke_tool_with_events, make_event
from observability.timing import log_failure
from storage.llm_cache import forget_response
from tools.cache import caches_bypassed
from tools.plan_builder import parse_json_object
from tools.serpapi_client import serpapi_search, using_dummy_data

logger = logging.getLogger(__name__)

_mongo_client: Any | None = None


class JobIntelligenceInput(BaseModel):
    model_config = ConfigDict(extra="allow")

    company: str = Field(default="", max_length=200)
    role: str = Field(min_length=1, max_length=200)
    location: str = Field(min_length=1, max_length=200)
    force_refresh: bool = False

    @field_validator("company", "role", "location", mode="before")
    @classmethod
    def normalize_text(cls, value: Any) -> str:
        return value.strip() if isinstance(value, str) else ""

    def normalized_key(self) -> str:
        base = [self.company.strip().lower(), self.role.strip().lower(), self.location.strip().lower()]
        custom = [
            f"{key.strip().lower()}={str(value).strip().lower()}"
            for key, value in sorted((self.model_extra or {}).items())
            if isinstance(value, str) and value.strip()
        ]
        return "|".join([*base, *custom])


class JobIntelligenceProfile(BaseModel):
    model_config = ConfigDict(extra="allow")

    company: str
    role: str
    location: str
    isFallback: bool = False
    fallbackReason: str | None = None
    coverage: Literal["high", "medium", "low", "none"] = "medium"
    postingsCount: int = 0
    analyzedPostingsCount: int = 0
    skills: list[dict[str, Any]] = Field(default_factory=list)
    seniorityDistribution: dict[str, Any] = Field(default_factory=dict)
    employmentTypes: list[str] | dict[str, Any] = Field(default_factory=list)
    commonResponsibilities: list[str] = Field(default_factory=list)
    commonQualifications: list[str] = Field(default_factory=list)
    fetchedAt: str | datetime | None = None
    expiresAt: str | datetime | None = None


def get_db():
    global _mongo_client
    if _mongo_client is None:
        from pymongo import MongoClient

        mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        _mongo_client = MongoClient(mongo_uri, serverSelectionTimeoutMS=500)
    return _mongo_client["prepamigo"]


def fetch_google_jobs(query: str, location: str) -> dict[str, Any]:
    if settings.serpapi_enabled and not settings.serpapi_api_key:
        return {"error": "SERPAPI_API_KEY is not configured in environment.", "jobs_results": []}

    try:
        clean_loc = (location or "").strip()
        clean_query = query.strip()

        # "Remote" is a work modality, not a geographic location on Google Jobs.
        # Passing location="Remote" makes Google search for "Remote, Oregon" (0 results).
        if clean_loc.lower() == "remote":
            if "remote" not in clean_query.lower():
                clean_query = f"{clean_query} remote"
            params = {
                "engine": "google_jobs",
                "q": clean_query,
                "hl": "en",
                "gl": "us",
            }
        else:
            params = {
                "engine": "google_jobs",
                "q": clean_query,
                "location": clean_loc,
                "hl": "en",
                "gl": "us",
            }
        return serpapi_search(params)
    except Exception as exc:
        logger.warning("[JobIntelligence] SerpApi request failed: %s", exc)
        return {"error": "Job search is temporarily unavailable.", "jobs_results": []}


JOB_MAX_OUTPUT_TOKENS = 900  # 15 skills + short lists; the answer used to run past 1,000


def _llm():
    """JOB_INTELLIGENCE_LLM / JOB_INTELLIGENCE_MODEL choose the model."""
    # temperature 0: the same company and role should give the same skills
    return get_llm(temperature=0, max_tokens=JOB_MAX_OUTPUT_TOKENS, profile=settings.job_intelligence_llm,
                   model=settings.job_intelligence_model or None)


def deduplicate_jobs(postings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    deduped = []
    for posting in postings:
        title = str(posting.get("title") or "").strip().lower()
        company = str(posting.get("company_name") or "").strip().lower()
        location = str(posting.get("location") or "").strip().lower()
        key = f"{title}|{company}|{location}"
        if key not in seen:
            seen.add(key)
            deduped.append(posting)
    return deduped


EXTRACTION_FORMAT = """Return ONLY a JSON object, no prose, no markdown:
{"skills": [{"name": "<1-3 words>", "category": "<area>", "priority": "must_have|nice_to_have"}],
 "seniorityDistribution": {"<level>": <count>}, "employmentTypes": {"<type>": <count>},
 "commonResponsibilities": ["<short phrase>"], "commonQualifications": ["<short phrase>"],
 "coverage": "high|medium|low"}
At most 15 skills, the most important first; at most 5 responsibilities and 5 qualifications."""


def postings_from_company(postings: list[dict[str, Any]], company: str) -> list[dict[str, Any]]:
    """The postings actually published by `company`. A job search for
    "<company> <role>" also returns other employers' adverts that merely
    rank for the words: a search for Google SDE roles returned ten
    postings, none from Google, and one consultancy's WebSphere + Axway
    stack became "what Google requires"."""
    wanted = re.findall(r"[a-z0-9]+", company.casefold())
    if not wanted:
        return []
    own = []
    for posting in postings:
        employer = re.findall(r"[a-z0-9]+", str(posting.get("company_name") or "").casefold())
        # every word of the company name appears in the employer's name:
        # "Amazon" matches "Amazon Web Services (AWS)" and "Amazon Inc."
        if employer and all(word in employer for word in wanted):
            own.append(posting)
    return own


def _posting_text(postings: list[dict[str, Any]]) -> str:
    return "\n\n".join(
        f"--- JOB POSTING #{index + 1} ---\n"
        f"Title: {posting.get('title', '')}\n"
        f"Company: {posting.get('company_name', '')}\n"
        f"Location: {posting.get('location', '')}\n"
        f"Description Snippet: {str(posting.get('description') or '')[:800]}"
        for index, posting in enumerate(postings[:10])
    )


async def extract_with_llm(
    postings: list[dict[str, Any]], role: str = "", company: str = "", from_company: bool = True,
    company_context: str = "",
) -> dict[str, Any]:
    """Required skills and role facts, from one model call.

    With the target company's own postings (from_company=True) the
    postings are the evidence. Without any, the requirements come from
    what is known about the company and the role, plus `company_context`
    (the company research brief) when there is one. Other employers'
    adverts are never shown to the model: given as "background", they
    still set the answer (a Google SDE profile came back as Agile, Git and
    CI/CD from a handful of unrelated web-developer adverts)."""
    empty = {
        "skills": [],
        "seniorityDistribution": {},
        "employmentTypes": {},
        "commonResponsibilities": [],
        "commonQualifications": [],
        "coverage": "low",
    }
    if not postings and not role:
        return empty
    target = company or "technology companies"
    if postings and from_company:
        prompt = (f"These {min(len(postings), 10)} job postings are from {target} for the role '{role}'. "
                  f"Extract what they ask for.\n"
                  f"Rules: include only skills the postings actually name. A skill named in a single posting is "
                  f"nice_to_have, unless there are fewer than 3 postings.\n{EXTRACTION_FORMAT}\n\n"
                  f"Postings:\n{_posting_text(postings)}")
        coverage = None
    else:
        context = f"\nWhat company research found about {target}: {company_context[:900]}\n" if company_context else "\n"
        prompt = (f"A candidate is preparing to interview for the role '{role}' at {target}. List what {target} "
                  f"requires of this role, from what is generally known about its engineering and its hiring for "
                  f"this role.{context}"
                  f"Rules:\n"
                  f"- The core competencies this role is hired and interviewed for come first, as must_have.\n"
                  f"- Name a technology only if {target} is known to use it or it is standard for this role there.\n"
                  f"- Leave out workflow tools and practices every engineer is assumed to know, unless they are "
                  f"central to this role.\n{EXTRACTION_FORMAT}")
        coverage = "medium"

    response = None
    emit_to_graph_stream(make_event(
        "job_intelligence",
        "extract_job_requirements",
        "running",
        {"provider": settings.job_intelligence_llm, "message": "Analyzing job postings for role requirements..."},
    ))
    try:
        response = await asyncio.wait_for(
            _llm().ainvoke(prompt, config=INTERNAL_LLM_CONFIG),
            timeout=settings.job_intelligence_llm_timeout_seconds,
        )
        text = re.sub(r"<think>.*?</think>", "", str(response.content), flags=re.S)
        parsed = parse_json_object(text)
        for key, expected_type in (
            ("skills", list),
            ("seniorityDistribution", dict),
            ("commonResponsibilities", list),
            ("commonQualifications", list),
        ):
            if key in parsed and not isinstance(parsed[key], expected_type):
                raise ValueError(f"LLM field {key} has an invalid type")
        result = {**empty, **parsed, **({"coverage": coverage} if coverage else {})}
        emit_to_graph_stream(make_event(
            "job_intelligence",
            "extract_job_requirements",
            "completed",
            {
                "provider": settings.job_intelligence_llm,
                "skills_found": len(result.get("skills") or []),
                "coverage": result.get("coverage"),
                "message": "Job requirements extracted.",
            },
        ))
        return result
    except Exception as exc:
        forget_response(response)  # an unparseable answer must not be replayed from the cache
        log_failure(logger, "[JobIntelligence] Extraction unavailable; returning a safe partial profile", exc)
        emit_to_graph_stream(make_event(
            "job_intelligence",
            "extract_job_requirements",
            "failed",
            {"provider": settings.job_intelligence_llm, "error": str(exc)[:240]},
        ))
        return empty


async def _search_postings(query: str, location: str) -> tuple[list[dict[str, Any]], bool]:
    """(job postings, whether the search timed out). A slow search is not a
    failed run: the caller carries on without postings, and the late
    response is still cached when it arrives, so the next run has it."""
    try:
        raw, _metadata = await invoke_tool_with_events(
            fetch_google_jobs,
            {"query": query, "location": location},
            agent="job_intelligence",
            timeout=settings.research_tool_timeout_seconds,
        )
    except asyncio.TimeoutError:
        logger.warning("[JobIntelligence] Job search for %r timed out after %.0fs; continuing without postings",
                       query, settings.research_tool_timeout_seconds)
        return [], True
    postings = raw.get("jobs_results", []) if isinstance(raw, dict) else []
    postings = postings if isinstance(postings, list) else []
    return postings, False


def _fresh_cache_entry(cached: dict[str, Any] | None) -> dict[str, Any] | None:
    if not cached:
        return None
    expires_at = cached.get("expiresAt")
    if isinstance(expires_at, str):
        try:
            expires_at = datetime.fromisoformat(expires_at)
        except ValueError:
            return None
    if not isinstance(expires_at, datetime) or expires_at <= datetime.utcnow():
        return None
    cached.pop("_id", None)
    return cached


async def get_job_intelligence_profile(
    request: JobIntelligenceInput,
    *,
    database: Any | None = None,
    cache_enabled: bool = True,
    company_context: str = "",
) -> dict[str, Any]:
    """Fetch and validate a profile; database can be injected for isolated tests."""
    # --no-cache (tools/cache.bypass_caches) covers this agent's own stored
    # profiles too: neither read nor written
    if using_dummy_data() or caches_bypassed():
        cache_enabled = False
    cache_key = request.normalized_key()
    db = database
    if db is None and cache_enabled:
        try:
            db = get_db()
            db.client.admin.command("ping")
        except Exception:
            logger.info("Job Intelligence cache (MongoDB) is unavailable; continuing without cache")
            db = None

    collection = db.job_intelligence_profiles if db is not None else None
    if collection is not None and cache_enabled and not request.force_refresh:
        try:
            cached = _fresh_cache_entry(collection.find_one({"normalizedQueryKey": cache_key}))
            if cached:
                return JobIntelligenceProfile.model_validate(cached).model_dump(mode="json")
        except Exception:
            logger.info("Job Intelligence cache read failed; fetching fresh data")

    custom_terms = [
        str(value).strip()
        for key, value in request.model_extra.items()
        if isinstance(value, str) and value.strip()
    ] if request.model_extra else []
    query = " ".join([request.company, request.role, *custom_terms]).strip()
    postings, search_timed_out = await _search_postings(query, request.location)
    is_fallback = False
    fallback_reason = None
    from_company = True
    if request.company:
        own = postings_from_company(postings, request.company)
        if own:
            if len(own) < len(postings):
                logger.info("[JobIntelligence] %d of %d postings are from %s; the others are ignored",
                            len(own), len(postings), request.company)
            postings = own
        else:
            # none from this company (other employers' adverts that rank
            # for its name, or nothing at all): they are set aside, and the
            # requirements come from what is known about the company and
            # the role. No second, broader search: more of other employers'
            # adverts is what must not decide the plan.
            if postings:
                logger.info("[JobIntelligence] None of the %d postings found are from %s; they are not used",
                            len(postings), request.company)
            postings = []
            from_company = False
            is_fallback = True
            fallback_reason = (f"No postings from {request.company} were found; requirements reflect what is "
                               f"generally known about {request.company} and the role.")
    if search_timed_out:
        is_fallback = True
        fallback_reason = "The job search timed out; standard requirements for the role were used instead."

    deduped = deduplicate_jobs(postings)
    extraction = await extract_with_llm(
        deduped, role=request.role, company=request.company, from_company=from_company,
        company_context=company_context)
    now = datetime.utcnow()
    profile = JobIntelligenceProfile.model_validate({
        "normalizedQueryKey": cache_key,
        "company": request.company or "General",
        "role": request.role.strip(),
        "location": request.location.strip(),
        "isFallback": is_fallback or (not deduped),
        "fallbackReason": fallback_reason or ("Synthesized standard industry role requirements." if not deduped else None),
        "coverage": extraction.get("coverage")
        if extraction.get("coverage") in {"high", "medium", "low", "none"}
        else ("medium" if deduped else "none"),
        "postingsCount": len(postings),
        "analyzedPostingsCount": len(deduped),
        "skills": extraction.get("skills", []),
        "seniorityDistribution": extraction.get("seniorityDistribution", {}),
        "employmentTypes": extraction.get("employmentTypes", {}),
        "commonResponsibilities": extraction.get("commonResponsibilities", []),
        "commonQualifications": extraction.get("commonQualifications", []),
        "customInputs": request.model_extra or {},
        "dataSource": "dummy" if using_dummy_data() else "serpapi",
        "fetchedAt": now,
        "expiresAt": now + timedelta(days=7),
    })
    profile_data = profile.model_dump(mode="json")

    if collection is not None:
        try:
            collection.update_one(
                {"normalizedQueryKey": cache_key},
                {"$set": profile_data},
                upsert=True,
            )
        except Exception:
            logger.info("Job Intelligence cache write skipped (MongoDB unavailable)")
    return profile_data


class JobIntelligenceAgent:
    """LangGraph node that writes only its dedicated result field."""

    name = "job_intelligence"

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        emit_to_graph_stream(make_event(self.name, "analyze_job_market", "running"))
        try:
            request = JobIntelligenceInput.model_validate(state.get("job_intelligence_input") or {})
        except ValidationError as exc:
            emit_to_graph_stream(make_event(self.name, "analyze_job_market", "failed"))
            return {"job_intelligence_result": {
                "status": "invalid_input",
                "data": None,
                "error": "Job role and location are required.",
                "validation_errors": exc.errors(include_input=False),
            }}

        try:
            profile = await get_job_intelligence_profile(
                request, company_context=str(state.get("company_context") or ""))
            has_analysis = any(
                profile.get(field)
                for field in ("skills", "commonResponsibilities", "commonQualifications")
            )
            status = "success" if profile["analyzedPostingsCount"] and has_analysis else "partial"
            error = None if status == "success" else "No job postings were available for this search."
            emit_to_graph_stream(make_event(self.name, "analyze_job_market", "completed", {"status": status}))
            return {"job_intelligence_result": {"status": status, "data": profile, "error": error}}
        except Exception as exc:
            log_failure(logger, "Job Intelligence node failed", exc)
            emit_to_graph_stream(make_event(self.name, "analyze_job_market", "failed"))
            return {"job_intelligence_result": {
                "status": "failed",
                "data": None,
                "error": "Job market data is temporarily unavailable.",
            }}
