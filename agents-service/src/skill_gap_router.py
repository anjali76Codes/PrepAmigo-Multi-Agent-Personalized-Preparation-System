import json
import logging
import io
from datetime import datetime
from typing import Any, List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field

import pymongo

from config import settings, get_llm
from auth import verify_token

logger = logging.getLogger(__name__)

router = APIRouter()

# MongoDB setup (lazy initialization)
_mongo_client = None
def get_db():
    global _mongo_client
    if not _mongo_client:
        mongo_uri = settings.mem0_qdrant_url or "mongodb://localhost:27017" # using whatever config, defaulting to local
        # If user has a specific MONGO_URI, we'd use os.getenv("MONGO_URI", "mongodb://localhost:27017")
        import os
        mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        _mongo_client = pymongo.MongoClient(mongo_uri)
    return _mongo_client["prepamigo"]

# ----------------- PDF / DOCX Parsing -----------------
def extract_text_from_pdf(file_bytes: bytes) -> str:
    import pypdf
    reader = pypdf.PdfReader(io.BytesIO(file_bytes))
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
    return text

def extract_text_from_docx(file_bytes: bytes) -> str:
    import docx
    doc = docx.Document(io.BytesIO(file_bytes))
    text = "\n".join([para.text for para in doc.paragraphs])
    return text

def parse_resume(file: UploadFile, file_bytes: bytes) -> str:
    filename = (file.filename or "").lower()
    if filename.endswith(".pdf") or file.content_type == "application/pdf":
        return extract_text_from_pdf(file_bytes)
    elif filename.endswith(".docx") or file.content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return extract_text_from_docx(file_bytes)
    else:
        raise ValueError("Unsupported file format. Please upload a PDF or DOCX file.")


# ----------------- SerpApi Helper -----------------
_serpapi_cache = {}

def search_unfamiliar_skill(skill: str) -> str:
    if skill in _serpapi_cache:
        return _serpapi_cache[skill]
    
    if not settings.serpapi_api_key:
        return "No API key"

    try:
        from serpapi import GoogleSearch  # type: ignore
        params = {
            "engine": "google",
            "q": f"what is {skill} technology",
            "api_key": settings.serpapi_api_key,
            "num": 3
        }
        result = GoogleSearch(params).get_dict()
        snippets = [res.get("snippet", "") for res in result.get("organic_results", [])[:3]]
        info = " ".join(snippets)
        _serpapi_cache[skill] = info
        return info
    except Exception as exc:
        logger.warning(f"Failed to search skill {skill}: {exc}")
        return ""


# ----------------- Schema Definitions -----------------
class ProfileSchema(BaseModel):
    skills: List[str] = Field(description="List of skills explicitly stated in the resume.")
    projects: List[Dict[str, str]] = Field(description="List of projects with 'title', 'description', and 'technologies' keys.")
    experience: List[Dict[str, str]] = Field(description="List of experiences with 'role', 'company', and 'description' keys.")
    education: List[Dict[str, str]] = Field(description="List of education entries with 'degree' and 'institution' keys.")

class GapReportSchema(BaseModel):
    skill_evaluations: List[Dict[str, str]] = Field(
        description="For each required skill, evaluate it. Keys: 'skill_name', 'status' (strong, partial, missing), 'evidence' (one-line string from resume, or empty if missing)."
    )
    extra_skills: List[str] = Field(description="Skills the candidate has that aren't required by the role.")


# ----------------- LLM Helpers -----------------
async def build_candidate_profile(resume_text: str) -> dict:
    prompt = f"""
    Extract the candidate's profile from the following resume text.
    Include only what is explicitly stated, never infer skills.
    
    Return strictly JSON matching this structure:
    {{
        "skills": ["skill1", "skill2"],
        "projects": [{{"title": "Proj", "description": "Desc", "technologies": "Tech"}}],
        "experience": [{{"role": "Role", "company": "Co", "description": "Desc"}}],
        "education": [{{"degree": "Deg", "institution": "Inst"}}]
    }}
    
    Resume Text:
    {resume_text}
    """
    
    llm = get_llm()
    
    # Try twice
    for attempt in range(2):
        try:
            response = await llm.ainvoke(prompt)
            content = str(response.content).strip()
            if content.startswith("```json"): content = content[7:]
            if content.startswith("```"): content = content[3:]
            if content.endswith("```"): content = content[:-3]
            
            data = json.loads(content.strip())
            return data
        except Exception as e:
            if attempt == 1:
                logger.error(f"Failed to parse LLM profile after 2 attempts: {e}")
                return {"skills": [], "projects": [], "experience": [], "education": []}
            prompt += f"\n\nPrevious attempt failed with error: {e}. Please ensure valid JSON."

    return {"skills": [], "projects": [], "experience": [], "education": []}

async def evaluate_gaps(candidate_profile: dict, job_requirements: List[dict]) -> dict:
    required_skills = [s.get("name", s.get("normalizedName", "")) for s in job_requirements]
    
    prompt = f"""
    Compare the following required skills against the candidate's profile.
    
    Required Skills: {json.dumps(required_skills)}
    
    Candidate Profile: {json.dumps(candidate_profile)}
    
    Rules:
    1. Mark each required skill as 'strong', 'partial', or 'missing'.
    2. Provide a one-line 'evidence' string from the resume (or empty if missing).
    3. A skill that is only listed in skills but has no project or experience behind it is 'partial' at most.
    4. Skills the candidate has that aren't required are 'extra_skills'.
    
    Return strictly JSON matching this structure:
    {{
        "skill_evaluations": [
            {{"skill_name": "skill", "status": "strong|partial|missing", "evidence": "found in project X"}}
        ],
        "extra_skills": ["extra1", "extra2"]
    }}
    """
    
    llm = get_llm()
    
    for attempt in range(2):
        try:
            response = await llm.ainvoke(prompt)
            content = str(response.content).strip()
            if content.startswith("```json"): content = content[7:]
            if content.startswith("```"): content = content[3:]
            if content.endswith("```"): content = content[:-3]
            
            data = json.loads(content.strip())
            return data
        except Exception as e:
            if attempt == 1:
                logger.error(f"Failed to parse LLM gap evaluation after 2 attempts: {e}")
                return {"skill_evaluations": [], "extra_skills": []}
            prompt += f"\n\nPrevious attempt failed with error: {e}. Please ensure valid JSON."

    return {"skill_evaluations": [], "extra_skills": []}


# ----------------- Router -----------------
@router.post("/api/agents/skill-gap", dependencies=[Depends(verify_token)])
async def analyze_skill_gap(
    resume: UploadFile = File(...),
    job_intelligence_data: str = Form(...)
):
    try:
        job_data = json.loads(job_intelligence_data)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid job_intelligence_data JSON.")

    required_skills_info = job_data.get("skills", [])
    coverage = job_data.get("coverage", "none")

    # Read and parse file
    try:
        file_bytes = await resume.read()
        resume_text = parse_resume(resume, file_bytes)
    except Exception as e:
        logger.error(f"Resume parsing error: {e}")
        raise HTTPException(status_code=400, detail=f"Could not read resume: {str(e)}")

    if not resume_text.strip():
        raise HTTPException(status_code=400, detail="Resume text is empty after parsing.")

    # 1. Build Profile
    candidate_profile = await build_candidate_profile(resume_text)

    # Search up to 3 unfamiliar skills if any (simple heuristic: if a required skill is not in candidate skills, check it)
    cand_skill_names = [s.lower() for s in candidate_profile.get("skills", [])]
    searches_made = 0
    for req_s in required_skills_info:
        name = req_s.get("name", "").lower()
        if name and name not in cand_skill_names and searches_made < 3:
            search_unfamiliar_skill(name)
            searches_made += 1

    # 2. Evaluate Gaps
    gap_evaluation = await evaluate_gaps(candidate_profile, required_skills_info)
    evaluations = gap_evaluation.get("skill_evaluations", [])

    # 3. Rank Gaps in Code
    matched_skills = []
    partial_skills = []
    missing_skills = []
    
    # Map required skill info for frequency
    freq_map = {s.get("name", ""): s.get("frequency", 0) for s in required_skills_info}
    
    for ev in evaluations:
        status = ev.get("status", "missing")
        if status == "strong":
            matched_skills.append(ev)
        elif status == "partial":
            partial_skills.append(ev)
        else:
            missing_skills.append(ev)

    # Sort gaps: missing above partial, then by frequency descending
    def gap_sort_key(ev):
        status_score = 0 if ev.get("status") == "missing" else 1
        freq = freq_map.get(ev.get("skill_name"), 0)
        return (status_score, -freq)

    all_gaps = missing_skills + partial_skills
    all_gaps.sort(key=gap_sort_key)

    priority_gaps = []
    for g in all_gaps:
        status = g.get("status", "missing")
        effort = "High" if status == "missing" else "Medium"
        priority_gaps.append({
            "skill": g.get("skill_name", ""),
            "status": status,
            "frequency": freq_map.get(g.get("skill_name", ""), 0),
            "effort": effort,
            "evidence": g.get("evidence", "")
        })

    extra_skills = gap_evaluation.get("extra_skills", [])

    # Readiness Score (0-100)
    total_required = len(required_skills_info)
    if total_required == 0:
        readiness_score = 100
    else:
        score = (len(matched_skills) * 1.0 + len(partial_skills) * 0.5) / total_required
        readiness_score = int(min(100, max(0, score * 100)))

    # Store in MongoDB
    try:
        db = get_db()
        db.skill_gap_reports.insert_one({
            "timestamp": datetime.utcnow(),
            "resume_text": resume_text, # As requested to store
            "candidate_profile": candidate_profile,
            "gap_report": {
                "matched_skills": matched_skills,
                "partial_skills": partial_skills,
                "missing_skills": missing_skills,
                "extra_skills": extra_skills,
                "priority_gaps": priority_gaps,
                "readiness_score": readiness_score,
                "coverage": coverage
            }
        })
    except Exception as e:
        logger.error(f"Failed to store report in MongoDB: {e}")
        # non-fatal

    return {
        "matched_skills": matched_skills,
        "partial_skills": partial_skills,
        "missing_skills": missing_skills,
        "extra_skills": extra_skills,
        "priority_gaps": priority_gaps,
        "readiness_score": readiness_score,
        "coverage": coverage
    }
