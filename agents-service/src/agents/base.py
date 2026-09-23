"""
Base agent wrapper: binds an LLM + system prompt + tools into one callable
LangGraph node. Specialist agents subclass this instead of hand-rolling
node functions, so LLM/memory/tool-binding logic lives in one place.
"""
from langchain_core.messages import SystemMessage
from config import get_llm


class BaseAgent:
    name: str = "base"
    system_prompt: str = ""
    tools: list = []

    def __init__(self):
        llm = get_llm()
        self.llm = llm.bind_tools(self.tools) if self.tools else llm

    def __call__(self, state: dict) -> dict:
        messages = [SystemMessage(content=self.system_prompt), *state["messages"]]
        response = self.llm.invoke(messages)
        return {"messages": [response]}
