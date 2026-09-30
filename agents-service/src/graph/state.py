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


def append_or_reset(existing: list | None, new: list | None) -> list:
    """Reducer for per-turn lists: nodes append, and a None update clears
    the list (memory.nodes.load_memory sends None at the start of each
    turn) so the checkpoint does not grow without bound across turns."""
    if new is None:
        return []
    return [*(existing or []), *new]


class AgentHandoff(TypedDict):
    """The state-based handover contract between agents: every specialist
    appends one of these (agents/base.py does it generically; a fixed-
    pipeline agent like research does it itself) so any node that runs
    later in the turn — today just save_memory, eventually a supervisor
    loop or a new specialist — can read structured facts about what the
    previous agent did without re-parsing its chat reply.

    `data` should be small and load-bearing (ids, urls, counts), not the
    full output: that already lives in a dedicated state field (e.g.
    researched_materials) or the chat message itself, and duplicating it
    here would inflate the checkpoint and every downstream LLM prompt for
    no benefit."""
    agent: str
    kind: str  # e.g. "learning_module", "chat_reply"
    summary: str  # short, human/LLM-readable description of the output
    data: dict[str, Any]


class AgentState(TypedDict):
    # full conversation, auto-appended by LangGraph on each node return
    messages: Annotated[list, add_messages]

    # which specialist agent should run next (set by the supervisor/router)
    next_agent: Optional[str]

    # direct structured workflow requests bypass supervisor classification
    workflow_mode: Optional[str]
    workflow_input: dict[str, Any]
    workflow_text_input: Optional[str]
    workflow_resume_input: dict[str, Any]
    workflow_status: Optional[str]
    workflow_question: Optional[dict[str, Any]]
    workflow_clarification_rounds: int
    interview_prep_input: dict[str, Any]
    company_research_result: dict[str, Any]
    job_intelligence_result: dict[str, Any]
    interview_prep_result: dict[str, Any]

    # long-lived task context — survives across turns via the checkpointer
    task_context: dict[str, Any]

    # per-run scratch data a tool/agent wants to hand to the next node
    scratchpad: dict[str, Any]

    # guardrail verdicts collected this turn, e.g. {"pii_check": "pass"}
    guardrail_flags: dict[str, str]

    # --- PrepAmigo learning context ---
    # candidate the run is for; keys memory and the knowledge graph
    user_id: str

    # long-term memories recalled for this turn (memory.nodes.load_memory)
    memory_context: list[str]

    # topics/skills to research this run (e.g. from the Skill Gap agent)
    skill_gaps: list[str]

    # learning modules produced by the research agent this turn
    researched_materials: Annotated[list[dict[str, Any]], append_or_reset]

    # UserKnowledgeGraph.get_knowledge_state() snapshot. Not currently set
    # by any agent (the research agent no longer touches the knowledge
    # graph); reserved for the skill-gap/assessment agents.
    knowledge_graph_snapshot: dict[str, Any]

    # structured agent-to-agent handover for this turn, see AgentHandoff
    handoffs: Annotated[list[AgentHandoff], append_or_reset]

    # graph.events.AgentEvent audit trail for this turn; appended to by every node
    execution_events: Annotated[list[dict[str, Any]], append_or_reset]
