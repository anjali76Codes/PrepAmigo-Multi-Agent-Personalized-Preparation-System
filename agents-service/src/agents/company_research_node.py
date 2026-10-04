"""
LangGraph node wrapper for the Company Research Agent.

Follows the same standardized pattern used by ResearchNode and
InterviewIntelligenceNode: the agent is held as a dependency-injected
instance so graph wiring (builder.py, interview_prep_orchestrator.py)
imports only this node class, and tests can inject a mock agent without
touching graph construction.

Graph wiring (both builder.py and interview_prep_orchestrator.py):
  company_research ──► cr_guardrails ──► cr_tools ──► company_research
  (tool-calling loop; exits when LLM produces no further tool calls)

Unlike ResearchNode / InterviewIntelligenceNode, this wrapper does NOT
add an extraction LLM call before the agent — CompanyResearchAgent already
handles intent extraction from the message history on its first turn, so
there is no pre-processing step to add here.
"""
import logging
from typing import Any

from agents.company_research_agent import CompanyResearchAgent

logger = logging.getLogger(__name__)


class CompanyResearchNode:
    """Thin node wrapper around CompanyResearchAgent.

    Standardizes the company_research graph node to the same
    pattern used by ResearchNode and InterviewIntelligenceNode.

    The agent instance is injected via __init__ (for testability)
    and __call__ forwards the raw LangGraph state dict directly
    to the agent, which owns the full tool-calling loop logic.
    """

    name = "company_research"

    def __init__(self, agent: CompanyResearchAgent | None = None):
        self.agent = agent or CompanyResearchAgent()

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        return await self.agent(state)
