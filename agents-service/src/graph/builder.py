"""
Assembles the whole multi-agent graph:

           supervisor
             |
            flight_booking
             |
           guardrails
             |
              tools
        |
      END (loops back to supervisor via router if more work remains)
"""
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode

from graph.state import AgentState
from graph.router import route_from_supervisor, route_after_agent
from agents.supervisor import supervisor_node
from agents.flight_booking_agent import FlightBookingAgent
from memory.store import get_checkpointer
from tools.search_tools import search_flights
from guardrails.validators import run_guardrails


def build_graph():
    flight_agent = FlightBookingAgent()

    graph = StateGraph(AgentState)

    graph.add_node("supervisor", supervisor_node)
    graph.add_node("flight_booking", flight_agent)
    graph.add_node("guardrails", run_guardrails)
    graph.add_node("tools", ToolNode([search_flights]))

    graph.add_edge(START, "supervisor")
    graph.add_conditional_edges(
        "supervisor",
        route_from_supervisor,
        {"flight_booking": "flight_booking"},
    )
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

    return graph.compile(checkpointer=get_checkpointer())
