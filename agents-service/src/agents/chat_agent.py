from agents.base import BaseAgent
from prompts.system_prompts import CHAT_PROMPT


class ChatAgent(BaseAgent):
    """General PrepAmigo assistant for anything no specialist handles."""

    name = "chat"
    system_prompt = CHAT_PROMPT
