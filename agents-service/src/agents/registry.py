"""
Specialist registry: the one place a new agent is declared.

The supervisor's routing prompt and its set of valid decisions are always
generated from SPECIALISTS. Most agents are simple: one node, then
save_memory — for those, adding an agent is one entry here (a name, a
routing description, and a factory returning a LangGraph node). Set
`factory=None` for an agent that needs its own graph wiring instead (e.g.
company_research's tool-calling loop with cr_guardrails/cr_tools) — it's
still declared here so the supervisor prompt and SPECIALIST_NAMES include
it, but graph/builder.py wires its nodes/edges explicitly rather than
through the uniform "one node -> save_memory" loop.
"""
from dataclasses import dataclass
from typing import Any, Callable, Optional


@dataclass(frozen=True)
class Specialist:
    name: str
    # when the supervisor should pick this agent; shown in its prompt
    description: str
    # None = wired manually in graph/builder.py, not auto-registered as a node
    factory: Optional[Callable[[], Any]]


def _chat():
    from agents.chat_agent import ChatAgent

    return ChatAgent()


def _research():
    from agents.research_node import ResearchNode

    return ResearchNode()


def _interview_intelligence():
    from agents.interview_intelligence_node import InterviewIntelligenceNode

    return InterviewIntelligenceNode()


def _company_research():
    from agents.company_research_node import CompanyResearchNode

    return CompanyResearchNode()


def _skill_gap():
    from agents.skill_gap_node import SkillGapNode

    return SkillGapNode()


SPECIALISTS: tuple[Specialist, ...] = (
    Specialist(
        name="interview_intelligence",
        description=(
            "the user asks for a specific company's interview rounds, role-specific question patterns, "
            "candidate-reported interview experiences, or recent interview-process changes"
        ),
        factory=_interview_intelligence,
    ),
    Specialist(
        name="research",
        description=(
            "the user asks for learning resources, study material, a learning module, "
            "docs, books, videos or tutorials on a topic"
        ),
        factory=_research,
    ),
    Specialist(
        name="company_research",
        description=(
            "the user wants a general company dossier for interview prep - products, "
            "tech stack, engineering culture, company facts, or financials, rather than interview-round reports"
        ),
        factory=None,  # tool-calling loop wired in graph/builder.py
    ),
    Specialist(
        name="interview_prep",
        description=(
            "the user wants a combined, company- and role-specific interview-preparation brief "
            "with both company research and current job-market skills, seniority, and qualifications"
        ),
        factory=None,  # bounded parallel workflow wired in graph/builder.py
    ),
    Specialist(
        name="chat",
        description=(
            "everything else: questions, advice, study plans, telling you about "
            "themselves, small talk"
        ),
        factory=_chat,
    ),
)

# where the supervisor sends anything it cannot classify
DEFAULT_SPECIALIST = "chat"

SPECIALIST_NAMES = frozenset(s.name for s in SPECIALISTS)
assert DEFAULT_SPECIALIST in SPECIALIST_NAMES

# the subset with a factory: what graph/builder.py auto-wires as
# "one node -> save_memory". Agents with factory=None (company_research)
# are wired explicitly in builder.py instead.
AUTO_WIRED_SPECIALISTS: tuple[Specialist, ...] = tuple(s for s in SPECIALISTS if s.factory is not None)
