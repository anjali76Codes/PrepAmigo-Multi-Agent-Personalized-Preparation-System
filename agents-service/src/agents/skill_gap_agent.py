"""
Skill Gap Agent
---------------
Analyzes a candidate's resume against job requirements (from JobIntelligenceAgent)
and company profile (from CompanyResearchAgent) to identify and rank skill gaps.

Pipeline (two sequential LLM calls + pure Python scoring):
  extract_candidate_profile → LLM extracts skills, projects, experience from resume
  evaluate_gaps             → LLM compares candidate profile against required skills
  rank_and_score            → Pure Python: sorts gaps by priority, computes readiness score

Not a BaseAgent subclass: this is a fixed sequential pipeline, not a
tool-calling chat loop. Follows ContentResearchAgent's pattern.

Used by InterviewPrepOrchestrator.run_skill_gap() — not registered in the
supervisor routing (not a conversational agent). SkillGapNode wraps it for
the standardized node pattern.

Inputs (read from state/task_context by run_skill_gap):
  task_context["company_profile"]        : dict from CompanyResearchAgent
  task_context["job_intelligence"]       : dict from JobIntelligenceAgent
  task_context["candidate_resume_text"]  : str (optional — graceful if absent)

Outputs (written to state by run_skill_gap):
  task_context["skill_gap"]  : full gap report dict
  state["skill_gaps"]        : list[str] of gap topic names for ContentResearchAgent
"""
import json
import logging
from typing import Any

from config import get_llm
from graph.events import emit_to_graph_stream, make_event

logger = logging.getLogger(__name__)

AGENT_NAME = "skill_gap"


# ---------------------------------------------------------------------------
# LLM helpers
# ---------------------------------------------------------------------------

async def _call_llm_json(prompt: str, fallback: Any) -> Any:
    """Call the LLM, parse JSON reply, retry once on parse failure."""
    llm = get_llm(temperature=0)
    for attempt in range(2):
        try:
            response = await llm.ainvoke(prompt)
            content = str(response.content).strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            return json.loads(content.strip())
        except Exception as exc:
            if attempt == 1:
                logger.error("LLM JSON call failed after 2 attempts: %s", exc)
                return fallback
            prompt += f"\n\nPrevious attempt failed: {exc}. Return valid JSON only, no markdown."
    return fallback


async def _build_candidate_profile(resume_text: str) -> dict:
    """Step 1: extract structured candidate profile from raw resume text."""
    prompt = f"""Extract the candidate's profile from the following resume text.
Include only what is explicitly stated — never infer skills not mentioned.

Return strictly JSON matching this structure (no markdown fences):
{{
    "skills": ["skill1", "skill2"],
    "projects": [{{"title": "Proj", "description": "Desc", "technologies": "Tech"}}],
    "experience": [{{"role": "Role", "company": "Co", "description": "Desc"}}],
    "education": [{{"degree": "Deg", "institution": "Inst"}}]
}}

Resume Text:
{resume_text}"""
    return await _call_llm_json(
        prompt,
        {"skills": [], "projects": [], "experience": [], "education": []},
    )


async def _evaluate_gaps(
    candidate_profile: dict,
    required_skills: list[dict],
    company: str,
    role: str,
    company_profile: dict,
) -> dict:
    """Step 2: compare candidate against required skills, classify each as strong/partial/missing."""
    skill_names = [s.get("name", s.get("normalizedName", "")) for s in required_skills if s.get("name") or s.get("normalizedName")]
    company_context = ""
    if company_profile.get("description"):
        company_context = f"\nCompany Context ({company}): {company_profile['description'][:400]}"

    prompt = f"""You are evaluating a candidate for a {role} role at {company}.{company_context}

Required Skills: {json.dumps(skill_names)}

Candidate Profile: {json.dumps(candidate_profile)}

Rules:
1. Mark each required skill as 'strong', 'partial', or 'missing'.
2. Provide a one-line 'evidence' string from the resume (or empty string if missing).
3. A skill only listed in the skills section but with no project or experience behind it is 'partial' at most.
4. List any skills the candidate has that are not in the required list as 'extra_skills'.

Return strictly JSON (no markdown fences):
{{
    "skill_evaluations": [
        {{"skill_name": "skill", "status": "strong|partial|missing", "evidence": "found in project X"}}
    ],
    "extra_skills": ["extra1", "extra2"]
}}"""
    return await _call_llm_json(
        prompt,
        {"skill_evaluations": [], "extra_skills": []},
    )


def _rank_and_score(gap_evaluation: dict, required_skills: list[dict]) -> dict:
    """Step 3: pure Python — rank gaps by priority, compute readiness score."""
    evaluations = gap_evaluation.get("skill_evaluations", [])
    freq_map = {s.get("name", s.get("normalizedName", "")): s.get("frequency", 0) for s in required_skills}

    matched, partial, missing = [], [], []
    for ev in evaluations:
        status = ev.get("status", "missing")
        if status == "strong":
            matched.append(ev)
        elif status == "partial":
            partial.append(ev)
        else:
            missing.append(ev)

    def _sort_key(ev: dict) -> tuple:
        # missing > partial; within each, higher frequency = higher priority
        return (0 if ev.get("status") == "missing" else 1, -freq_map.get(ev.get("skill_name", ""), 0))

    priority_gaps = [
        {
            "skill": g.get("skill_name", ""),
            "status": g.get("status", "missing"),
            "frequency": freq_map.get(g.get("skill_name", ""), 0),
            "effort": "High" if g.get("status") == "missing" else "Medium",
            "evidence": g.get("evidence", ""),
        }
        for g in sorted(missing + partial, key=_sort_key)
    ]

    total = len(required_skills) or 1
    raw_score = (len(matched) * 1.0 + len(partial) * 0.5) / total
    readiness_score = int(min(100, max(0, raw_score * 100)))
    coverage = "high" if readiness_score >= 70 else ("medium" if readiness_score >= 40 else "low")

    return {
        "no_resume": False,
        "matched_skills": matched,
        "partial_skills": partial,
        "missing_skills": missing,
        "extra_skills": gap_evaluation.get("extra_skills", []),
        "priority_gaps": priority_gaps,
        "readiness_score": readiness_score,
        "coverage": coverage,
    }


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

class SkillGapAgent:
    """
    Analyzes skill gaps between a candidate's resume and job requirements.

    Call analyze() directly (used by InterviewPrepOrchestrator.run_skill_gap).
    The __call__ method is the LangGraph node interface used by SkillGapNode.
    """

    name = AGENT_NAME

    async def analyze(
        self,
        company_profile: dict,
        job_intelligence: dict,
        resume_text: str,
        company: str,
        role: str,
    ) -> dict:
        """
        Run the full gap analysis pipeline.
        Returns the gap report dict.
        If resume_text is empty, returns immediately with no_resume=True.
        """
        if not resume_text or not resume_text.strip():
            emit_to_graph_stream(
                make_event(
                    AGENT_NAME,
                    "analyze_skill_gap",
                    "completed",
                    {
                        "message": "No resume provided — skill gap analysis skipped.",
                        "no_resume": True,
                        "readiness_score": 0,
                        "gaps_count": 0,
                    },
                )
            )
            return {
                "no_resume": True,
                "matched_skills": [],
                "partial_skills": [],
                "missing_skills": [],
                "extra_skills": [],
                "priority_gaps": [],
                "readiness_score": 0,
                "coverage": "none",
            }

        # Step 1 — extract candidate profile from resume
        emit_to_graph_stream(
            make_event(
                AGENT_NAME,
                "extract_candidate_profile",
                "running",
                {"message": "Extracting candidate profile from resume..."},
            )
        )
        candidate_profile = await _build_candidate_profile(resume_text)
        emit_to_graph_stream(
            make_event(
                AGENT_NAME,
                "extract_candidate_profile",
                "completed",
                {
                    "message": (
                        f"Profile extracted: {len(candidate_profile.get('skills', []))} skills, "
                        f"{len(candidate_profile.get('projects', []))} projects."
                    ),
                    "skills_found": len(candidate_profile.get("skills", [])),
                },
            )
        )

        # Step 2 — evaluate gaps against job requirements
        required_skills = job_intelligence.get("skills", [])
        emit_to_graph_stream(
            make_event(
                AGENT_NAME,
                "evaluate_gaps",
                "running",
                {
                    "message": (
                        f"Comparing {len(required_skills)} required skills against candidate profile "
                        f"for {role} at {company}..."
                    )
                },
            )
        )
        gap_evaluation = await _evaluate_gaps(candidate_profile, required_skills, company, role, company_profile)

        # Step 3 — rank and score (pure Python)
        report = _rank_and_score(gap_evaluation, required_skills)
        emit_to_graph_stream(
            make_event(
                AGENT_NAME,
                "analyze_skill_gap",
                "completed",
                {
                    "message": (
                        f"Skill gap analysis complete. Readiness: {report['readiness_score']}%, "
                        f"{len(report['priority_gaps'])} gaps identified."
                    ),
                    "readiness_score": report["readiness_score"],
                    "gaps_count": len(report["priority_gaps"]),
                    "coverage": report["coverage"],
                },
            )
        )
        return report
