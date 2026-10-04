import json
import logging
import io
from datetime import datetime
from typing import Any, List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field

import pymongo

from core.config import settings, get_llm
from core.auth import verify_token
from schemas.api import SuccessResponse

logger = logging.getLogger(__name__)

router = APIRouter()

# MongoDB setup (lazy initialization — only used when MONGO_ENABLED=true)
_mongo_client = None

def get_db():
    global _mongo_client
    if not _mongo_client:
        _mongo_client = pymongo.MongoClient(settings.mongo_uri)
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


# Removed SerpApi Helper per user request to improve performance


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
@router.post(
    "/api/agents/skill-gap",
    response_model=SuccessResponse,
    dependencies=[Depends(verify_token)],
    summary="Analyze candidate resume against job intelligence to identify skill gaps",
)
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

    # Store in MongoDB only when explicitly enabled via MONGO_ENABLED=true
    if settings.mongo_enabled:
        try:
            db = get_db()
            db.skill_gap_reports.insert_one({
                "timestamp": datetime.utcnow(),
                "resume_text": resume_text,
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
            logger.error("Failed to store skill-gap report in MongoDB: %s", e)
            # non-fatal: the response is returned regardless

    report_data = {
        "matched_skills": matched_skills,
        "partial_skills": partial_skills,
        "missing_skills": missing_skills,
        "extra_skills": extra_skills,
        "priority_gaps": priority_gaps,
        "readiness_score": readiness_score,
        "coverage": coverage,
    }
    return SuccessResponse(data=report_data)
