import json
import logging
from typing import Any, List, Dict, Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from config import settings, get_llm
from auth import verify_token
import pymongo
import os

logger = logging.getLogger(__name__)

router = APIRouter()

# MongoDB setup
_mongo_client = None
def get_db():
    global _mongo_client
    if not _mongo_client:
        mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        _mongo_client = pymongo.MongoClient(mongo_uri)
    return _mongo_client["prepamigo"]

class JobIntelligenceRequest(BaseModel):
    company: Optional[str] = ""
    role: str
    location: str
    forceRefresh: Optional[bool] = False
    
# In-memory cache to replace MongoDB for this port (for simplicity, real app might use Redis/Qdrant)
_job_cache: Dict[str, Any] = {}

def fetch_google_jobs(query: str, location: str) -> dict:
    if not settings.serpapi_api_key:
        logger.error("[JobIntelligence] SERPAPI_API_KEY is not configured.")
        return {"error": "SERPAPI_API_KEY is not configured in environment.", "jobs_results": []}

    try:
        from serpapi import GoogleSearch  # type: ignore
        params = {
            "engine": "google_jobs",
            "q": query,
            "location": location,
            "api_key": settings.serpapi_api_key,
            "hl": "en",
            "gl": "us",
        }
        result = GoogleSearch(params).get_dict()
        return result
    except Exception as exc:
        logger.error(f"[JobIntelligence] SerpApi request exception: {exc}")
        return {"error": str(exc), "jobs_results": []}

def deduplicate_jobs(postings: List[Dict]) -> List[Dict]:
    seen_hashes = set()
    deduped = []
    for p in postings:
        title = p.get("title", "").lower().strip()
        company = p.get("company_name", "").lower().strip()
        loc = p.get("location", "").lower().strip()
        phash = f"{title}|{company}|{loc}"
        if phash not in seen_hashes:
            seen_hashes.add(phash)
            deduped.append(p)
    return deduped

async def extract_with_llm(postings: List[Dict]) -> dict:
    if not postings:
        return {"skills": [], "seniorityDistribution": {}, "employmentTypes": {}, "commonResponsibilities": [], "commonQualifications": []}

    payload = ""
    for idx, p in enumerate(postings[:10]):
        payload += f"--- JOB POSTING #{idx + 1} ---\nTitle: {p.get('title')}\nCompany: {p.get('company_name')}\nLocation: {p.get('location')}\nDescription Snippet: {p.get('description', '')[:800]}\n\n"

    prompt = f"""
    Please analyze the following {min(len(postings), 10)} job postings and extract structured skill, seniority, responsibility, and qualification data.
    Respond strictly in JSON format with keys:
    - skills (list of objects with name, category, priority (must-have/nice-to-have))
    - seniorityDistribution (dict of strings to numbers)
    - employmentTypes (dict of strings to numbers)
    - commonResponsibilities (list of strings)
    - commonQualifications (list of strings)
    - coverage (string: high, medium, or low)
    
    Postings:
    {payload}
    """
    
    llm = get_llm()
    response = await llm.ainvoke(prompt)
    content = str(response.content).strip()
    if content.startswith("```json"): content = content[7:]
    if content.startswith("```"): content = content[3:]
    if content.endswith("```"): content = content[:-3]
    content = content.strip()
    
    try:
        return json.loads(content)
    except Exception as e:
        logger.error(f"[JobIntelligence] Failed to parse LLM response: {e}")
        return {"skills": [], "seniorityDistribution": {}, "employmentTypes": {}, "commonResponsibilities": [], "commonQualifications": []}


@router.post("/api/agents/job-intelligence", dependencies=[Depends(verify_token)])
async def get_job_intelligence(req: JobIntelligenceRequest):
    company = req.company or ""
    role = req.role
    location = req.location

    cache_key = f"{company.strip().lower()}|{role.strip().lower()}|{location.strip().lower()}"
    
    db = None
    try:
        db = get_db()
    except Exception as e:
        logger.warning(f"Could not connect to MongoDB: {e}")
        
    if not req.forceRefresh and db is not None:
        try:
            cached_doc = db.job_intelligence_profiles.find_one({"normalizedQueryKey": cache_key})
            if cached_doc:
                expires_at = cached_doc.get("expiresAt")
                # Handle string dates or datetime objects
                if isinstance(expires_at, str):
                    expires_at = datetime.fromisoformat(expires_at)
                if expires_at and expires_at > datetime.utcnow():
                    # Remove the internal _id before returning
                    cached_doc.pop("_id", None)
                    return {"success": True, "data": cached_doc}
        except Exception as e:
            logger.warning(f"Failed to read from MongoDB cache: {e}")
            
    query = f"{company} {role}".strip()
    raw_data = fetch_google_jobs(query, location)
    postings = raw_data.get("jobs_results", [])
    
    is_fallback = False
    fallback_reason = None
    if not postings and company:
        is_fallback = True
        fallback_reason = f"No specific job postings found for company {company}. Broader market results retrieved."
        query = role
        raw_data = fetch_google_jobs(query, location)
        postings = raw_data.get("jobs_results", [])

    deduped = deduplicate_jobs(postings)
    llm_result = await extract_with_llm(deduped)
    
    profile_data = {
        "company": company or "General",
        "role": role,
        "location": location,
        "isFallback": is_fallback,
        "fallbackReason": fallback_reason,
        "coverage": llm_result.get("coverage", "medium"),
        "postingsCount": len(postings),
        "analyzedPostingsCount": len(deduped),
        "skills": llm_result.get("skills", []),
        "seniorityDistribution": llm_result.get("seniorityDistribution", {}),
        "employmentTypes": llm_result.get("employmentTypes", {}),
        "commonResponsibilities": llm_result.get("commonResponsibilities", []),
        "commonQualifications": llm_result.get("commonQualifications", []),
        "fetchedAt": datetime.utcnow().isoformat(),
        "expiresAt": (datetime.utcnow() + timedelta(days=7)).isoformat()
    }
    
    if db is not None:
        try:
            db.job_intelligence_profiles.update_one(
                {"normalizedQueryKey": cache_key},
                {"$set": profile_data},
                upsert=True
            )
        except Exception as e:
            logger.error(f"Failed to save job intelligence to MongoDB: {e}")
            
    return {"success": True, "data": profile_data}

@router.post("/api/agents/job-intelligence/raw-search", dependencies=[Depends(verify_token)])
async def get_raw_job_search(req: JobIntelligenceRequest):
    company = req.company or ""
    query = f"{company} {req.role}".strip()
    raw_data = fetch_google_jobs(query, req.location)
    return {"success": True, "data": raw_data}
