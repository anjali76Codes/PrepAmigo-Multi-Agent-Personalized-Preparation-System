"""
Assembles the whole multi-agent graph.

Current topology:

           supervisor
           /         \\
  flight_booking   company_research
       |                  |
   guardrails         guardrails
       |                  |
     tools             cr_tools
       |                  |
  flight_booking   company_research
       |                  |
      END               END

The supervisor sets next_agent; route_from_supervisor sends execution to
the correct specialist node.  After a specialist runs, route_after_agent
checks for pending tool_calls — if found it routes to the matching guardrail
node; otherwise the turn ends.
"""
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode

from graph.state import AgentState
from graph.router import route_from_supervisor, route_after_agent
from agents.supervisor import supervisor_node
from agents.flight_booking_agent import FlightBookingAgent
from agents.company_research_agent import CompanyResearchAgent
from memory.store import get_checkpointer
from tools.search_tools import search_flights
from tools.company_research_tools import COMPANY_RESEARCH_TOOLS
from guardrails.validators import run_guardrails


def build_graph():
    flight_agent = FlightBookingAgent()
    company_research_agent = CompanyResearchAgent()

    graph = StateGraph(AgentState)

    # ── Nodes ──────────────────────────────────────────────────────────────
    graph.add_node("supervisor", supervisor_node)

    # Flight booking branch (legacy demo)
    graph.add_node("flight_booking", flight_agent)
    graph.add_node("guardrails", run_guardrails)
    graph.add_node("tools", ToolNode([search_flights], handle_tool_errors=True))

    # Company research branch
    graph.add_node("company_research", company_research_agent)
    graph.add_node("cr_guardrails", run_guardrails)
    graph.add_node("cr_tools", ToolNode(COMPANY_RESEARCH_TOOLS, handle_tool_errors=True))


    # ── Edges ──────────────────────────────────────────────────────────────
    graph.add_edge(START, "supervisor")

    # Supervisor routes to the right specialist
    graph.add_conditional_edges(
        "supervisor",
        route_from_supervisor,
        {
            "flight_booking": "flight_booking",
            "company_research": "company_research",
        },
    )

    # Flight booking branch
    graph.add_conditional_edges(
        "flight_booking",
        route_after_agent,
        {"tools": "guardrails", END: END},
    )
    graph.add_conditional_edges(
        "guardrails",
        route_after_agent,
        {"tools": "tools", END: END},
    )
    graph.add_edge("tools", "flight_booking")

    # Company research branch
    graph.add_conditional_edges(
        "company_research",
        route_after_agent,
        {"tools": "cr_guardrails", END: END},
    )
    graph.add_conditional_edges(
        "cr_guardrails",
        route_after_agent,
        {"tools": "cr_tools", END: END},
    )
    graph.add_edge("cr_tools", "company_research")

    return graph.compile(checkpointer=get_checkpointer())
