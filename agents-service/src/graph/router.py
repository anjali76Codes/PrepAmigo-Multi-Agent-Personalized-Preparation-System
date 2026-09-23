"""
Conditional-edge functions. Kept separate from builder.py so routing
logic is easy to unit-test without spinning up the whole graph.
"""
from langgraph.graph import END


def route_from_supervisor(state: dict) -> str:
    return state.get("next_agent", "flight_booking")


def route_after_agent(state: dict) -> str:
    """After a specialist runs: if it called a tool, go execute it;
    otherwise the turn is done."""
    last = state["messages"][-1]
    if getattr(last, "tool_calls", None):
        return "tools"
    return END
