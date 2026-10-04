"""
Base agent wrapper: binds an LLM + system prompt + tools into one callable
LangGraph node. Specialist agents subclass this instead of hand-rolling
node functions, so LLM/memory/tool-binding logic lives in one place.
"""
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from core.config import get_llm
from graph.events import emit_to_graph_stream, make_event
from prompts.system_prompts import MEMORY_CONTEXT_PROMPT

# short-term context sent to the LLM; older turns are covered by
# long-term memory recall, so prompts stay bounded however long a thread gets
HISTORY_LIMIT = 20
# handoffs (graph/state.py:AgentHandoff) carry a short summary, not the
# full reply — keeps a downstream agent's prompt from re-reading it in full
HANDOFF_SUMMARY_CHARS = 200


def recent_messages(messages: list[BaseMessage], limit: int = HISTORY_LIMIT) -> list[BaseMessage]:
    """The last `limit` messages, starting at a user message so the window
    never opens on an orphaned assistant reply or tool result."""
    window = list(messages[-limit:])
    while window and not isinstance(window[0], HumanMessage):
        window.pop(0)
    return window or list(messages[-1:])


class BaseAgent:
    name: str = "base"
    system_prompt: str = ""
    tools: list = []
    history_limit: int = HISTORY_LIMIT

    def __init__(self):
        llm = get_llm()
        self.llm = llm.bind_tools(self.tools) if self.tools else llm

    async def __call__(self, state: dict) -> dict:
        emit_to_graph_stream(make_event(self.name, "generate_response", "running"))
        messages = [SystemMessage(content=self.system_prompt)]
        memories = state.get("memory_context") or []
        if memories:
            # recalled by memory.nodes.load_memory for this user
            facts = "\n".join(f"- {memory}" for memory in memories)
            messages.append(SystemMessage(content=MEMORY_CONTEXT_PROMPT.format(facts=facts)))
        messages.extend(recent_messages(state["messages"], self.history_limit))
        # async so reply tokens reach graph.astream(stream_mode="messages")
        try:
            response = await self.llm.ainvoke(messages)
        except Exception:
            emit_to_graph_stream(make_event(self.name, "generate_response", "failed"))
            raise
        reply = response.content if isinstance(response.content, str) else str(response.content)
        emit_to_graph_stream(make_event(self.name, "generate_response", "completed"))
        handoff = {
            "agent": self.name,
            "kind": "chat_reply",
            "summary": reply[:HANDOFF_SUMMARY_CHARS],
            "data": {},
        }
        return {"messages": [response], "handoffs": [handoff]}
