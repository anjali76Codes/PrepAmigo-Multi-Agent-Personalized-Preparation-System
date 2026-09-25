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

* **SSE Heartbeat (Keep-Alive):** Node.js dispatches `event: ping` every **15 seconds** to prevent browser/Nginx proxy timeouts.
* **Worker Crash Handling:** If Python is stopped (`Ctrl + C`) mid-execution without sending `completed` or `failed`, Node.js previously waited on Redis indefinitely.
* **Watchdog Inactivity Timeout:** We added a **35-second watchdog timer**. If Python stops emitting events (e.g. crashes or is killed), Node.js automatically emits a `failed` event (`"Agent execution timed out or Python worker disconnected"`) and cleanly terminates the SSE stream.

---

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

| Event Type | Purpose |
| :--- | :--- |
| `thinking` | Supervisor / router evaluating intent and planning next steps. |
| `calling_agent` | Handoff to a specialist agent (e.g., flight booking, hotels). |
| `researching` | Tool execution (e.g. Google Flights, SerpApi, DB search). |
| `processing` | Safety checks, guardrails, policy validation. |
| `structuring` | Synthesizing results and structuring final response payload. |
| `completed` | Terminal event containing final output data. |
| `failed` | Terminal event indicating error, timeout, or failure. |
| `ping` | 15s keep-alive heartbeat (ignored by UI business logic). |

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
