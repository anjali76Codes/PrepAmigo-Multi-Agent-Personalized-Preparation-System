"""
PrepAmigo CLI Runner
--------------------
Two modes for local development and testing:

  Default mode (no args):
    uv run python src/cli.py [--user USER_ID] [--stream | --no-stream]
    -> Full multi-agent REPL: the supervisor routes your message to chat,
       research or company_research. Streams the reply as it is generated
       (STREAM_RESPONSES in .env sets the default; --user keys long-term
       memory, default "demo-user").

  Company Research mode:
    uv run python src/cli.py --company "Datadog"
    uv run python src/cli.py --company "Stripe" --role "Backend Engineer"
    -> Directly invokes the Company Research Agent in isolation, bypassing
       the supervisor. Useful for R&D on that agent without the full
       orchestrator stack.
"""

import argparse
import asyncio
from pathlib import Path
import sys
import time

# Ensure agents-service/src is on sys.path when running cli.py directly as a script
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from langchain_core.messages import HumanMessage

from core.config import settings
from graph.builder import build_graph
from graph.streaming import stream_turn
from memory.nodes import drain_pending_saves
from observability import configure_logging
from observability.metrics import collect_metrics, format_report

configure_logging()  # LOG_LEVEL in .env controls verbosity (step/tool timing logs are INFO)

DIM, RESET = "\033[2m", "\033[0m"


# ---------------------------------------------------------------------------
# Full multi-agent REPL (supervisor routes to the right specialist)
# ---------------------------------------------------------------------------

def show_step(event: dict) -> None:
    from streaming.langgraph_bridge import _event_type_for_step

    event_type = _event_type_for_step(event.get("step", "")).value.upper()
    status = event.get("status", "running")
    payload = event.get("payload", {})
    message = payload.get("message") or f"{event.get('agent')}: {event.get('step')}"

    CYAN = "\033[36m"
    GREEN = "\033[32m"
    RED = "\033[31m"
    YELLOW = "\033[33m"
    MAGENTA = "\033[35m"
    DIM = "\033[2m"
    RESET = "\033[0m"

    color = CYAN if event_type == "RESEARCHING" else (MAGENTA if event_type == "STRUCTURING" else (YELLOW if event_type == "PROCESSING" else GREEN))

    if status == "running":
        print(f"  {color}[SSE: {event_type} - RUNNING]{RESET} {message}", flush=True)
    elif status == "completed":
        print(f"  {GREEN}[SSE: {event_type} - COMPLETED]{RESET} {message}", flush=True)
    elif status == "failed":
        err = payload.get("error", "")
        print(f"  {RED}[SSE: {event_type} - FAILED]{RESET} {message} {DIM}({err}){RESET}", flush=True)


async def run_turn(graph, inputs: dict, config: dict, stream: bool) -> None:
    if not stream:
        result = await graph.ainvoke(inputs, config=config)
        print(f"Agent: {result['messages'][-1].content}\n")
        return

    replying = False
    async for item in stream_turn(graph, inputs, config):
        if item["type"] == "route":
            print(f"\033[33m  [SSE: CALLING_AGENT] → {item['agent']}\033[0m", flush=True)
        elif item["type"] == "step":
            show_step(item["event"])
        elif item["type"] == "token":
            if not replying:
                print("Agent: ", end="", flush=True)
                replying = True
            print(item["content"], end="", flush=True)
        elif item["type"] == "final":
            if replying:
                print("\n\033[32m  [SSE: COMPLETED] Turn complete.\033[0m", flush=True)
    print("\n")


async def run_repl(user_id: str, stream: bool):
    graph = build_graph()
    thread_config = {"configurable": {"thread_id": "demo-1"}}

    mode = "streaming" if stream else "non-streaming"
    print(f"PrepAmigo multi-agent system ready (memory user: {user_id}, {mode}).")
    print("Examples:")
    print("  'find me resources to learn dynamic programming'")
    print("  'research Datadog for a backend interview'")
    print("Type 'exit' to quit.\n")

    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye.")
            break
        if user_input.lower() in {"exit", "quit"}:
            break
        if not user_input:
            continue

        inputs = {"messages": [HumanMessage(content=user_input)], "user_id": user_id}
        await run_turn(graph, inputs, thread_config, stream)

    # memory saves run in the background; let in-flight ones finish
    await drain_pending_saves()


# ---------------------------------------------------------------------------
# Isolated Company Research Agent runner (for R&D / standalone testing)
# ---------------------------------------------------------------------------

async def run_company_research(company_name: str, role: str | None = None):
    """
    Directly invokes the CompanyResearchAgent in a minimal 2-node graph
    (company_research <-> cr_tools), bypassing the supervisor. Prints the
    full company dossier.
    """
    from agents.company_research_agent import CompanyResearchAgent
    from graph.router import route_after_agent
    from graph.state import AgentState
    from langgraph.graph import END, START, StateGraph
    from langgraph.prebuilt import ToolNode
    from memory.store import get_checkpointer
    from tools.company_research_tools import COMPANY_RESEARCH_TOOLS

    print(f"\n{'='*60}")
    print("  PrepAmigo — Company Research Agent")
    print(f"  Company : {company_name}")
    if role:
        print(f"  Role    : {role}")
    print(f"{'='*60}\n")

    g = StateGraph(AgentState)
    g.add_node("company_research", CompanyResearchAgent())
    g.add_node("cr_tools", ToolNode(COMPANY_RESEARCH_TOOLS, handle_tool_errors=True))
    g.add_edge(START, "company_research")
    g.add_conditional_edges("company_research", route_after_agent, {"tools": "cr_tools", END: END})
    g.add_edge("cr_tools", "company_research")
    graph = g.compile(checkpointer=get_checkpointer())

    if role:
        query = (
            f"I have an interview at {company_name} for a {role} position. "
            f"Please research {company_name} and produce a full company dossier "
            f"relevant to my interview preparation."
        )
    else:
        query = (
            f"Research {company_name} and produce a comprehensive company dossier "
            f"covering their products, engineering culture, tech stack, recent news, "
            f"financials (if public), and public interest trends."
        )

    print(f"Query: {query}\n")
    print("Executing Company Research Agent with live SSE stream telemetry...\n")

    thread_config = {"configurable": {"thread_id": f"cr-{company_name.lower().replace(' ', '-')}"}}
    replying = False
    profile_data = {}
    start_time = time.perf_counter()

    async for item in stream_turn(graph, {"messages": [HumanMessage(content=query)]}, config=thread_config, tokens=True):
        if item["type"] == "step":
            show_step(item["event"])
        elif item["type"] == "token":
            if not replying:
                print(f"\n{'='*60}")
                print("  [SSE: STRUCTURING] Streaming Dossier Output")
                print(f"{'='*60}\n")
                replying = True
            print(item["content"], end="", flush=True)
        elif item["type"] == "final":
            profile_data = (item.get("task_context") or {}).get("company_profile", {})

    elapsed_sec = time.perf_counter() - start_time
    print(f"\n\n{'='*60}")
    print("  [SSE: COMPLETED] Research Complete")
    print(f"{'='*60}")
    if profile_data:
        print(f"  Company      : {profile_data.get('name', company_name)}")
        if profile_data.get("industry"):
            print(f"  Industry     : {profile_data.get('industry')}")
        if profile_data.get("website"):
            print(f"  Website      : {profile_data.get('website')}")
        kg = profile_data.get("knowledge_graph") or {}
        if kg.get("headquarters"):
            print(f"  Headquarters : {kg.get('headquarters')}")
        organic = profile_data.get("organic_results") or []
        news = profile_data.get("recent_developments") or []
        print(f"  Evidence     : {len(organic)} tech/culture sources, {len(news)} news articles.")
    print(f"  Time Elapsed : {elapsed_sec:.2f}s")
    print(f"{'='*60}\n")


# ---------------------------------------------------------------------------
# Full Pipeline Runner (--prep mode: orchestrator → skill gap → research)
# ---------------------------------------------------------------------------

DUMMY_RESUME = """
John Doe — Software Engineer

Skills: Python, JavaScript, REST APIs, Git, Docker, PostgreSQL

Experience:
- Backend Engineer at StartupXYZ (2 years): Built REST APIs in Python/FastAPI,
  maintained PostgreSQL databases, deployed services on AWS EC2.
- Junior Developer at AgencyABC (1 year): Frontend work in JavaScript/React.

Projects:
- URL Shortener: Python + FastAPI + Redis. Deployed on AWS.
- Personal Portfolio: React + Tailwind CSS.

Education: B.Sc. Computer Science, State University (2021)
"""


def _resource_type_counts(resources: list[dict]) -> str:
    """Summarize resource counts by type for display."""
    counts: dict[str, int] = {}
    for r in resources:
        rt = r.get("resource_type", "other")
        counts[rt] = counts.get(rt, 0) + 1
    return ", ".join(f"{c} {t}s" for t, c in sorted(counts.items()) if c)


async def run_full_prep(company: str, role: str, location: str, resume_text: str, days: int | None = None):
    """
    Runs the full interview prep pipeline in silent mode (no SSE noise printed).
    All state passes internally between agents. Displays only the final
    research output — exactly what the Planner Agent would receive as input.

    Uses a minimal isolated graph (no supervisor / memory nodes) so this
    test runs the orchestration chain directly.
    """
    from agents.interview_prep_orchestrator import (
        InterviewPrepOrchestrator,
        route_after_evaluate,
        route_after_prepare,
    )
    from graph.state import AgentState
    from langgraph.graph import StateGraph, START, END
    from memory.store import get_checkpointer

    W = 68
    BOLD, GREEN, YELLOW, RED, CYAN, DIM, RESET = (
        "\033[1m", "\033[32m", "\033[33m", "\033[31m", "\033[36m", "\033[2m", "\033[0m"
    )

    print(f"\n{'═'*W}")
    print(f"  {BOLD}PrepAmigo — Full Pipeline Test{RESET}")
    print(f"  Company  : {BOLD}{company}{RESET}  │  Role : {role}  │  Location : {location}")
    print(f"  Plan     : {days or settings.plan_total_days} days  │  research capped at "
          f"{settings.research_max_gaps} skill gap(s)")
    has_resume = bool(resume_text.strip())
    print(f"  Resume   : {'provided — gap analysis will run' if has_resume else 'none — gap step will be skipped'}")
    serpapi_mode = f"{GREEN}live API (SERPAPI_ENABLED=true){RESET}" if settings.serpapi_enabled else f"{DIM}dummy fixtures (SERPAPI_ENABLED=false){RESET}"
    print(f"  SerpApi  : {serpapi_mode}")
    print(f"{'═'*W}")
    print(f"\n  {CYAN}Running pipeline...{RESET} All state passes internally between agents.\n")

    # Minimal isolated graph: no supervisor, no memory nodes
    # Wired identically to builder.py's interview_prep section
    interview_prep = InterviewPrepOrchestrator()
    g = StateGraph(AgentState)
    g.add_node("prep",          interview_prep.prepare)
    g.add_node("prep_run",      interview_prep.run_parallel)
    g.add_node("prep_skill_gap",interview_prep.run_skill_gap)
    g.add_node("prep_research", interview_prep.run_research)
    g.add_node("prep_plan",     interview_prep.run_planner)
    g.add_node("prep_evaluate", interview_prep.evaluate)
    g.add_edge(START, "prep")
    g.add_conditional_edges(
        "prep", route_after_prepare,
        {"run": "prep_run", "pause": END, "stop": END},
    )
    g.add_edge("prep_run",       "prep_skill_gap")
    g.add_edge("prep_skill_gap", "prep_research")
    g.add_edge("prep_research",  "prep_plan")
    g.add_edge("prep_plan",      "prep_evaluate")
    g.add_conditional_edges(
        "prep_evaluate", route_after_evaluate,
        {"save": END, "pause": END},
    )
    graph = g.compile(checkpointer=get_checkpointer())

    inputs = {
        "messages": [HumanMessage(content=f"Prepare me for {role} at {company} in {location}")],
        "user_id": "cli-prep-test",
        "interview_prep_input": {"company": company, "role": role, "location": location},
        "task_context": {"candidate_resume_text": resume_text},
        "plan_total_days": days or settings.plan_total_days,
    }
    thread_config = {"configurable": {"thread_id": f"prep-{company.lower().replace(' ', '-')}"}}

    start_time = time.perf_counter()
    with collect_metrics() as run_metrics:
        try:
            state = await graph.ainvoke(inputs, config=thread_config)
        except Exception as exc:
            elapsed = time.perf_counter() - start_time
            print(f"\n  {RED}Pipeline failed after {elapsed:.2f}s: {exc}{RESET}\n")
            _print_metrics(run_metrics.summary())
            return
    elapsed_sec = time.perf_counter() - start_time

    # every model call failing means nothing below is a real result: say so
    # up front instead of letting empty stages look like findings
    totals = run_metrics.summary()
    llm_failures = [f for f in totals["failures"] if f["kind"] == "llm"]
    if llm_failures and sum(f["count"] for f in llm_failures) == totals["totals"]["llm_calls"]:
        print(f"\n  {RED}{BOLD}PIPELINE DID NOT RUN: every model call failed.{RESET}")
        print(f"  {RED}{llm_failures[0]['error']}{RESET}")
        print(f"  {DIM}Check the network connection and that the model server is reachable, then rerun. "
              f"The sections below are empty for that reason.{RESET}")

    tc = state.get("task_context") or {}
    cp = tc.get("company_profile") or {}
    ji = tc.get("job_intelligence") or {}
    sg = tc.get("skill_gap") or {}
    materials = state.get("researched_materials") or []

    # ── HEADER ────────────────────────────────────────────────────────────────
    print(f"\n{'═'*W}")
    print(f"  {BOLD}RESEARCH OUTPUT → What the Planner Agent Would Receive{RESET}")
    print(f"{'═'*W}")

    # ── STAGE 1: Company + Job Intelligence ──────────────────────────────────
    print(f"\n  {BOLD}STAGE 1 — COMPANY + JOB INTELLIGENCE{RESET}")
    if cp:
        print(f"    {GREEN}✓{RESET} Company Profile  : {cp.get('name', company)}", end="")
        if cp.get("industry"):
            print(f" ({cp['industry']})", end="")
        print()
        brief = cp.get("brief") or {}
        if brief.get("tech_stack"):
            print(f"      Tech stack        : {', '.join(brief['tech_stack'])}")
        if brief.get("engineering_focus"):
            print(f"      Engineering focus : {'; '.join(brief['engineering_focus'])}")
        org_count = len(cp.get("organic_results") or [])
        news_count = len(cp.get("recent_developments") or [])
        print(f"      Sources collected : {org_count} tech/culture, {news_count} news articles")
    else:
        print(f"    {YELLOW}○{RESET} Company Profile  : not available (fixture may not cover this company)")

    if ji:
        skills = ji.get("skills") or []
        top_skills = [s.get("name", "") for s in skills[:8] if s.get("name")]
        print(f"    {GREEN}✓{RESET} Required Skills  : {len(skills)} identified")
        if top_skills:
            print(f"      Top skills        : {', '.join(top_skills)}")
        cov = ji.get("coverage", "")
        if cov:
            print(f"      Coverage          : {cov}")
    else:
        print(f"    {YELLOW}○{RESET} Job Intelligence  : not available (fixture may not cover this role)")

    # ── STAGE 2: Skill Gap Analysis ───────────────────────────────────────────
    print(f"\n  {BOLD}STAGE 2 — SKILL GAP ANALYSIS{RESET}")
    if sg.get("no_resume"):
        print(f"    {YELLOW}○{RESET} Skipped — no resume provided")
        print(f"      {DIM}The planner would receive an empty gap list and build a general prep plan.{RESET}")
    elif sg.get("no_requirements"):
        print(f"    {RED}✗{RESET} Skipped — job intelligence returned no required skills, so there is nothing "
              f"to compare the resume against")
        print(f"      {DIM}Usually a model/network timeout in Stage 1 (see the log above). Rerun: "
              f"cached steps are reused.{RESET}")
    elif sg:
        score = sg.get("readiness_score", 0)
        score_color = GREEN if score >= 70 else (YELLOW if score >= 40 else RED)
        print(f"    {GREEN}✓{RESET} Readiness Score  : {score_color}{BOLD}{score}%{RESET}  ({sg.get('coverage', 'unknown')} coverage)")
        gaps = sg.get("priority_gaps") or []
        matched = sg.get("matched_skills") or []
        print(f"      Total gaps        : {len(gaps)} ({len([g for g in gaps if g.get('status')=='missing'])} missing, "
              f"{len([g for g in gaps if g.get('status')=='partial'])} partial)")
        if matched:
            matched_names = [m.get("skill_name", "") for m in matched[:5] if m.get("skill_name")]
            print(f"      Already strong    : {', '.join(matched_names)}" + (" ..." if len(matched) > 5 else ""))
        if gaps:
            print(f"\n    {'Skill':<28} {'Status':<10} {'Effort'}")
            print(f"    {'─'*28} {'─'*10} {'─'*6}")
            for gap in gaps:
                color = RED if gap.get("effort") == "High" else YELLOW
                print(f"    {gap.get('skill','?'):<28} {gap.get('status','?'):<10} {color}{gap.get('effort','?')}{RESET}")
    else:
        print(f"    {RED}✗{RESET} Analysis failed or unavailable")

    # ── STAGE 3: Research Modules (Planner's primary input) ──────────────────
    print(f"\n  {BOLD}STAGE 3 — RESEARCH MODULES  {DIM}(Planner builds roadmap from these){RESET}")
    if not materials:
        if not sg.get("priority_gaps"):
            print(f"    {YELLOW}○{RESET} No modules — no gaps identified (or no resume provided)")
        else:
            print(f"    {RED}✗{RESET} No modules produced — research stage may have failed")
    else:
        print(f"    {GREEN}✓{RESET} {len(materials)} learning module(s) produced\n")
        for i, m in enumerate(materials, 1):
            resources = m.get("resources") or []
            is_mock = m.get("uses_mock_sources", False)
            preview = m.get("content_markdown", "")[:180].replace("\n", " ").strip()
            print(f"    {BOLD}Module {i}: \"{m.get('topic', '?')}\"{RESET}")
            print(f"      Depth     : {m.get('depth', '?')}")
            print(f"      Resources : {len(resources)} total  ({_resource_type_counts(resources) or 'none categorized'})")
            print(f"      Sources   : {'mock/fixture (SERPAPI_ENABLED=false)' if is_mock else 'live'}")
            if preview:
                print(f"      Preview   : {DIM}{preview}...{RESET}")
            print()

    # ── STAGE 4: Study Plan ───────────────────────────────────────────────────
    output = state.get("study_plan")
    plan = (output or {}).get("plan")
    sprints = (output or {}).get("sprints") or ((plan or {}).get("sprints") if plan else [])
    sprint_days = (output or {}).get("sprint_days") or []
    print(f"\n  {BOLD}STAGE 4 — STUDY PLAN{RESET}")
    if not plan:
        print(f"    {YELLOW}○{RESET} No plan — no skill gaps or research modules to plan around")
    else:
        print(f"    {GREEN}✓{RESET} {plan['total_days']} days in {len(sprints)} sprint(s), "
              f"{plan['start_date']} → {plan['end_date']}  {DIM}(wording: {output.get('narrative_source', 'llm')}){RESET}\n")
        
        days_by_sprint_num = {}
        for d in sprint_days:
            days_by_sprint_num.setdefault(d.get("sprint_number", 1), []).append(d)

        # long plans: one line per sprint (first → last day); every day is in the saved JSON
        for sprint in sprints:
            s_num = sprint.get("sprint_number", 1)
            days = days_by_sprint_num.get(s_num) or sprint.get("sprint_days", [])
            if days:
                span = days[0]["topic_title"] if len(days) == 1 else f"{days[0]['topic_title']} … {days[-1]['topic_title']}"
                print(f"    {BOLD}S{s_num:>2}{RESET} D{days[0]['day_number']}-{days[-1]['day_number']} "
                      f"{sprint['sprint_name']}  {DIM}{span}{RESET}")
            else:
                print(f"    {BOLD}S{s_num:>2}{RESET} {sprint['sprint_name']} ({sprint['total_days']} days)")

        coverage = output.get("coverage", {})
        if coverage.get("unresearched"):
            print(f"\n    {YELLOW}○{RESET} No research for: {', '.join(coverage['unresearched'])} (planned, no references)")
        if coverage.get("not_scheduled"):
            print(f"    {YELLOW}○{RESET} Not scheduled (plan too short): {', '.join(coverage['not_scheduled'])}")
        pack_counts = ", ".join(f"{k}: {len(v)}" for k, v in (output.get("resource_pack") or {}).items())
        print(f"    Resource Pack : {pack_counts or 'none'}")
        saved = state.get("study_plan_path")
        print(f"    Saved JSON    : {BOLD}{saved}{RESET}" if saved else f"    Saved JSON    : {DIM}not saved (PLAN_OUTPUT_DIR empty or write failed){RESET}")

        # MongoDB Sequential Storage Status
        db_sync = state.get("db_sync") or output.get("db_sync")
        if db_sync and db_sync.get("success"):
            print(f"\n    {GREEN}✓{RESET} {BOLD}MongoDB Sequential Sync Complete:{RESET}")
            print(f"      Plan ID       : {GREEN}{db_sync.get('plan_id')}{RESET}")
            print(f"      Sprints       : {db_sync.get('sprints_count')} created")
            print(f"      Sprint Days   : {db_sync.get('total_days_created')} created")
        elif db_sync and not db_sync.get("success"):
            print(f"\n    {YELLOW}○{RESET} MongoDB Sequential Sync: {DIM}{db_sync.get('error')}{RESET}")

    # ── DATA FLOW STATUS ─────────────────────────────────────────────────────
    print(f"  {BOLD}DATA FLOW STATUS  {DIM}(did state pass between agents correctly?){RESET}")
    def flow_check(label: str, ok: bool, note: str = ""):
        sym = f"{GREEN}✓{RESET}" if ok else f"{RED}✗{RESET}"
        suffix = f"  {DIM}{note}{RESET}" if note else ""
        print(f"    {sym}  {label}{suffix}")

    flow_check(
        f"Company Research  → Skill Gap",
        bool(cp and sg and not sg.get("error")),
        f"company_profile passed" if cp else "company_profile missing"
    )
    flow_check(
        f"Job Intelligence  → Skill Gap",
        bool(ji and sg and not sg.get("error")),
        f"{len(ji.get('skills') or [])} skills passed" if ji else "job_intelligence missing"
    )
    gap_topics = state.get("skill_gaps") or []
    flow_check(
        f"Skill Gap         → Research",
        bool(gap_topics or sg.get("no_resume")),
        f"{len(gap_topics)} gap(s) passed" if gap_topics else ("no resume — 0 gaps" if sg.get("no_resume") else "gaps missing")
    )
    flow_check(
        f"Research          → Planner",
        bool(materials or sg.get("no_resume")),
        f"{len(materials)} module(s) in state[\"researched_materials\"]" if materials else "0 modules (no gaps to research)"
    )
    flow_check(
        f"Planner           → Output",
        bool(plan or not (materials or gap_topics)),
        f"{output.get('id', 'plan')}, {plan['total_days'] if plan else 0} day(s), validated against DB schema" if plan else "plan missing"
    )

    time_str = f"{elapsed_sec:.2f}s"
    if elapsed_sec >= 60:
        mins = int(elapsed_sec // 60)
        secs = elapsed_sec % 60
        time_str += f" ({mins}m {secs:.1f}s)"

    print(f"\n  {BOLD}TOTAL PIPELINE TIME{RESET} : {CYAN}{BOLD}{time_str}{RESET}")
    _print_metrics(run_metrics.summary())
    print(f"\n{'═'*W}\n")


def _print_metrics(summary: dict) -> None:
    """Per-agent time/token/cache breakdown (observability/metrics.py),
    printed and written to the log file for later comparison."""
    import json
    import logging

    BOLD, DIM, RED, RESET = "\033[1m", "\033[2m", "\033[31m", "\033[0m"
    models = ", ".join(summary["models"]) or "none called"
    print(f"\n  {BOLD}RUN METRICS{RESET}  {DIM}model: {models}{RESET}")
    lines = format_report(summary)
    for i, line in enumerate(lines):
        style = RED if line.startswith("FAILED") else (DIM if i >= len(lines) - 1 else "")
        print(f"    {style}{line}{RESET}")
    logging.getLogger("run_metrics").info("prep run metrics %s", json.dumps(summary))




# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="PrepAmigo CLI — multi-agent interview preparation system",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Full multi-agent REPL (supervisor routes to the right agent)
  uv run python src/cli.py --user subhaan

  # Standalone Company Research Agent (bypasses supervisor)
  uv run python src/cli.py --company "Datadog"
  uv run python src/cli.py --company "Stripe" --role "Backend Engineer"

  # Full pipeline test: company+job → skill gap → research → evaluate
  uv run python src/cli.py --prep --company "Stripe" --role "Backend Engineer" --location "San Francisco"
  uv run python src/cli.py --prep --company "Anthropic" --role "ML Engineer" --location "Remote" --resume-file resume.txt
        """,
    )
    parser.add_argument("--user", default="demo-user", help="user id that keys long-term memory (REPL mode)")
    parser.add_argument(
        "--stream",
        action=argparse.BooleanOptionalAction,
        default=settings.stream_responses,
        help="print the reply as it is generated (default: STREAM_RESPONSES; REPL mode)",
    )
    parser.add_argument("--company", default=None, help="company name (company research mode or prep mode)")
    parser.add_argument("--role", default=None, help="target role (used with --company or --prep)")
    parser.add_argument("--location", default="Remote", help="job location (prep mode)")
    parser.add_argument("--prep", action="store_true", help="run full pipeline: company+job → skill gap → research")
    parser.add_argument("--resume-file", default=None, help="path to plain-text resume file (prep mode)")
    parser.add_argument("--resume-text", default=None, help="inline resume text string (prep mode)")
    parser.add_argument("--no-cache", action="store_true",
                        help="bypass every cache for this run (API responses, transcripts, book/paper lookups, "
                             "LLM responses, stored job profiles, SerpApi's own cache): nothing is read from or "
                             "written to any of them")
    parser.add_argument("--days", type=int, default=None,
                        help=f"plan length in days (prep mode; default PLAN_TOTAL_DAYS={settings.plan_total_days})")

    args = parser.parse_args()
    if args.no_cache:
        from tools.cache import bypass_caches

        bypass_caches()
        print("Caches bypassed for this run (--no-cache): every API and model call is live, including "
              "SerpApi's own cache (each search costs a credit).")

    if args.prep:
        if not args.company or not args.role:
            parser.error("--prep requires --company and --role")
        # Resolve resume text: file > inline > dummy
        resume_text = DUMMY_RESUME
        if args.resume_file:
            try:
                import pathlib
                p = pathlib.Path(args.resume_file)
                if not p.is_file():
                    # If invoked inside agents-service with path prefixed by agents-service/
                    stripped = pathlib.Path(*[part for part in p.parts if part != "agents-service"])
                    if stripped.is_file():
                        p = stripped
                resume_text = p.read_text(encoding="utf-8")
                print(f"Using resume from: {p}")
            except Exception as exc:
                print(f"Warning: could not read resume file ({exc}). Using dummy resume.")
        elif args.resume_text:
            resume_text = args.resume_text
        else:
            print("No --resume-file or --resume-text provided. Using built-in dummy resume for connectivity test.")
        asyncio.run(run_full_prep(args.company, args.role, args.location, resume_text, args.days))
    elif args.company:
        asyncio.run(run_company_research(args.company, args.role))
    else:
        asyncio.run(run_repl(args.user, args.stream))



if __name__ == "__main__":
    main()
