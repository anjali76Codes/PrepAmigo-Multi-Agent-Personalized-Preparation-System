"""
Guardrails are plain functions: (state) -> (passed: bool, reason: str).
Wire them into the graph as a node before/after any agent that touches
money, PII, or irreversible actions (payment, cancellation, refund).
"""
from graph.state import AgentState
from graph.events import emit_tool_event, summarize_tool_input

BLOCKED_ACTIONS = {"charge_card", "delete_reservation"}


def check_no_unconfirmed_payment(state: AgentState) -> tuple[bool, str]:
    last = state["messages"][-1] if state["messages"] else None
    tool_calls = getattr(last, "tool_calls", []) or []
    for call in tool_calls:
        if call.get("name") in BLOCKED_ACTIONS:
            return False, f"Blocked unconfirmed action: {call['name']}"
    return True, "ok"


def run_guardrails(state: AgentState) -> dict:
    passed, reason = check_no_unconfirmed_payment(state)
    flags = {**state.get("guardrail_flags", {}), "payment_check": reason}
    if not passed:
        raise ValueError(reason)  # or route to a "needs_human" node instead
    last = state["messages"][-1] if state.get("messages") else None
    for call in getattr(last, "tool_calls", []) or []:
        name = call.get("name")
        if name:
            emit_tool_event(
                "company_research",
                name,
                "running",
                {
                    "tool_call_id": call.get("id"),
                    **summarize_tool_input(call.get("args") or {}),
                },
            )
    return {"guardrail_flags": flags}
