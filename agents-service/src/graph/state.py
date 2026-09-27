"""
Shared state that flows through every node in the graph.
Keep this the single source of truth for "what the agents can see."

task_context well-known keys (populated by specialist agents):
  - "company_profile"   : dict set by CompanyResearchAgent (overview, tech stack,
                          culture, recent news, financials, trends)
  - "job_intelligence"  : dict set by JobIntelligenceAgent (future)
  - "skill_gap"         : dict set by SkillGapAgent (future)
  - "preparation_plan"  : dict set by PlannerAgent (future)
  - "candidate_progress": dict set by ProgressAgent (future)
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
