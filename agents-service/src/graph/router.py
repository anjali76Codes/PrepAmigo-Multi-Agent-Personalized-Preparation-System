"""
Conditional-edge functions. Kept separate from builder.py so routing
logic is easy to unit-test without spinning up the whole graph.
"""
from langgraph.graph import END

from agents.registry import DEFAULT_SPECIALIST, SPECIALIST_NAMES


def route_from_supervisor(state: dict) -> str:
    if state.get("workflow_mode") == "interview_prep":
        return "interview_prep"
    agent = state.get("next_agent")
    return agent if agent in SPECIALIST_NAMES else DEFAULT_SPECIALIST


def route_after_agent(state: dict) -> str:
    """After a specialist runs: if it called a tool, go execute it;
    otherwise the turn is done. Shared by every tool-calling specialist
    (currently company_research); simple one-shot specialists (chat,
    research) never produce tool_calls, so this always returns END for them."""
    last = state["messages"][-1]
    if getattr(last, "tool_calls", None):
        return "tools"
    return END
