"""
PrepAmigo CLI Runner
--------------------
Provides two modes for local development and testing:

  Default mode (no args):
    uv run python src/cli.py
    → Full multi-agent REPL. The supervisor routes your message to the
      appropriate specialist agent.

  Company Research mode:
    uv run python src/cli.py --company "Datadog"
    uv run python src/cli.py --company "Stripe" --role "Backend Engineer"
    → Directly invokes the Company Research Agent in isolation, bypassing
      the supervisor. Useful for R&D on the agent without needing the
      full orchestrator stack.
"""

import argparse
import sys
from langchain_core.messages import HumanMessage

from graph.builder import build_graph


# ---------------------------------------------------------------------------
# Full multi-agent REPL (supervisor routes to the right specialist)
# ---------------------------------------------------------------------------

def run_repl():
    graph = build_graph()
    thread_config = {"configurable": {"thread_id": "demo-1"}}

    print("PrepAmigo multi-agent system ready.")
    print("Examples:")
    print("  'Research Datadog for a backend interview'")
    print("  'Find flights from Mumbai to Bangalore on 2026-11-01'")
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

        result = graph.invoke(
            {"messages": [HumanMessage(content=user_input)]},
            config=thread_config,
        )
        print(f"\nAgent: {result['messages'][-1].content}\n")


# ---------------------------------------------------------------------------
# Isolated Company Research Agent runner (for R&D / standalone testing)
# ---------------------------------------------------------------------------

def run_company_research(company_name: str, role: str | None = None):
    """
    Directly invokes the CompanyResearchAgent in a minimal single-node
    graph, bypassing the supervisor. Prints the full company dossier.
    """
    from langchain_core.messages import SystemMessage
    from agents.company_research_agent import CompanyResearchAgent
    from graph.state import AgentState
    from langgraph.graph import StateGraph, START, END
    from langgraph.prebuilt import ToolNode
    from tools.company_research_tools import COMPANY_RESEARCH_TOOLS
    from memory.store import get_checkpointer
    from graph.router import route_after_agent

    print(f"\n{'='*60}")
    print(f"  PrepAmigo — Company Research Agent")
    print(f"  Company : {company_name}")
    if role:
        print(f"  Role    : {role}")
    print(f"{'='*60}\n")

    # Build a minimal 2-node graph: company_research ⇄ cr_tools
    agent = CompanyResearchAgent()

    g = StateGraph(AgentState)
    g.add_node("company_research", agent)
    g.add_node("cr_tools", ToolNode(COMPANY_RESEARCH_TOOLS, handle_tool_errors=True))
    g.add_edge(START, "company_research")

    g.add_conditional_edges(
        "company_research",
        route_after_agent,
        {"tools": "cr_tools", END: END},
    )
    g.add_edge("cr_tools", "company_research")

    graph = g.compile(checkpointer=get_checkpointer())

    # Compose the user message
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
    print("Researching... (this may take 30–60 seconds depending on your LLM)\n")

    thread_config = {"configurable": {"thread_id": f"cr-{company_name.lower().replace(' ', '-')}"}}
    result = graph.invoke(
        {"messages": [HumanMessage(content=query)]},
        config=thread_config,
    )

    final_message = result["messages"][-1].content
    print(f"\n{'='*60}")
    print("  COMPANY DOSSIER")
    print(f"{'='*60}\n")
    print(final_message)
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
  uv run python src/cli.py

  # Standalone Company Research Agent (bypasses supervisor)
  uv run python src/cli.py --company "Datadog"
  uv run python src/cli.py --company "Stripe" --role "Backend Engineer"
  uv run python src/cli.py --company "Google" --role "Software Engineer L4"
        """,
    )
    parser.add_argument(
        "--company",
        type=str,
        default=None,
        help="Run the Company Research Agent in isolation for the given company name.",
    )
    parser.add_argument(
        "--role",
        type=str,
        default=None,
        help="(Optional) Target role to tailor the company dossier (used with --company).",
    )

    args = parser.parse_args()

    if args.company:
        run_company_research(company_name=args.company, role=args.role)
    else:
        run_repl()


if __name__ == "__main__":
    main()