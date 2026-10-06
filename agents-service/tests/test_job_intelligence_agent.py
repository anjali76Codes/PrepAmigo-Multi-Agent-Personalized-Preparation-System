import pytest
from pydantic import ValidationError

from agents import job_intelligence_agent as job_intelligence


class FakeCollection:
    def __init__(self):
        self.saved = None

    def find_one(self, _query):
        return None

    def update_one(self, _query, update, upsert=False):
        self.saved = (update["$set"], upsert)


class FakeDatabase:
    def __init__(self):
        self.job_intelligence_profiles = FakeCollection()


def test_job_intelligence_profile_uses_validated_node_service(monkeypatch):
    async def fake_extraction(_postings, **_kwargs):
        return {
            "skills": [{"name": "Python", "category": "Languages", "priority": "must-have"}],
            "seniorityDistribution": {"senior": 1},
            "employmentTypes": {"full-time": 1},
            "commonResponsibilities": ["Build services"],
            "commonQualifications": ["Python experience"],
            "coverage": "high",
        }

    monkeypatch.setattr(
        job_intelligence,
        "fetch_google_jobs",
        lambda query=None, location=None, **kwargs: {"jobs_results": [{"title": "Engineer", "company_name": "Acme"}]},
    )
    monkeypatch.setattr(job_intelligence, "extract_with_llm", fake_extraction)
    database = FakeDatabase()

    profile = __import__("asyncio").run(
        job_intelligence.get_job_intelligence_profile(
            job_intelligence.JobIntelligenceInput(company="Acme", role="Engineer", location="Remote"),
            database=database,
        )
    )

    assert profile["normalizedQueryKey"] == "acme|engineer|remote"
    assert profile["analyzedPostingsCount"] == 1
    assert profile["skills"][0]["name"] == "Python"


def test_job_intelligence_input_rejects_missing_required_fields():
    with pytest.raises(ValidationError):
        job_intelligence.JobIntelligenceInput(role="Engineer")


def test_job_intelligence_node_returns_partial_for_empty_search(monkeypatch):
    async def fake_profile(_request, **_kwargs):
        return {"analyzedPostingsCount": 0}

    monkeypatch.setattr(job_intelligence, "get_job_intelligence_profile", fake_profile)
    result = __import__("asyncio").run(job_intelligence.JobIntelligenceAgent()({
        "job_intelligence_input": {"role": "Engineer", "location": "Remote"}
    }))

    assert result["job_intelligence_result"]["status"] == "partial"

# ---- whose postings are they? ----------------------------------------------------

OTHER_EMPLOYERS = [
    {"title": "Lead Software Engineer - Java Platform Modernization (WebSphere + Axway)", "company_name": "Tential Solutions"},
    {"title": "ServiceNow Software Developer I", "company_name": "Southern New Hampshire University"},
]
OWN = [
    {"title": "Software Development Engineer, S3", "company_name": "Amazon"},
    {"title": "[Remote] SDE, Dedicated Cloud", "company_name": "Amazon Web Services (AWS)"},
    {"title": "SDE", "company_name": "Amazon Inc."},
]


def test_only_the_companys_own_postings_count_as_its_postings():
    found = job_intelligence.postings_from_company(OWN + OTHER_EMPLOYERS + [
        {"title": "Senior Dev / Amazon tooling", "company_name": "Astrix Inc"}], "Amazon")

    assert found == OWN
    assert job_intelligence.postings_from_company(OTHER_EMPLOYERS, "Google") == []


def _profile(monkeypatch, postings, company="Google", company_context=""):
    seen = {"queries": []}

    def search(query, location):
        seen["queries"].append(query)
        return {"jobs_results": postings}

    async def extraction(found, role="", company="", from_company=True, company_context=""):
        seen.update(postings=found, from_company=from_company, company_context=company_context)
        return {"skills": [{"name": "Python"}], "coverage": "medium"}

    monkeypatch.setattr(job_intelligence, "fetch_google_jobs", search)
    monkeypatch.setattr(job_intelligence, "extract_with_llm", extraction)
    profile = __import__("asyncio").run(job_intelligence.get_job_intelligence_profile(
        job_intelligence.JobIntelligenceInput(company=company, role="Software Development Engineer", location="Remote"),
        database=FakeDatabase(), company_context=company_context))
    return profile, seen


def test_other_employers_postings_never_reach_the_model(monkeypatch):
    """A search for Google SDE roles returned ten postings, none from
    Google. Used as requirements they gave WebSphere + Axway; shown as
    "background" they still gave Agile, Git and CI/CD."""
    profile, seen = _profile(monkeypatch, OTHER_EMPLOYERS, company_context="Tech stack: C++, Go, Borg")

    assert seen["postings"] == [] and seen["from_company"] is False
    assert seen["company_context"] == "Tech stack: C++, Go, Borg"  # what it is given instead
    assert profile["isFallback"] and "No postings from Google" in profile["fallbackReason"]
    assert len(seen["queries"]) == 1  # no second, broader search for more of the same


def test_when_the_company_has_postings_the_other_employers_are_dropped(monkeypatch):
    profile, seen = _profile(monkeypatch, OWN[:2] + OTHER_EMPLOYERS, company="Amazon")

    assert seen["from_company"] is True and seen["postings"] == OWN[:2]
    assert profile["analyzedPostingsCount"] == 2 and not profile["isFallback"]


def test_without_company_postings_the_prompt_is_built_from_company_knowledge(monkeypatch):
    prompts = []

    class LLM:
        async def ainvoke(self, prompt, config=None):
            prompts.append(prompt)
            return type("R", (), {"content": '{"skills": [{"name": "Go"}], "coverage": "low"}'})()

    monkeypatch.setattr(job_intelligence, "_llm", lambda: LLM())
    run = __import__("asyncio").run

    known = run(job_intelligence.extract_with_llm([], "SDE", "Google", from_company=False,
                                                  company_context="Tech stack: C++, Go, Borg"))
    own = run(job_intelligence.extract_with_llm(OWN, "SDE", "Amazon", from_company=True))

    assert "What company research found about Google: Tech stack: C++, Go, Borg" in prompts[0]
    assert "core competencies this role is hired and interviewed for come first" in prompts[0]
    assert "every engineer is assumed to know" in prompts[0] and "JOB POSTING" not in prompts[0]
    assert known["coverage"] == "medium"
    assert "are from Amazon" in prompts[1] and "A skill named in a single posting is nice_to_have" in prompts[1]
    assert own["skills"] == [{"name": "Go"}]
