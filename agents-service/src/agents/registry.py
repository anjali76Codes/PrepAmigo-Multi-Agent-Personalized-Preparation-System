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


SPECIALISTS: tuple[Specialist, ...] = (
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
            "the user wants a specific company researched for interview prep — its "
            "products, tech stack, engineering culture, recent news, or financials"
        ),
        factory=None,  # tool-calling loop wired in graph/builder.py
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
