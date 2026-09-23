"""
Supervisor: the graph's traffic controller. Looks at the conversation and
decides which specialist node runs next. Kept separate from BaseAgent
because it returns a routing decision, not a chat message.
"""
from config import get_llm
from prompts.system_prompts import SUPERVISOR_PROMPT
from langchain_core.messages import SystemMessage

VALID_AGENTS = {"flight_booking"}


def supervisor_node(state: dict) -> dict:
    llm = get_llm(temperature=0)
    messages = [SystemMessage(content=SUPERVISOR_PROMPT), *state["messages"]]
    decision = llm.invoke(messages).content.strip().lower()

    if decision not in VALID_AGENTS:
        raise ValueError(f"Supervisor returned unsupported agent: {decision!r}")
    return {"next_agent": decision}
