"""
Assembles the whole multi-agent graph:

                  START
                 /     \\
       load_memory     supervisor      run in parallel: recall long-term
                 \\     /               memories while routing is decided
                 dispatch              waits for both
                /   |   \\
          <one specialist per agents/registry.py entry>
                \\   |   /
               save_memory             background save to long-term memory
                    |
                   END

Most specialists (chat, research) are one node -> save_memory, generated
from agents/registry.py. company_research is different: it's a
tool-calling loop (company_research -> cr_guardrails -> cr_tools -> back
to company_research, until it replies with no more tool calls), so it's
registered (factory=None) for the supervisor prompt/routing but wired
explicitly below; its loop still ends at save_memory like every other
specialist. Add a similar tool-calling agent by following that pattern.

The flight_booking agent is kept in the codebase but not registered.

Memory, research and company_research nodes may be async or sync — LangGraph
runs either as a node. Run the compiled graph with ainvoke/astream. Research
step events arrive on stream_mode="custom".
"""
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode

from agents.company_research_node import CompanyResearchNode
from agents.interview_prep_orchestrator import (
    InterviewPrepOrchestrator,
    route_after_evaluate,
    route_after_prepare,
)
from agents.registry import AUTO_WIRED_SPECIALISTS, SPECIALISTS
from agents.supervisor import supervisor_node
from graph.router import route_after_agent, route_from_supervisor
from graph.state import AgentState
from guardrails.validators import run_guardrails
from memory.nodes import load_memory, save_memory
from memory.store import get_checkpointer
from tools.company_research_tools import COMPANY_RESEARCH_TOOLS


def dispatch(state: dict) -> dict:
    """Join point: runs once both memory recall and routing are done."""
    return {}


def build_graph():
    graph = StateGraph(AgentState)

    graph.add_node("load_memory", load_memory)
    graph.add_node("supervisor", supervisor_node)
    graph.add_node("dispatch", dispatch)
    graph.add_node("save_memory", save_memory)
    interview_prep = InterviewPrepOrchestrator()
    graph.add_node("interview_prep", interview_prep.prepare)
    graph.add_node("interview_prep_pause", interview_prep.pause_for_input)
    graph.add_node("interview_prep_run", interview_prep.run_parallel)
    graph.add_node("interview_prep_evaluate", interview_prep.evaluate)
    for specialist in AUTO_WIRED_SPECIALISTS:
        graph.add_node(specialist.name, specialist.factory())
        graph.add_edge(specialist.name, "save_memory")

    # company_research: a tool-calling loop, not a single node, so it isn't
    # auto-wired above (see agents/registry.py); its END still lands on
    # save_memory like every other specialist
    graph.add_node("company_research", CompanyResearchNode())
    graph.add_node("cr_guardrails", run_guardrails)
    graph.add_node("cr_tools", ToolNode(COMPANY_RESEARCH_TOOLS, handle_tool_errors=True))
    graph.add_conditional_edges("company_research", route_after_agent, {"tools": "cr_guardrails", END: "save_memory"})
    graph.add_conditional_edges("cr_guardrails", route_after_agent, {"tools": "cr_tools", END: "save_memory"})
    graph.add_edge("cr_tools", "company_research")

    graph.add_conditional_edges(
        "interview_prep",
        route_after_prepare,
        {"pause": "interview_prep_pause", "run": "interview_prep_run", "stop": "save_memory"},
    )
    graph.add_edge("interview_prep_pause", "interview_prep")
    # Pipeline chain: company+job (parallel) → skill gap → research → plan → evaluate
    graph.add_node("interview_prep_skill_gap", interview_prep.run_skill_gap)
    graph.add_node("interview_prep_research", interview_prep.run_research)
    graph.add_node("interview_prep_plan", interview_prep.run_planner)
    graph.add_edge("interview_prep_run",       "interview_prep_skill_gap")
    graph.add_edge("interview_prep_skill_gap", "interview_prep_research")
    graph.add_edge("interview_prep_research",  "interview_prep_plan")
    graph.add_edge("interview_prep_plan",      "interview_prep_evaluate")
    graph.add_conditional_edges(
        "interview_prep_evaluate",
        route_after_evaluate,
        {"pause": "interview_prep_pause", "save": "save_memory"},
    )

    graph.add_edge(START, "load_memory")
    graph.add_edge(START, "supervisor")
    graph.add_edge(["load_memory", "supervisor"], "dispatch")
    graph.add_conditional_edges(
        "dispatch",
        route_from_supervisor,
        {specialist.name: specialist.name for specialist in SPECIALISTS},
    )
    graph.add_edge("save_memory", END)

    return graph.compile(checkpointer=get_checkpointer())
