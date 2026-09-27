import asyncio

from langchain_core.messages import AIMessage, HumanMessage

from agents.interview_intelligence_node import InterviewIntelligenceNode, parse_interview_request


class ExtractorLLM:
    def __init__(self, reply):
        self.reply = reply

    async def ainvoke(self, messages, config=None):
        return AIMessage(content=self.reply)


class FakeAgent:
    def __init__(self):
        self.request = None

    async def run(self, request):
        self.request = request
        return {
            "brief": {
                "content_markdown": "## Interview Stages\nEvidence.",
                "uses_mock_sources": False,
                "source_errors": {},
            },
            "events": [],
            "handoff": {"agent": "interview_intelligence"},
        }


def test_parse_interview_request_handles_json_and_missing_fields():
    assert parse_interview_request(
        'Result: {"target_company":"Acme", "target_role":"SWE"}'
    ) == {"target_company": "Acme", "target_role": "SWE"}
    assert parse_interview_request("not json") == {"target_company": None, "target_role": None}


def test_node_extracts_request_and_returns_brief():
    agent = FakeAgent()
    node = InterviewIntelligenceNode(
        agent=agent,
        llm=ExtractorLLM('{"target_company":"Acme", "target_role":"Backend Engineer"}'),
    )

    result = asyncio.run(node({"messages": [HumanMessage("Research Acme backend interviews")]}))

    assert agent.request.target_company == "Acme"
    assert agent.request.target_role == "Backend Engineer"
    assert result["messages"][0].content == "## Interview Stages\nEvidence."


def test_node_asks_for_missing_company_or_role():
    node = InterviewIntelligenceNode(llm=ExtractorLLM('{"target_company":"Acme", "target_role":null}'))

    result = asyncio.run(node({"messages": [HumanMessage("Research Acme interviews")]}))

    assert "role" in result["messages"][0].content