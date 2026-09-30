"""Reusable Job Intelligence service and LangGraph node."""
import asyncio
import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from config import get_llm, settings
from graph.events import INTERNAL_LLM_CONFIG
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


async def extract_with_llm(postings: list[dict[str, Any]], role: str = "", company: str = "") -> dict[str, Any]:
    empty = {
        "skills": [],
        "seniorityDistribution": {},
        "employmentTypes": {},
        "commonResponsibilities": [],
        "commonQualifications": [],
        "coverage": "low",
    }
    if not postings:
        if not role:
            return empty
        # Baseline role requirement synthesis if no online postings were found
        fallback_prompt = f"""No live online job postings were retrieved for the role '{role}' at '{company or 'technology companies'}'.
Generate the standard, typical technical and industry requirements for this role.
Respond only with valid JSON containing:
- skills: array of skill objects with "name" (e.g. "Python", "Distributed Systems", "SQL", "APIs"), "category", "priority" ("must_have" | "nice_to_have")
- seniorityDistribution: object with levels
- employmentTypes: object with types
- commonResponsibilities: array of strings
- commonQualifications: array of strings
- coverage: "medium"
"""
        try:
            resp = await asyncio.wait_for(
                get_llm().ainvoke(fallback_prompt, config=INTERNAL_LLM_CONFIG), timeout=25
            )
            raw = str(resp.content).strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[-1]
            if raw.endswith("```"):
                raw = raw[:-3]
            data = json.loads(raw.strip())
            if isinstance(data, dict) and isinstance(data.get("skills"), list):
                return {**empty, **data, "coverage": "medium"}
        except Exception:
            logger.warning("[JobIntelligence] Baseline role synthesis unavailable", exc_info=True)
        return empty

    payload = "\n\n".join(
        f"--- JOB POSTING #{index + 1} ---\n"
        f"Title: {posting.get('title', '')}\n"
        f"Company: {posting.get('company_name', '')}\n"
        f"Location: {posting.get('location', '')}\n"
        f"Description Snippet: {str(posting.get('description') or '')[:800]}"
        for index, posting in enumerate(postings[:10])
    )
    prompt = f"""Analyze these {min(len(postings), 10)} job postings and extract structured data.
Respond only with JSON containing skills (objects with name, category, priority),
seniorityDistribution, employmentTypes, commonResponsibilities, commonQualifications,
and coverage (high, medium, or low).

Postings:\n{payload}"""

    try:
        response = await asyncio.wait_for(
            get_llm().ainvoke(prompt, config=INTERNAL_LLM_CONFIG), timeout=25
        )
        content = str(response.content).strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[-1]
        if content.endswith("```"):
            content = content[:-3]
        parsed = json.loads(content.strip())
        if not isinstance(parsed, dict):
            raise ValueError("LLM result must be a JSON object")
        for key, expected_type in (
            ("skills", list),
            ("seniorityDistribution", dict),
            ("commonResponsibilities", list),
            ("commonQualifications", list),
        ):
            if key in parsed and not isinstance(parsed[key], expected_type):
                raise ValueError(f"LLM field {key} has an invalid type")
        return {**empty, **parsed}
    except Exception:
        logger.warning("[JobIntelligence] Extraction unavailable; returning a safe partial profile", exc_info=True)
        return empty


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
) -> dict[str, Any]:
    """Fetch and validate a profile; database can be injected for isolated tests."""
    if using_dummy_data():
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
    raw_data = await asyncio.wait_for(
        asyncio.to_thread(fetch_google_jobs, query, request.location), timeout=20
    )
    postings = raw_data.get("jobs_results", []) if isinstance(raw_data, dict) else []
    postings = postings if isinstance(postings, list) else []
    is_fallback = False
    fallback_reason = None
    if not postings and request.company:
        is_fallback = True
        fallback_reason = (
            f"No specific postings were found for {request.company}; broader role results were requested."
        )
        fallback_data = await asyncio.wait_for(
            asyncio.to_thread(fetch_google_jobs, request.role, request.location), timeout=20
        )
        postings = fallback_data.get("jobs_results", []) if isinstance(fallback_data, dict) else []
        postings = postings if isinstance(postings, list) else []
        raw_data = fallback_data

    deduped = deduplicate_jobs(postings)
    extraction = await extract_with_llm(deduped, role=request.role, company=request.company)
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
        try:
            request = JobIntelligenceInput.model_validate(state.get("job_intelligence_input") or {})
        except ValidationError as exc:
            return {"job_intelligence_result": {
                "status": "invalid_input",
                "data": None,
                "error": "Job role and location are required.",
                "validation_errors": exc.errors(include_input=False),
            }}

        try:
            profile = await get_job_intelligence_profile(request)
            has_analysis = any(
                profile.get(field)
                for field in ("skills", "commonResponsibilities", "commonQualifications")
            )
            status = "success" if profile["analyzedPostingsCount"] and has_analysis else "partial"
            error = None if status == "success" else "No job postings were available for this search."
            return {"job_intelligence_result": {"status": status, "data": profile, "error": error}}
        except Exception:
            logger.exception("Job Intelligence node failed")
            return {"job_intelligence_result": {
                "status": "failed",
                "data": None,
                "error": "Job market data is temporarily unavailable.",
            }}