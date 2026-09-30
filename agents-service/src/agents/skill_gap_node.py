"""
LangGraph node wrapper for the Skill Gap Agent.

Follows the same standardized pattern used by CompanyResearchNode,
ResearchNode, and InterviewIntelligenceNode: the agent is injected
via __init__ (for testability) and __call__ forwards the LangGraph
state dict.

This node is NOT registered in agents/registry.py SPECIALISTS because
it is not a supervisor-routed conversational agent. It is wired
directly by InterviewPrepOrchestrator.run_skill_gap() as an internal
pipeline step.
"""
from typing import Any

from agents.skill_gap_agent import SkillGapAgent


class SkillGapNode:
    """Thin node wrapper around SkillGapAgent.

    Standardizes the skill_gap pipeline step to the same
    pattern used by other node wrappers in the codebase.
    """

    name = "skill_gap"

    def __init__(self, agent: SkillGapAgent | None = None):
        self.agent = agent or SkillGapAgent()

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        return await self.agent(state)
