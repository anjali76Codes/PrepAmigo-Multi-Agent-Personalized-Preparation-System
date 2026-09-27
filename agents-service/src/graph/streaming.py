"""
One streaming interface for a whole chat turn, shared by the CLI and the
SSE endpoint. `stream_turn` runs the graph once and yields, in order:

  {"type": "route", "agent": "research"}          supervisor's decision
  {"type": "step", "event": AgentEvent}          agent step progress (graph/events.py)
  {"type": "token", "agent": "chat", "content": "..."}   reply text as generated
  {"type": "final", "agent": "chat", "content": "..."}   the complete reply

Concatenating the token contents always gives the text to display: when a
node's reply is longer than what its LLM streamed (research appends its
source list) or nothing was streamed (tokens off, canned replies), the
missing text arrives as a last token before "final".

Internal LLM calls (routing, extraction) are tagged with
graph.events.INTERNAL_LLM_CONFIG, so only user-facing text streams.
"""
from typing import Any, AsyncIterator

from langchain_core.messages import AIMessageChunk

from agents.registry import SPECIALIST_NAMES


def message_text(message: Any) -> str:
    content = getattr(message, "content", message)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            item.get("text", "") if isinstance(item, dict) else str(item)
            for item in content
            if not isinstance(item, dict) or item.get("type") == "text"
        )
    return str(content)


def _remainder(final: str, streamed: str) -> str:
    """Text of `final` not yet shown after `streamed` was printed."""
    shown = streamed.strip()
    if not shown:
        return final
    if final.startswith(shown):
        return final[len(shown):]
    # the node replaced what it streamed (e.g. failed after synthesis)
    return "\n\n" + final


async def stream_turn(
    graph: Any, inputs: dict, config: dict, *, tokens: bool = True
) -> AsyncIterator[dict]:
    modes = ["updates", "custom"] + (["messages"] if tokens else [])
    streamed: dict[str, str] = {}
    async for mode, chunk in graph.astream(inputs, config=config, stream_mode=modes):
        if mode == "messages":
            message, metadata = chunk
            # whole messages here are node outputs, handled via "updates"
            if not isinstance(message, AIMessageChunk):
                continue
            node = metadata.get("langgraph_node", "")
            text = message_text(message)
            if text:
                streamed[node] = streamed.get(node, "") + text
                yield {"type": "token", "agent": node, "content": text}
        elif mode == "custom":
            yield {"type": "step", "event": chunk}
        else:
            for node, update in chunk.items():
                if node == "supervisor" and update:
                    yield {"type": "route", "agent": update.get("next_agent")}
                elif node in SPECIALIST_NAMES and update and update.get("messages"):
                    message = update["messages"][-1]
                    # a tool-calling specialist (e.g. company_research) can
                    # run its own node several times before it's done; a
                    # message with pending tool_calls isn't the final reply
                    if getattr(message, "tool_calls", None):
                        continue
                    final = message_text(message)
                    rest = _remainder(final, streamed.get(node, ""))
                    if rest:
                        yield {"type": "token", "agent": node, "content": rest}
                    yield {"type": "final", "agent": node, "content": final}
