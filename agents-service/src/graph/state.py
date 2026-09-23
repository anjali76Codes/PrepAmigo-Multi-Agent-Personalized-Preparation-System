"""
Shared state that flows through every node in the graph.
Keep this the single source of truth for "what the agents can see."
"""
from typing import Annotated, Any, Optional
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    # full conversation, auto-appended by LangGraph on each node return
    messages: Annotated[list, add_messages]

    # which specialist agent should run next (set by the supervisor/router)
    next_agent: Optional[str]

    # long-lived task context — survives across turns via the checkpointer
    task_context: dict[str, Any]

    # per-run scratch data a tool/agent wants to hand to the next node
    scratchpad: dict[str, Any]

    # guardrail verdicts collected this turn, e.g. {"pii_check": "pass"}
    guardrail_flags: dict[str, str]
