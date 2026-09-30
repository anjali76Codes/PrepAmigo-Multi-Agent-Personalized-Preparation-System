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
    async def fake_extraction(_postings):
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
        lambda _query, _location: {"jobs_results": [{"title": "Engineer", "company_name": "Acme"}]},
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
    assert database.job_intelligence_profiles.saved[1] is True


def test_job_intelligence_input_rejects_missing_required_fields():
    with pytest.raises(ValidationError):
        job_intelligence.JobIntelligenceInput(role="Engineer")


def test_job_intelligence_node_returns_partial_for_empty_search(monkeypatch):
    async def fake_profile(_request):
        return {"analyzedPostingsCount": 0}

    monkeypatch.setattr(job_intelligence, "get_job_intelligence_profile", fake_profile)
    result = __import__("asyncio").run(job_intelligence.JobIntelligenceAgent()({
        "job_intelligence_input": {"role": "Engineer", "location": "Remote"}
    }))

    assert result["job_intelligence_result"]["status"] == "partial"