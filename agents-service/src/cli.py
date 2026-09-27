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

from langchain_core.messages import HumanMessage

from config import settings
from graph.builder import build_graph
from graph.streaming import stream_turn
from memory.nodes import drain_pending_saves
from observability import configure_logging

configure_logging()  # LOG_LEVEL in .env controls verbosity (step/tool timing logs are INFO)

DIM, RESET = "\033[2m", "\033[0m"


# ---------------------------------------------------------------------------
# Full multi-agent REPL (supervisor routes to the right specialist)
# ---------------------------------------------------------------------------

def show_step(event: dict) -> None:
    if event["status"] == "running":
        return
    mark = "done" if event["status"] == "completed" else f"failed: {event['payload'].get('error', '')}"
    print(f"{DIM}  · {event['agent']}: {event['step']} {mark}{RESET}", flush=True)


async def run_turn(graph, inputs: dict, config: dict, stream: bool) -> None:
    if not stream:
        result = await graph.ainvoke(inputs, config=config)
        print(f"Agent: {result['messages'][-1].content}\n")
        return

    replying = False
    async for item in stream_turn(graph, inputs, config):
        if item["type"] == "route":
            print(f"{DIM}  → {item['agent']}{RESET}", flush=True)
        elif item["type"] == "step":
            show_step(item["event"])
        elif item["type"] == "token":
            if not replying:
                print("Agent: ", end="", flush=True)
                replying = True
            print(item["content"], end="", flush=True)
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
    print("Researching... (this may take 30-60 seconds depending on your LLM)\n")

    thread_config = {"configurable": {"thread_id": f"cr-{company_name.lower().replace(' ', '-')}"}}
    result = await graph.ainvoke({"messages": [HumanMessage(content=query)]}, config=thread_config)

    print(f"\n{'='*60}")
    print("  COMPANY DOSSIER")
    print(f"{'='*60}\n")
    print(result["messages"][-1].content)
    print(f"\n{'='*60}\n")


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
        """,
    )
    parser.add_argument("--user", default="demo-user", help="user id that keys long-term memory (REPL mode)")
    parser.add_argument(
        "--stream",
        action=argparse.BooleanOptionalAction,
        default=settings.stream_responses,
        help="print the reply as it is generated (default: STREAM_RESPONSES; REPL mode)",
    )
    parser.add_argument("--company", default=None, help="run the Company Research Agent standalone for this company")
    parser.add_argument("--role", default=None, help="(optional) target role, used with --company")

    args = parser.parse_args()
    if args.company:
        asyncio.run(run_company_research(args.company, args.role))
    else:
        asyncio.run(run_repl(args.user, args.stream))


if __name__ == "__main__":
    main()
