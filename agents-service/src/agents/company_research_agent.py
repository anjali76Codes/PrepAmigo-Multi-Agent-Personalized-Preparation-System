"""
Company Research Agent
-----------------------
Specialist agent responsible for producing a comprehensive company dossier
for interview preparation candidates.

Inherits BaseAgent which:
  - Binds the LLM + tool list together (llm.bind_tools)
  - Injects the system prompt as a SystemMessage on every invocation
  - Is directly callable as a LangGraph node: (state) -> {"messages": [response], "task_context": task_context}

Tools (exactly 2 SerpApi-backed data sources):
  - search_company_overview (Google Search — facts, products, tech stack, culture, discussions)
  - search_company_news     (Google News — recent developments, launches, funding)
"""

import json
import logging
from typing import Any

from langchain_core.messages import SystemMessage

from agents.base import BaseAgent
from prompts.system_prompts import COMPANY_RESEARCH_PROMPT
from tools.company_research_tools import COMPANY_RESEARCH_TOOLS, normalize_company_profile

logger = logging.getLogger(__name__)


class CompanyResearchAgent(BaseAgent):
    name = "company_research"
    system_prompt = COMPANY_RESEARCH_PROMPT
    tools = COMPANY_RESEARCH_TOOLS

    def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        task_context = dict(state.get("task_context") or {})
        messages = list(state.get("messages", []))

        # Inspect any ToolMessages to parse and normalize into task_context["company_profile"]
        search_data = {}
        news_data = {}
        detected_company = ""

        for msg in messages:
            tool_name = getattr(msg, "name", None)
            content = getattr(msg, "content", None)
            if not content or not isinstance(content, str):
                continue

            if tool_name in {"search_company_overview", "search_company_info"}:
                try:
                    parsed = json.loads(content)
                    if isinstance(parsed, dict) and parsed.get("search_metadata", {}).get("status") != "Error":
                        search_data = parsed
                        kg_title = parsed.get("knowledge_graph", {}).get("title")
                        if kg_title:
                            detected_company = kg_title
                except Exception as exc:
                    logger.warning("[CompanyResearchAgent] Failed to parse search tool output: %s", exc)

            elif tool_name == "search_company_news":
                try:
                    parsed = json.loads(content)
                    if isinstance(parsed, dict) and parsed.get("search_metadata", {}).get("status") != "Error":
                        news_data = parsed
                except Exception as exc:
                    logger.warning("[CompanyResearchAgent] Failed to parse news tool output: %s", exc)

        if search_data or news_data:
            existing_profile = task_context.get("company_profile", {})
            company_name = detected_company or existing_profile.get("name", "Target Company")
            try:
                task_context["company_profile"] = normalize_company_profile(
                    company_name=company_name,
                    search_data=search_data,
                    news_data=news_data,
                )
            except Exception as exc:
                logger.error("[CompanyResearchAgent] Error normalizing company profile: %s", exc)

        # Invoke LLM with bound tools
        prompt_messages = [SystemMessage(content=self.system_prompt), *messages]
        response = self.llm.invoke(prompt_messages)

        return {
            "messages": [response],
            "task_context": task_context,
        }
