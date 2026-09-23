"""Run the graph locally: uv run python src/cli.py"""

from langchain_core.messages import HumanMessage

from graph.builder import build_graph


def main():
    graph = build_graph()
    thread_config = {"configurable": {"thread_id": "demo-1"}}

    print("Multi-agent system ready. Type 'exit' to quit.\n")
    while True:
        user_input = input("You: ").strip()
        if user_input.lower() in {"exit", "quit"}:
            break

        result = graph.invoke(
            {"messages": [HumanMessage(content=user_input)]},
            config=thread_config,
        )
        print(f"Agent: {result['messages'][-1].content}\n")


if __name__ == "__main__":
    main()