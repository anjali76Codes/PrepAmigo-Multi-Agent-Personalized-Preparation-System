import asyncio

from agents import interview_prep_fields as fields
from agents.interview_prep_orchestrator import InterviewPrepOrchestrator


def test_default_fields_route_to_declared_agents():
    normalized = fields.normalize_workflow_fields({
        "company": " Acme ",
        "role": "Engineer",
        "location": "Remote",
        "ignored": "not configured",
    })

    assert fields.fields_for_agent(normalized, "company_research") == {"company": "Acme", "role": "Engineer"}
    assert fields.fields_for_agent(normalized, "job_intelligence") == {
        "company": "Acme", "role": "Engineer", "location": "Remote"
    }
    assert fields.missing_required_fields(normalized) == []


def test_adding_a_field_in_one_definition_drives_clarification_and_routing(monkeypatch):
    extra_field = fields.WorkflowField(
        name="seniority",
        label="Seniority level",
        description="The level of the target role.",
        required=True,
        recipients=("job_intelligence",),
    )
    monkeypatch.setattr(fields, "WORKFLOW_FIELDS", (*fields.WORKFLOW_FIELDS, extra_field))
    node = InterviewPrepOrchestrator(company_graph=object(), job_agent=object())
    result = asyncio.run(node.prepare({
        "workflow_input": {"company": "Acme", "role": "Engineer", "location": "Remote"}
    }))

    assert result["workflow_status"] == "awaiting_input"
    assert result["workflow_question"]["missing_fields"] == ["seniority"]
    assert result["workflow_question"]["field_labels"] == ["Seniority level"]
    assert fields.fields_for_agent(result["interview_prep_input"], "job_intelligence")["location"] == "Remote"


def test_location_only_gets_a_direct_question_for_company_and_role():
    node = InterviewPrepOrchestrator(company_graph=object(), job_agent=object())
    result = asyncio.run(node.prepare({"workflow_input": {"location": "Seattle"}}))

    assert result["workflow_question"]["question"] == "Which company and role are you targeting in Seattle?"


def test_sentence_input_is_extracted_then_asks_for_only_missing_company(monkeypatch):
    node = InterviewPrepOrchestrator(company_graph=object(), job_agent=object())

    async def extract(_state, text=None):
        assert text == "I am looking for an SDE role in Seattle."
        return {"role": "SDE", "location": "Seattle"}

    monkeypatch.setattr(node, "_extract_fields", extract)
    result = asyncio.run(node.prepare({
        "workflow_input": {},
        "workflow_text_input": "I am looking for an SDE role in Seattle.",
    }))

    assert result["interview_prep_input"] == {"company": "", "role": "SDE", "location": "Seattle"}
    assert result["workflow_question"]["question"] == "Do you have a specific company in mind for the SDE role in Seattle?"


def test_clarification_reply_is_interpreted_and_preserves_prior_fields(monkeypatch):
    node = InterviewPrepOrchestrator(company_graph=object(), job_agent=object())

    async def extract(_state, text=None):
        assert text == "Acme"
        return {"company": "Acme"}

    monkeypatch.setattr(node, "_extract_fields", extract)
    result = asyncio.run(node.prepare({
        "interview_prep_input": {"company": "", "role": "SDE", "location": "Seattle"},
        "workflow_resume_input": {"answer": "Acme"},
    }))

    assert result["interview_prep_input"] == {"company": "Acme", "role": "SDE", "location": "Seattle"}
    assert result["workflow_status"] == "running"