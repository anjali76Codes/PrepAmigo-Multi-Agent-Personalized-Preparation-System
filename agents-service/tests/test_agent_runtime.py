import pytest

from agents.supervisor import supervisor_node
from core.config import Settings
import tools.search_tools as search_tools
from guardrails.validators import check_no_unconfirmed_payment
from tools.search_tools import search_flights


def test_settings_reject_unknown_provider():
    with pytest.raises(ValueError, match="LLM_PROVIDER"):
        Settings(llm_provider="unknown").validate()


@pytest.mark.parametrize(("value", "expected"), [("false", False), ("true", True), ("", None)])
def test_ollama_reasoning_setting_reaches_the_model(monkeypatch, value, expected):
    import config

    monkeypatch.setattr(config, "settings", Settings(llm_provider="ollama", ollama_reasoning=value))

    assert config.get_llm().reasoning is expected


def test_settings_reject_unknown_reasoning_value():
    with pytest.raises(ValueError, match="OLLAMA_REASONING"):
        Settings(ollama_reasoning="maybe").validate()


def _fake_supervisor_llm(monkeypatch, content):
    class FakeLLM:
        def invoke(self, messages, config=None):
            class Response:
                pass

            response = Response()
            response.content = content
            return response

    monkeypatch.setattr("agents.supervisor.get_llm", lambda temperature: FakeLLM())


@pytest.mark.parametrize(
    ("reply", "agent"),
    [
        ("research", "research"),
        ("Research.", "research"),
        ("chat", "chat"),
        # model ignored the instruction and answered the user (seen with local models)
        ("I can keep that information in mind for the rest of our conversation", "chat"),
        ("support", "chat"),
        ("research or chat", "chat"),
    ],
)
def test_supervisor_routes_or_falls_back_to_chat(monkeypatch, reply, agent):
    _fake_supervisor_llm(monkeypatch, reply)

    assert supervisor_node({"messages": []}) == {"next_agent": agent}


def test_guardrail_blocks_irreversible_tool_call():
    state = {
        "messages": [
            type(
                "Message",
                (),
                {"tool_calls": [{"name": "charge_card"}]},
            )()
        ]
    }

    passed, reason = check_no_unconfirmed_payment(state)

    assert not passed
    assert "charge_card" in reason


def test_search_flights_validates_configuration(monkeypatch):
    monkeypatch.setattr(search_tools, "settings", Settings(serpapi_api_key="", serpapi_enabled=True))

    with pytest.raises(RuntimeError, match="SERPAPI_API_KEY"):
        search_tools.search_flights.invoke(
            {"origin": "JFK", "destination": "LAX", "date": "2099-01-01"}
        )

def test_supervisor_prompt_is_generated_from_registry_and_ends_with_the_instruction():
    from langchain_core.messages import AIMessage, HumanMessage

    from agents.registry import SPECIALISTS
    from agents.supervisor import build_supervisor_prompt

    prompt = build_supervisor_prompt(
        [HumanMessage("I'm prepping for Stripe"), AIMessage("Great! " * 200), HumanMessage("find me docs on consistent hashing")]
    )

    for specialist in SPECIALISTS:
        assert f"- {specialist.name}: {specialist.description}" in prompt
    assert "Latest user message:\nfind me docs on consistent hashing" in prompt
    assert "User: I'm prepping for Stripe" in prompt
    assert prompt.count("Great!") < 60  # earlier turns are truncated
    assert prompt.rstrip().endswith("interview_prep or chat")


def test_router_falls_back_for_unknown_agents():
    from graph.router import route_from_supervisor

    assert route_from_supervisor({"next_agent": "research"}) == "research"
    assert route_from_supervisor({"next_agent": "flight_booking"}) == "chat"
    assert route_from_supervisor({}) == "chat"


def test_interview_intelligence_is_registered_in_the_graph():
    import graph.builder as builder
    from graph.router import route_from_supervisor

    graph = builder.build_graph().get_graph()
    nodes = set(graph.nodes)
    edges = {(edge.source, edge.target) for edge in graph.edges}

    assert route_from_supervisor({"next_agent": "interview_intelligence"}) == "interview_intelligence"
    assert "interview_intelligence" in nodes
    assert ("dispatch", "interview_intelligence") in edges
    assert ("interview_intelligence", "save_memory") in edges


def test_graph_runs_recall_in_parallel_with_routing(monkeypatch):
    import graph.builder as builder
    from agents.registry import Specialist

    monkeypatch.setattr(builder, "SPECIALISTS", (Specialist("chat", "everything", lambda: (lambda state: {})),))
    graph = builder.build_graph().get_graph()
    edges = {(e.source, e.target) for e in graph.edges}

    assert {("__start__", "load_memory"), ("__start__", "supervisor")} <= edges
    assert {("load_memory", "dispatch"), ("supervisor", "dispatch")} <= edges
    assert {("dispatch", "chat"), ("chat", "save_memory"), ("save_memory", "__end__")} <= edges


def test_company_research_tool_loop_ends_at_save_memory():
    """company_research isn't auto-wired (its factory is None; it's a
    tool-calling loop, not a single node) — this checks graph/builder.py's
    manual wiring for it lands on save_memory like every other specialist,
    not a bare END that would skip long-term memory."""
    import graph.builder as builder

    graph = builder.build_graph().get_graph()
    nodes = set(graph.nodes)
    edges = {(e.source, e.target) for e in graph.edges}

    assert {"company_research", "cr_guardrails", "cr_tools"} <= nodes
    assert ("dispatch", "company_research") in edges
    assert ("cr_tools", "company_research") in edges
    # both the agent's own conditional edges and cr_guardrails' route to
    # save_memory when there are no more tool calls, never straight to END
    assert ("company_research", "__end__") not in edges
    assert ("cr_guardrails", "__end__") not in edges


def test_interview_prep_plan_runs_between_research_and_evaluate():
    import graph.builder as builder

    graph = builder.build_graph().get_graph()
    nodes = set(graph.nodes)
    edges = {(e.source, e.target) for e in graph.edges}

    assert "interview_prep_plan" in nodes
    assert ("interview_prep_research", "interview_prep_plan") in edges
    assert ("interview_prep_plan", "interview_prep_evaluate") in edges
    # research no longer feeds evaluate directly — planning always runs in between
    assert ("interview_prep_research", "interview_prep_evaluate") not in edges
