import asyncio

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from agents.job_intelligence_agent import (
    JobIntelligenceInput,
    fetch_google_jobs,
    get_job_intelligence_profile,
)
from core.auth import verify_token

router = APIRouter()


class JobIntelligenceRequest(BaseModel):
    company: str = Field(default="", max_length=200)
    role: str = Field(min_length=1, max_length=200)
    location: str = Field(min_length=1, max_length=200)
    forceRefresh: bool = False


@router.post("/api/agents/job-intelligence", dependencies=[Depends(verify_token)])
async def get_job_intelligence(req: JobIntelligenceRequest):
    request = JobIntelligenceInput(
        company=req.company,
        role=req.role,
        location=req.location,
        force_refresh=req.forceRefresh,
    )
    profile = await get_job_intelligence_profile(request)
    return {"success": True, "data": profile}


@router.post("/api/agents/job-intelligence/raw-search", dependencies=[Depends(verify_token)])
async def get_raw_job_search(req: JobIntelligenceRequest):
    query = f"{req.company} {req.role}".strip()
    raw_data = await asyncio.to_thread(fetch_google_jobs, query, req.location)
    return {"success": True, "data": raw_data}
