"""
Skill Gap Agent
---------------
Analyzes a candidate's resume against job requirements (from JobIntelligenceAgent)
and company profile (from CompanyResearchAgent) to identify and rank skill gaps.

Pipeline (one LLM call + pure Python scoring):
  evaluate_resume  → the model reads the resume and returns one verdict per
                     required skill: strong / partial / missing + a short
                     evidence phrase. Nothing else is generated.
  rank_and_score   → pure Python: sorts gaps by priority, computes readiness

One call, small output. It used to be two: the first rewrote the whole
resume as JSON (2,000+ output tokens, 67s on a slow day) only to feed the
second, which then ran out of the stage's time budget and returned nothing.
Output is now ~25 tokens per required skill, and the skills compared are
capped (SKILL_GAP_MAX_SKILLS, must-have first), so the call's size does not
grow with the resume or the posting count.

If the model is unavailable, late or unparseable, the verdicts come from
the resume text itself (a required skill named in it is "partial", one that
is not is "missing"): a rougher answer, flagged as
evaluation_source="resume_text", instead of no gaps and no plan.

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
import asyncio
import difflib
import json
import logging
import re
from typing import Any

from agents.company_brief import company_focus
from config import get_llm, settings
from graph.events import INTERNAL_LLM_CONFIG, emit_to_graph_stream, make_event
from observability.timing import log_failure
from storage.llm_cache import forget_response
from tools.plan_builder import parse_json_object
from tools.relevance import relevance

logger = logging.getLogger(__name__)

AGENT_NAME = "skill_gap"


RESUME_PROMPT_CHARS = 12_000  # ~3,000 tokens: bounds the prompt for very long resumes
EVIDENCE_WORDS = 12
VALID_STATUSES = {"strong", "partial", "missing"}


# ---------------------------------------------------------------------------
# LLM helpers
# ---------------------------------------------------------------------------

async def _call_llm_json(prompt: str, fallback: Any) -> Any:
    """One model call returning parsed JSON, or `fallback` when the call
    fails, times out or does not contain a JSON object."""
    profile = "fast" if settings.skill_gap_llm == "fast" else "default"
    llm = get_llm(temperature=0, max_tokens=settings.skill_gap_max_output_tokens or None, profile=profile)
    response = None
    try:
        response = await asyncio.wait_for(
            llm.ainvoke(prompt, config=INTERNAL_LLM_CONFIG), timeout=settings.skill_gap_llm_timeout_seconds)
        text = re.sub(r"<think>.*?</think>", "", str(response.content), flags=re.S)
        return parse_json_object(text)
    except Exception as exc:
        forget_response(response)  # an unparseable answer must not be replayed from the cache
        log_failure(logger, "Skill gap model call unavailable; falling back to resume-text matching", exc)
        return fallback


def _skill_name(skill: dict) -> str:
    return str(skill.get("name") or skill.get("normalizedName") or "").strip()


def skills_to_evaluate(required_skills: list[dict]) -> list[dict]:
    """The required skills the resume is compared against: named ones only,
    must-have before nice-to-have (each in the postings' own order), capped
    at SKILL_GAP_MAX_SKILLS so the model's output stays small. The plan
    covers at most PLAN_MAX_TOPICS gaps anyway."""
    named, seen = [], set()
    for skill in required_skills:
        key = _skill_name(skill).casefold() if isinstance(skill, dict) else ""
        if key and key not in seen:
            seen.add(key)
            named.append(skill)
    named.sort(key=lambda s: 0 if s.get("priority") == "must_have" else 1)  # stable: keeps posting order
    return named[: settings.skill_gap_max_skills] if settings.skill_gap_max_skills else named


def evaluate_from_resume_text(resume_text: str, required_skills: list[dict]) -> list[dict]:
    """Verdicts without a model: a required skill whose name appears in the
    resume is "partial" (mentioned, depth unverified), one that does not is
    "missing". Never "strong": only reading the evidence can say that."""
    evaluations = []
    for skill in required_skills:
        name = _skill_name(skill)
        mentioned = relevance(name, resume_text) >= 1.0
        evaluations.append({
            "skill_name": name,
            "status": "partial" if mentioned else "missing",
            "evidence": "named in the resume" if mentioned else "",
        })
    return evaluations


async def _evaluate_resume(
    resume_text: str,
    required_skills: list[dict],
    company: str,
    role: str,
    company_profile: dict,
) -> tuple[list[dict], str]:
    """One verdict per required skill, and where the verdicts came from:
    "llm", "llm+resume_text" (the model skipped some skills) or
    "resume_text" (no usable model answer)."""
    names = [_skill_name(s) for s in required_skills]
    company_context = ""
    if company_profile.get("description"):
        company_context = f"\nCompany context ({company}): {company_profile['description'][:400]}"
    # the company brief (direct company research), when there is one: what
    # this company actually builds with, so evidence is judged against it
    brief_line = company_focus(company_profile)
    if brief_line:
        company_context += f"\n{brief_line}"

    prompt = f"""You are screening a resume for a {role} role at {company}.{company_context}

Required skills: {json.dumps(names)}

For EACH required skill, judge the resume:
- "strong": used in a project or job described in the resume.
- "partial": only listed, or closely related experience without the skill itself.
- "missing": not in the resume. Never infer a skill that is not written there.

Return ONLY a JSON object, no prose, no markdown, with exactly one entry per required skill, using the
skill names exactly as given, and an evidence phrase of at most {EVIDENCE_WORDS} words ("" when missing):
{{"evaluations": [{{"skill": "<name>", "status": "strong|partial|missing", "evidence": "<short phrase>"}}]}}

Resume:
{resume_text[:RESUME_PROMPT_CHARS]}"""

    answer = await _call_llm_json(prompt, None)
    by_name: dict[str, dict] = {}
    for entry in (answer or {}).get("evaluations") or []:
        if not isinstance(entry, dict):
            continue
        key = str(entry.get("skill") or entry.get("skill_name") or "").strip().casefold()
        status = str(entry.get("status", "")).strip().lower()
        # a slightly reworded name ("REST API" for "REST APIs") still counts
        lowered = [n.casefold() for n in names]
        match = key if key in lowered else next(iter(difflib.get_close_matches(key, lowered, n=1, cutoff=0.8)), "")
        if match and status in VALID_STATUSES and match not in by_name:
            evidence = " ".join(str(entry.get("evidence") or "").split()[: EVIDENCE_WORDS * 2])
            by_name[match] = {"status": status, "evidence": evidence}

    # any skill the model left out is judged from the resume text, so every
    # required skill always has a verdict
    text_verdicts = {e["skill_name"].casefold(): e for e in evaluate_from_resume_text(resume_text, required_skills)}
    evaluations = [
        {"skill_name": name, **by_name[name.casefold()]} if name.casefold() in by_name else text_verdicts[name.casefold()]
        for name in names
    ]
    source = "resume_text" if not by_name else ("llm" if len(by_name) == len(names) else "llm+resume_text")
    return evaluations, source


def _rank_and_score(gap_evaluation: dict, required_skills: list[dict]) -> dict:
    """Step 3: pure Python — rank gaps by priority, compute readiness score."""
    # only skills the job actually requires can be gaps: the model also
    # grades skills it found on the resume, which must never become "gaps"
    required = {
        str(s.get("name") or s.get("normalizedName") or "").strip().casefold() for s in required_skills
    } - {""}
    evaluations, seen = [], set()
    for ev in gap_evaluation.get("skill_evaluations", []):
        key = str(ev.get("skill_name", "")).strip().casefold() if isinstance(ev, dict) else ""
        # a slightly reworded name ("REST API" for "REST APIs") still counts
        match = key if key in required else next(iter(difflib.get_close_matches(key, required, n=1, cutoff=0.8)), "")
        if match and match not in seen:
            seen.add(match)
            evaluations.append(ev)
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

    must_have = {_skill_name(s) for s in required_skills if s.get("priority") == "must_have"}

    def _sort_key(ev: dict) -> tuple:
        # missing > partial; within each, must-have skills first, then the
        # ones more postings ask for
        name = ev.get("skill_name", "")
        return (0 if ev.get("status") == "missing" else 1, 0 if name in must_have else 1, -freq_map.get(name, 0))

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

        # No requirements to compare against (job intelligence failed or
        # timed out): stop here. Asked to grade against an empty list, the
        # model grades the resume's own skills, and the plan then "teaches"
        # what the candidate already listed.
        if not [s for s in job_intelligence.get("skills") or [] if isinstance(s, dict) and s.get("name")]:
            message = "No job requirements available — skill gap analysis skipped."
            emit_to_graph_stream(
                make_event(AGENT_NAME, "analyze_skill_gap", "failed", {"message": message, "error": message})
            )
            return {
                "no_resume": False,
                "no_requirements": True,
                "error": message,
                "matched_skills": [],
                "partial_skills": [],
                "missing_skills": [],
                "extra_skills": [],
                "priority_gaps": [],
                "readiness_score": 0,
                "coverage": "none",
            }

        # Step 1 — one model call: a verdict per required skill
        required_skills = skills_to_evaluate(job_intelligence.get("skills") or [])
        emit_to_graph_stream(
            make_event(
                AGENT_NAME,
                "evaluate_gaps",
                "running",
                {
                    "message": (
                        f"Comparing the resume against {len(required_skills)} required skills "
                        f"for {role} at {company}..."
                    )
                },
            )
        )
        evaluations, source = await _evaluate_resume(resume_text, required_skills, company, role, company_profile)
        gap_evaluation = {"skill_evaluations": evaluations, "extra_skills": []}

        # Step 3 — rank and score (pure Python)
        report = _rank_and_score(gap_evaluation, required_skills)
        report["evaluation_source"] = source
        report["skills_evaluated"] = len(required_skills)
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
