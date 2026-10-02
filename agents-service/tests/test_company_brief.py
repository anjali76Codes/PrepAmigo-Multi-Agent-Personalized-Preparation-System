"""Direct company research: two parallel searches, one small model call,
and a brief that reaches the downstream prompts."""
import asyncio
import json

from langchain_core.messages import AIMessage

import agents.interview_prep_orchestrator as orchestrator_module
from agents.company_brief import (
    BRIEF_MAX_TOKENS,
    EVIDENCE_CHARS,
    DirectCompanyResearch,
    build_evidence,
    company_focus,
)
from agents.interview_prep_orchestrator import InterviewPrepOrchestrator
from agents.research_agent import prep_focus
from config import Settings

BRIEF = {
    "summary": "Acme builds anvils as a service.",
    "products": ["Anvil Cloud"],
    "tech_stack": ["Python", "Kubernetes"],
    "engineering_focus": ["reliability of anvil delivery"],
    "recent_developments": ["raised a Series B"],
}


class Tool:
    def __init__(self, payload):
        self.payload, self.calls = payload, []

    def invoke(self, args):
        self.calls.append(args["company_name"])
        payload = self.payload(args["company_name"]) if callable(self.payload) else self.payload
        return json.dumps(payload)


class LLM:
    def __init__(self, content=None, error=None):
        self.content, self.error, self.prompts = content, error, []

    async def ainvoke(self, prompt, config=None):
        self.prompts.append(prompt)
        if self.error:
            raise self.error
        return AIMessage(content=self.content)


def overview(name="Acme", **extra):
    return {"knowledge_graph": {"title": name, "description": "Makes anvils."},
            "organic_results": [{"title": "Acme engineering blog", "snippet": "We run Python on Kubernetes."}],
            "related_questions": [], "discussions_and_forums": [], "sitelinks": [], **extra}


NEWS = {"news_results": [{"title": "Acme raises Series B"}]}


def research(llm, overview_payload=None, news_payload=NEWS):
    tools = {"overview": Tool(overview_payload or overview()), "news": Tool(news_payload)}
    return DirectCompanyResearch(llm=llm, tools=tools), tools


def test_two_searches_and_one_model_call_produce_a_profile_with_a_brief():
    llm = LLM(json.dumps(BRIEF))
    agent, tools = research(llm)

    result = asyncio.run(agent.run("Acme", "SWE"))

    assert (len(tools["overview"].calls), len(tools["news"].calls), len(llm.prompts)) == (1, 1, 1)
    assert result["profile"]["name"] == "Acme" and result["profile"]["brief"] == BRIEF
    assert "We run Python on Kubernetes." in llm.prompts[0] and "Acme raises Series B" in llm.prompts[0]


def test_a_failed_or_rate_limited_model_call_still_returns_the_search_profile():
    for llm in (LLM(error=RuntimeError("429 rate limit")), LLM("Sorry, here is some prose."), LLM("{}")):
        result = asyncio.run(research(llm)[0].run("Acme"))

        assert result["brief"] is None and "brief" not in result["profile"]
        assert result["profile"]["description"] == "Makes anvils."


def test_thinking_tags_and_code_fences_around_the_json_are_tolerated():
    llm = LLM("<think>{not json} let me see</think>\n```json\n" + json.dumps(BRIEF) + "\n```")
    assert asyncio.run(research(llm)[0].run("Acme"))["brief"] == BRIEF


def test_oversized_model_output_is_clipped_to_the_brief_limits():
    llm = LLM(json.dumps({**BRIEF, "tech_stack": [f"tool {i}" for i in range(40)], "summary": "x" * 5000}))
    brief = asyncio.run(research(llm)[0].run("Acme"))["brief"]

    assert len(brief["tech_stack"]) == 10 and len(brief["summary"]) == 400


def test_a_spelling_correction_reruns_the_searches_under_the_real_name():
    def by_name(name):
        if name == "Antropic":
            return {"knowledge_graph": {}, "organic_results": [], "corrected_company": "Anthropic"}
        return overview("Anthropic")

    agent, tools = research(LLM(json.dumps(BRIEF)), overview_payload=by_name)
    result = asyncio.run(agent.run("Antropic"))

    assert tools["overview"].calls == ["Antropic", "Anthropic"]
    assert result["profile"]["name"] == "Anthropic"


def test_prompt_evidence_is_bounded_whatever_the_search_returned():
    profile = {"name": "Acme", "organic_results": [{"title": "t" * 500, "snippet": "s" * 5000}] * 50,
               "recent_developments": [{"title": "n" * 900}] * 50}
    assert len(build_evidence(profile)) <= EVIDENCE_CHARS
    assert BRIEF_MAX_TOKENS <= 400  # keeps one run inside a free tier's per-minute budget


def test_the_brief_reaches_the_research_and_planner_focus_line():
    profile = {"brief": BRIEF}
    assert company_focus(profile) == "Company stack: Python, Kubernetes. Engineering focus: reliability of anvil delivery"
    assert company_focus({}) == "" and company_focus(None) == ""

    focus = prep_focus({"commonResponsibilities": ["Ship integrations"]}, profile)
    assert focus.startswith("Responsibilities: Ship integrations") and "Company stack: Python, Kubernetes" in focus
    assert prep_focus({"commonResponsibilities": ["Ship integrations"]}) == "Responsibilities: Ship integrations"


class JobAgent:
    async def __call__(self, _state):
        return {"job_intelligence_result": {"status": "success", "data": {"skills": [{"name": "Python"}]}, "error": None}}


def _run_parallel(monkeypatch, mode, **kwargs):
    monkeypatch.setattr(orchestrator_module, "settings", Settings(company_research_mode=mode, llm_max_concurrency=1))
    node = InterviewPrepOrchestrator(job_agent=JobAgent(), **kwargs)
    return asyncio.run(node.run_parallel({"interview_prep_input": {"company": "Acme", "role": "SWE", "location": "Remote"}}))


def test_direct_mode_bypasses_the_agent_graph(monkeypatch):
    class ForbiddenGraph:
        async def ainvoke(self, *_args, **_kwargs):
            raise AssertionError("direct mode must not run the tool-calling agent")

    agent, _ = research(LLM(json.dumps(BRIEF)))
    result = _run_parallel(monkeypatch, "direct", company_graph=ForbiddenGraph(), company_direct=agent)

    company = result["company_research_result"]
    assert company["status"] == "success"
    assert company["data"]["profile"]["brief"]["tech_stack"] == ["Python", "Kubernetes"]


def test_agent_mode_does_not_touch_direct_research(monkeypatch):
    class Graph:
        async def ainvoke(self, _inputs, config):
            return {"messages": [AIMessage(content="dossier")],
                    "task_context": {"company_profile": {"name": "Acme", "description": "Makes anvils."}}}

    class ForbiddenDirect:
        async def run(self, *_args):
            raise AssertionError("agent mode must not run direct research")

    result = _run_parallel(monkeypatch, "agent", company_graph=Graph(), company_direct=ForbiddenDirect())
    assert result["company_research_result"]["data"]["dossier"] == "dossier"


def test_company_module_is_researched_and_planned_first_when_switched_on(monkeypatch):
    class Research:
        def __init__(self, found=5):
            self.official, self.found = [], found

        async def __call__(self, state):
            return {"researched_materials": [{"topic": gap} for gap in state["skill_gaps"]],
                    "execution_events": [], "handoffs": []}

        async def research_many(self, requests, memories=None, on_event=None):
            self.official.extend(requests)
            return [{"module": {"topic": requests[0].topic_or_skill_gap,
                                "resources": [{"url": f"https://docs.acme.example/{i}"} for i in range(self.found)]},
                     "handoff": {}}]

    state = {"user_id": "u1", "skill_gaps": ["Python"], "task_context": {
        "target_role": "SWE", "target_company": "Acme",
        "company_profile": {"name": "Acme", "website": "acme.example", "brief": {"products": ["Anvil"]}},
        "skill_gap": {"priority_gaps": [{"skill": "Python", "effort": "High"}]}}}

    for mode, expected in (("on", ["Acme Anvil platform", "Python"]), ("off", ["Python"])):
        monkeypatch.setattr(orchestrator_module, "settings", Settings(company_module=mode))
        research = Research()
        node = InterviewPrepOrchestrator(company_graph=object(), job_agent=object(), research_agent=research)
        result = asyncio.run(node.run_research(state))

        assert [m["topic"] for m in result["researched_materials"]] == expected
        gaps = result.get("task_context", state["task_context"])["skill_gap"]["priority_gaps"]
        assert [g["skill"] for g in gaps] == expected
        assert len(research.official) == (1 if mode == "on" else 0)

    # a company site with almost no developer material doesn't get the plan's first slot
    monkeypatch.setattr(orchestrator_module, "settings", Settings(company_module="on"))
    node = InterviewPrepOrchestrator(company_graph=object(), job_agent=object(), research_agent=Research(found=2))
    assert [m["topic"] for m in asyncio.run(node.run_research(state))["researched_materials"]] == ["Python"]


def test_job_intelligence_gets_the_company_brief_even_when_calls_may_run_concurrently(monkeypatch):
    """With no postings from the company, the brief is what job
    intelligence builds on, so direct company research always runs first."""
    seen = {}

    class RecordingJobAgent:
        async def __call__(self, state):
            seen.update(state)
            return {"job_intelligence_result": {"status": "partial", "data": {"skills": [{"name": "Go"}]}, "error": None}}

    monkeypatch.setattr(orchestrator_module, "settings", Settings(company_research_mode="direct", llm_max_concurrency=4))
    agent, _ = research(LLM(json.dumps(BRIEF)))
    node = InterviewPrepOrchestrator(company_graph=object(), job_agent=RecordingJobAgent(), company_direct=agent)
    asyncio.run(node.run_parallel({"interview_prep_input": {"company": "Acme", "role": "SWE", "location": "Remote"}}))

    assert "Tech stack: Python, Kubernetes" in seen["company_context"]
    assert seen["company_context"].startswith("Acme builds anvils as a service.")
