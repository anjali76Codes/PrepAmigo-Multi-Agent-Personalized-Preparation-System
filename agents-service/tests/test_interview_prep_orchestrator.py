import asyncio
import json

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command

import agents.interview_prep_orchestrator as orchestrator_module
from agents.interview_prep_orchestrator import (
    MAX_CLARIFICATION_ROUNDS,
    InterviewPrepOrchestrator,
    route_after_prepare,
)
from config import Settings
from graph.state import AgentState


def test_prepare_requests_only_missing_fields_without_running_agents():
    node = InterviewPrepOrchestrator(company_graph=object(), job_agent=object())
    result = asyncio.run(node.prepare({"workflow_input": {"company": " Acme "}}))

    assert result["workflow_status"] == "awaiting_input"
    assert result["interview_prep_input"]["company"] == "Acme"
    assert result["workflow_question"]["missing_fields"] == ["role", "location"]
    assert route_after_prepare(result) == "pause"


def test_parallel_branches_start_together_and_merge_to_distinct_results(monkeypatch):
    """A cloud provider (e.g. openai) genuinely serves concurrent requests,
    so run_parallel should actually gather the two branches there."""
    monkeypatch.setattr(orchestrator_module, "settings", Settings(llm_provider="openai", openai_api_key="k"))

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
                rounds = orchestrator_module.settings.company_research_max_tool_rounds
                assert config["recursion_limit"] == 3 * rounds + 4
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


def test_ollama_provider_runs_branches_one_at_a_time(monkeypatch):
    """A single local Ollama server serializes generation; running both
    branches concurrently there just makes them queue behind each other
    while each branch's own timeout keeps counting down (observed live:
    one branch's LLM call spuriously timed out waiting on the other's turn
    in the queue). For llm_provider=ollama, run_parallel must await each
    branch in turn instead of gathering them."""
    monkeypatch.setattr(orchestrator_module, "settings", Settings(llm_provider="ollama"))

    async def run():
        order = []

        class CompanyGraph:
            async def ainvoke(self, _inputs, config):
                order.append("company_start")
                await asyncio.sleep(0)
                order.append("company_end")
                return {
                    "messages": [],
                    "task_context": {"company_profile": {"name": "Acme", "description": "Builds tools"}},
                }

        class JobAgent:
            async def __call__(self, _state):
                order.append("job_start")
                await asyncio.sleep(0)
                order.append("job_end")
                return {"job_intelligence_result": {"status": "success", "data": {"skills": []}}}

        node = InterviewPrepOrchestrator(CompanyGraph(), JobAgent())
        result = await node.run_parallel({
            "interview_prep_input": {"company": "Acme", "role": "Engineer", "location": "Remote"}
        })
        return order, result

    order, result = asyncio.run(run())

    # the company branch fully finishes before the job branch ever starts
    assert order == ["company_start", "company_end", "job_start", "job_end"]
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


def test_company_branch_stops_at_the_tool_round_cap_without_recursion_error(monkeypatch):
    """Reproduces the live failure: a model that requests one tool per turn
    forever. The branch must end at the cap with the gathered profile, not
    raise GraphRecursionError and lose everything."""
    import dataclasses

    from langchain_core.messages import AIMessage as AI

    monkeypatch.setattr(orchestrator_module, "settings",
                        dataclasses.replace(orchestrator_module.settings, company_research_max_tool_rounds=3))
    calls = {"agent": 0}

    class AlwaysSearchesAgent:
        async def __call__(self, state):
            calls["agent"] += 1
            return {
                "messages": [AI(content="", tool_calls=[{"name": "search_company_overview",
                                                         "args": {"company_name": "Acme"}, "id": f"c{calls['agent']}"}])],
                "task_context": {"company_profile": {"name": "Acme", "description": f"after {calls['agent']} calls"}},
            }

    monkeypatch.setattr(orchestrator_module, "CompanyResearchNode", lambda: AlwaysSearchesAgent())
    monkeypatch.setattr(orchestrator_module, "ToolNode",
                        lambda tools, handle_tool_errors=True: (lambda state: {"messages": []}))
    graph = orchestrator_module._build_company_branch()

    result = asyncio.run(graph.ainvoke(
        {"messages": [], "task_context": {}, "guardrail_flags": {}},
        config={"recursion_limit": 3 * 3 + 4},
    ))

    assert calls["agent"] == 4  # three executed tool rounds, then stopped on the fourth request
    assert result["task_context"]["company_profile"]["name"] == "Acme"


def test_route_company_branch_ends_on_a_normal_final_answer():
    from langchain_core.messages import AIMessage as AI

    assert orchestrator_module.route_company_branch({"messages": [AI(content="dossier")]}) == "__end__"


class FakePlanner:
    def __init__(self):
        self.calls = []

    async def build_plan(self, materials, priority_gaps, role, company, user_id=None, focus="", total_days=None):
        self.calls.append({"materials": materials, "gaps": priority_gaps, "user_id": user_id,
                           "company": company, "total_days": total_days})
        return {
            "id": "plan-test", "narrative_source": "llm",
            "plan": {"total_days": 2, "sprints": [{}]},
            "coverage": {"researched": ["X"], "unresearched": []},
        }


def _planner_state():
    return {
        "user_id": "u1",
        "interview_prep_input": {"company": "Acme", "role": "Engineer", "location": "Remote"},
        "task_context": {"skill_gap": {"priority_gaps": [{"skill": "X", "effort": "High"}]}},
        "researched_materials": [{"topic": "X", "resources": []}],
    }


def test_run_planner_builds_and_saves_the_plan(monkeypatch, tmp_path):
    import dataclasses

    monkeypatch.setattr(orchestrator_module, "settings",
                        dataclasses.replace(orchestrator_module.settings, plan_output_dir=str(tmp_path)))
    planner = FakePlanner()
    node = InterviewPrepOrchestrator(company_graph=object(), job_agent=object(), planner_agent=planner)

    result = asyncio.run(node.run_planner(_planner_state()))

    assert result["study_plan"]["id"] == "plan-test"
    assert result["study_plan_path"] == str(tmp_path / "plan-test.json")
    assert json.loads((tmp_path / "plan-test.json").read_text())["id"] == "plan-test"
    assert planner.calls[0]["user_id"] == "u1"


def test_run_planner_still_plans_when_every_research_module_failed(monkeypatch, tmp_path):
    import dataclasses

    monkeypatch.setattr(orchestrator_module, "settings",
                        dataclasses.replace(orchestrator_module.settings, plan_output_dir=str(tmp_path)))
    planner = FakePlanner()
    node = InterviewPrepOrchestrator(company_graph=object(), job_agent=object(), planner_agent=planner)
    state = {**_planner_state(), "researched_materials": []}

    result = asyncio.run(node.run_planner(state))

    assert result["study_plan"] is not None
    assert planner.calls[0]["gaps"] == [{"skill": "X", "effort": "High"}]


def test_run_planner_uses_the_requested_plan_length_else_the_default(monkeypatch, tmp_path):
    import dataclasses

    monkeypatch.setattr(orchestrator_module, "settings", dataclasses.replace(
        orchestrator_module.settings, plan_output_dir=str(tmp_path), plan_total_days=45))
    planner = FakePlanner()
    node = InterviewPrepOrchestrator(company_graph=object(), job_agent=object(), planner_agent=planner)

    asyncio.run(node.run_planner({**_planner_state(), "plan_total_days": 60}))
    asyncio.run(node.run_planner(_planner_state()))

    assert [c["total_days"] for c in planner.calls] == [60, 45]


def test_run_research_researches_only_the_top_gaps(monkeypatch):
    import dataclasses

    monkeypatch.setattr(orchestrator_module, "settings",
                        dataclasses.replace(orchestrator_module.settings, research_max_gaps=2))
    seen = {}

    class FakeResearch:
        async def __call__(self, state):
            seen["gaps"] = state["skill_gaps"]
            return {"researched_materials": [], "execution_events": [], "handoffs": []}

    node = InterviewPrepOrchestrator(company_graph=object(), job_agent=object(), research_agent=FakeResearch())
    asyncio.run(node.run_research({"skill_gaps": ["A", "B", "C", "D"], "task_context": {}}))

    assert seen["gaps"] == ["A", "B"]


def test_run_planner_skips_with_no_gaps_and_no_research():
    node = InterviewPrepOrchestrator(company_graph=object(), job_agent=object(), planner_agent=FakePlanner())
    state = {"interview_prep_input": {}, "task_context": {}, "researched_materials": []}

    result = asyncio.run(node.run_planner(state))

    assert result == {"study_plan": None, "study_plan_path": None}


def test_run_planner_keeps_the_plan_when_saving_is_disabled(monkeypatch):
    import dataclasses

    monkeypatch.setattr(orchestrator_module, "settings",
                        dataclasses.replace(orchestrator_module.settings, plan_output_dir=""))
    node = InterviewPrepOrchestrator(company_graph=object(), job_agent=object(), planner_agent=FakePlanner())

    result = asyncio.run(node.run_planner(_planner_state()))

    assert result["study_plan"]["id"] == "plan-test"
    assert result["study_plan_path"] is None


def test_evaluate_includes_the_study_plan_in_its_result_and_task_context(monkeypatch):
    class FakeLLM:
        async def ainvoke(self, _prompt, config=None):
            return type("Response", (), {
                "content": '{"action":"complete","summary":"Both sources available."}'
            })()

    monkeypatch.setattr("agents.interview_prep_orchestrator.get_llm", lambda temperature, **_kwargs: FakeLLM())
    node = InterviewPrepOrchestrator(company_graph=object(), job_agent=object())
    state = {
        "company_research_result": {"status": "success", "data": {"profile": {}}, "error": None},
        "job_intelligence_result": {"status": "success", "data": {}, "error": None},
        "study_plan": {"id": "plan-1", "total_days": 2},
        "workflow_clarification_rounds": 0,
    }

    result = asyncio.run(node.evaluate(state))

    assert result["interview_prep_result"]["study_plan"]["id"] == "plan-1"
    assert result["task_context"]["preparation_plan"]["id"] == "plan-1"


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

    monkeypatch.setattr("agents.interview_prep_orchestrator.get_llm", lambda temperature, **_kwargs: FakeLLM())
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