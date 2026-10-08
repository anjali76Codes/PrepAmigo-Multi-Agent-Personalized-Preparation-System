# Server-Sent Events (SSE) State Streaming Architecture

## 1. System Overview

```
Frontend (EventSource / useAgentStream)
       │  ▲ (SSE Stream: Replay + Live + 15s Heartbeats)
       ▼  │
Node.js API Gateway (BFF)
       │  ▲ (Redis Pub/Sub: `agent:events:{runId}` + Replay Buffer: `agent:history:{runId}`)
       ▼  │
Python FastAPI Worker (LangGraph / Agents)
```

---

## 2. Why Did You See Consecutive `ping` Messages?

- **SSE Heartbeat (Keep-Alive):** Node.js dispatches `event: ping` every **15 seconds** to prevent browser/Nginx proxy timeouts.
- **Worker Crash Handling:** If Python is stopped (`Ctrl + C`) mid-execution without sending `completed` or `failed`, Node.js previously waited on Redis indefinitely.
- **Watchdog Inactivity Timeout:** We added a **35-second watchdog timer**. If Python stops emitting events (e.g. crashes or is killed), Node.js automatically emits a `failed` event (`"Agent execution timed out or Python worker disconnected"`) and cleanly terminates the SSE stream.

---

## 2.5. The Python Side Is Agent-Agnostic

`execute_agent_stream` (agents-service/src/streaming/runner.py) does not special-case any agent by name. The real (`USE_DUMMY_STREAM=false`) path runs the actual LangGraph multi-agent graph and translates its generic step events through `streaming/langgraph_bridge.py`, so whichever specialist the supervisor routes to — chat, content research, or a new one registered in `agents/registry.py` — shows up correctly here with no change to this package. See `agents-service/README.md` ("Streaming internals") for how an agent's steps get mapped to `thinking`/`researching`/`structuring`/etc.

## 3. How Agents Can Directly Emit Events

Any agent, tool, or node in Python can import `get_event_publisher` to publish domain events directly to the client:

```python
from streaming import get_event_publisher, EventType

publisher = get_event_publisher()

# 1. Specialist Agent started
await publisher.emit_event(
    run_id=run_id,
    event_type=EventType.CALLING_AGENT,
    payload={"agent": "hotel_booking", "message": "Analyzing hotel preferences..."}
)

# 2. Tool query execution
await publisher.emit_event(
    run_id=run_id,
    event_type=EventType.RESEARCHING,
    payload={"tool": "search_hotels", "message": "Querying live booking APIs..."}
)

# 3. Guardrails / validation
await publisher.emit_event(
    run_id=run_id,
    event_type=EventType.PROCESSING,
    payload={"node": "guardrails", "message": "Validating safety rules..."}
)

# 4. Final completion
await publisher.emit_event(
    run_id=run_id,
    event_type=EventType.COMPLETED,
    payload={"status": "success", "result": {...}}
)
```

---

## 4. Standard Event Contract Types

Every event sent over SSE uses the same envelope:
`{runId, type, timestamp, payload}`. Every payload has `agent`, `step`, and
`status`. `type` describes the UI event category; `status` preserves the value
provided by the agent, including lifecycle values (`running`, `completed`,
`failed`, `waiting`) and outcome values (`success`, `partial`). Agent-specific
details (for example `message`, `tool_timings_ms`, or `result`) remain alongside
those standard fields.

Every tool invocation is its own `tool_call` event type (step `tool_<tool name>`),
using the runtime tool name, so instrumentation does not need a second list of
tool names. One call emits `status: "running"` then `"completed"` or `"failed"`;
`payload.tool_call_id` pairs them, since parallel calls of the same tool
interleave (calls made through the LLM's own tool-calling loop carry the
model's tool-call id):

```json
{"runId":"run-123","type":"tool_call","timestamp":1791112345678,"payload":{"agent":"research","step":"tool_search_technical_docs","status":"running","tool":"search_technical_docs","tool_call_id":"4ff48ae7f069","query":"dynamic programming","limit":12,"message":"Tool search_technical_docs running: dynamic programming"}}
{"runId":"run-123","type":"tool_call","timestamp":1791112348901,"payload":{"agent":"research","step":"tool_search_technical_docs","status":"completed","tool":"search_technical_docs","tool_call_id":"4ff48ae7f069","query":"dynamic programming","limit":12,"source":"serpapi","result_count":8,"duration_ms":742,"message":"Tool search_technical_docs returned 8 results."}}
```

Progress reports tool names, query context, counts, and timing. It does not
stream hidden model reasoning or full raw search results. A failed tool is a
non-terminal `tool_call` event with `payload.status: "failed"` and `error`;
the SSE `failed` event type is reserved for a failed run.

The backend relays each event as `event: <type>`, so an `EventSource` consumer
must register a listener per type, `tool_call` included, or those frames are
dropped silently. `frontend/src/lib/agentStream/toolCall.ts` (`toolCallText`)
turns a `tool_call` payload into a one-line status for the UI.

| Event Type      | Purpose                                                        |
| :-------------- | :------------------------------------------------------------- |
| `thinking`      | Supervisor / router evaluating intent and planning next steps. |
| `calling_agent` | Handoff to a specialist agent (e.g., flight booking, hotels).  |
| `researching`   | Research-stage progress (searches running, results merged).    |
| `tool_call`     | One tool invocation: running, then completed/failed (non-terminal). |
| `processing`    | Safety checks, guardrails, policy validation.                  |
| `structuring`   | Synthesizing results and structuring final response payload.   |
| `completed`     | Terminal event containing final output data.                   |
| `failed`        | Terminal event indicating error, timeout, or failure.          |
| `ping`          | 15s keep-alive heartbeat (ignored by UI business logic).       |

For `interview_intelligence`, the final `completed` event includes the standard fields plus `message: "<final Markdown report>"`. The full report is sent once, after synthesis; progress events contain status/count metadata only.

---

## 5. Testing Quick Reference

1. **Trigger Agent Run:**

   ```bash
   curl -X POST http://localhost:3000/api/agent/run \
     -H "Content-Type: application/json" \
     -d '{"query": "Flights to Paris"}'
   # Returns: {"runId": "uuid"}
   ```

2. **Stream Execution:**

   ```bash
   curl -N http://localhost:3000/api/agent/stream/<RUN_ID>
   ```

3. **Simulate Crash / Reconnect:**
   - Kill Python mid-run: Watchdog emits `failed` after 35s.
   - Disconnect client (`Ctrl + C`) & reconnect:
     ```bash
     curl -N -H "Last-Event-ID: <LAST_EVENT_ID>" http://localhost:3000/api/agent/stream/<RUN_ID>
     ```
     Redis automatically replays missed history.
