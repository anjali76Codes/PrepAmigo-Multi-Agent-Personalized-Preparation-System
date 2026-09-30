import asyncio

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command

from agents.interview_prep_orchestrator import (
    MAX_CLARIFICATION_ROUNDS,
    InterviewPrepOrchestrator,
    route_after_prepare,
)
from graph.state import AgentState


def test_prepare_requests_only_missing_fields_without_running_agents():
    node = InterviewPrepOrchestrator(company_graph=object(), job_agent=object())
    result = asyncio.run(node.prepare({"workflow_input": {"company": " Acme "}}))

    assert result["workflow_status"] == "awaiting_input"
    assert result["interview_prep_input"]["company"] == "Acme"
    assert result["workflow_question"]["missing_fields"] == ["role", "location"]
    assert route_after_prepare(result) == "pause"


def test_parallel_branches_start_together_and_merge_to_distinct_results():
    async def run():
        started = 0
        both_started = asyncio.Event()

        async def mark_started():
            nonlocal started
            started += 1
            if started == 2:
                both_started.set()
            await asyncio.wait_for(both_started.wait(), timeout=1)

        class CompanyGraph:
            async def ainvoke(self, _inputs, config):
                assert config["recursion_limit"] == 12
                await mark_started()
                return {
                    "messages": [],
                    "task_context": {"company_profile": {"name": "Acme", "description": "Builds tools"}},
                }

        class JobAgent:
            async def __call__(self, _state):
                await mark_started()
                return {"job_intelligence_result": {"status": "success", "data": {"skills": []}}}

        node = InterviewPrepOrchestrator(CompanyGraph(), JobAgent())
        return await node.run_parallel({
            "interview_prep_input": {"company": "Acme", "role": "Engineer", "location": "Remote"}
        })

    result = asyncio.run(run())

    assert result["company_research_result"]["status"] == "success"
    assert result["job_intelligence_result"]["status"] == "success"


def test_failed_company_branch_preserves_job_intelligence_result():
    async def run():
        class CompanyGraph:
            async def ainvoke(self, _inputs, config):
                raise TimeoutError("private timeout details")

        class JobAgent:
            async def __call__(self, _state):
                return {"job_intelligence_result": {"status": "success", "data": {"skills": ["Python"]}}}

        node = InterviewPrepOrchestrator(CompanyGraph(), JobAgent())
        return await node.run_parallel({
            "interview_prep_input": {"company": "Acme", "role": "Engineer", "location": "Remote"}
        })

    result = asyncio.run(run())

    assert result["company_research_result"]["status"] == "failed"
    assert result["company_research_result"]["error"] == "Company research is temporarily unavailable."
    assert result["job_intelligence_result"]["status"] == "success"


def test_interrupt_resumes_on_the_same_checkpointed_thread():
    async def run():
        node = InterviewPrepOrchestrator(company_graph=object(), job_agent=object())
        graph = StateGraph(AgentState)
        graph.add_node("prepare", node.prepare)
        graph.add_node("pause", node.pause_for_input)
        graph.add_node("done", lambda _state: {"workflow_status": "ready"})
        graph.add_edge(START, "prepare")
        graph.add_conditional_edges("prepare", route_after_prepare, {
            "pause": "pause",
            "run": "done",
            "stop": END,
        })
        graph.add_edge("pause", "prepare")
        compiled = graph.compile(checkpointer=MemorySaver())
        config = {"configurable": {"thread_id": "resume-test"}}

        paused = await compiled.ainvoke({"workflow_input": {"company": "Acme"}}, config=config)
        resumed = await compiled.ainvoke(
            Command(resume={"role": "Engineer", "location": "Remote"}),
            config=config,
        )
        return paused, resumed

    paused, resumed = asyncio.run(run())

    assert paused["workflow_status"] == "awaiting_input"
    assert paused["__interrupt__"][0].value["missing_fields"] == ["role", "location"]
    assert resumed["workflow_status"] == "ready"


def test_clarification_cap_stops_repeatedly_incomplete_requests():
    node = InterviewPrepOrchestrator(company_graph=object(), job_agent=object())
    state = {
        "workflow_input": {"company": "Acme"},
        "interview_prep_input": {"company": "Acme", "role": "", "location": ""},
        "workflow_clarification_rounds": MAX_CLARIFICATION_ROUNDS,
    }

    result = asyncio.run(node.prepare(state))

    assert result["workflow_status"] == "needs_restart"
    assert route_after_prepare(result) == "stop"


def test_react_can_pause_for_result_ambiguity(monkeypatch):
    class FakeLLM:
        async def ainvoke(self, _prompt, config=None):
            return type("Response", (), {
                "content": '{"action":"clarify","summary":"Need one detail.","question":"Is this role remote or hybrid?"}'
            })()

    monkeypatch.setattr("agents.interview_prep_orchestrator.get_llm", lambda temperature: FakeLLM())
    node = InterviewPrepOrchestrator(company_graph=object(), job_agent=object())
    state = {
        "company_research_result": {"status": "success", "data": {"profile": {"name": "Acme"}}},
        "job_intelligence_result": {"status": "partial", "data": {"skills": []}},
    }

    result = asyncio.run(node.evaluate(state))

    assert result["workflow_status"] == "awaiting_input"
    assert result["workflow_question"]["reason"] == "result_clarification"
    assert route_after_prepare(result) == "pause"


def test_free_text_clarification_merges_with_existing_structured_fields(monkeypatch):
    node = InterviewPrepOrchestrator(company_graph=object(), job_agent=object())

    async def fake_extract(_state, text=None):
        assert text == "I meant a platform engineering role."
        return {"role": "Platform Engineer"}

    monkeypatch.setattr(node, "_extract_fields", fake_extract)
    result = asyncio.run(node.prepare({
        "interview_prep_input": {"company": "Acme", "role": "Engineer", "location": "Remote"},
        "workflow_resume_input": {
            "answer": "I meant a platform engineering role.",
            "location": "Remote",
        },
    }))

    assert result["interview_prep_input"] == {
        "company": "Acme",
        "role": "Platform Engineer",
        "location": "Remote",
    }
    assert result["workflow_status"] == "running"