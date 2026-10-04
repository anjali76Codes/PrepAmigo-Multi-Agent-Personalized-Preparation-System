import type { AgentStreamEvent, EventType, StreamCallbacks } from "./types";

export class AgentStreamClient {
  private baseUrl: string;
  private eventSource: EventSource | null = null;
  private lastEventId: string | null = null;
  private retryCount = 0;
  private maxRetries = 5;
  private activeRunId: string | null = null;
  private isTerminated = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(baseUrl: string = import.meta.env.VITE_API_URL || "http://localhost:3000") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /**
   * Triggers an agent run via POST /api/agent/run (or /internal/agent/execute) and begins SSE stream consumption.
   */
  public async startAgentRun(
    query: string,
    callbacks: StreamCallbacks = {},
    threadId?: string,
    resumeText?: string,
  ): Promise<string> {
    this.close();
    this.isTerminated = false;
    this.retryCount = 0;
    this.lastEventId = null;

    const runId = crypto.randomUUID();
    let effectiveRunId = runId;

    const isDirectAgentService = this.baseUrl.includes(":8000");

    let response: Response;
    if (isDirectAgentService) {
      response = await fetch(`${this.baseUrl}/internal/agent/execute`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          query,
          thread_id: threadId,
          workflow_input: resumeText ? { resume_text: resumeText } : {},
        }),
      });
    } else {
      try {
        response = await fetch(`${this.baseUrl}/api/agent/run`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, threadId, resumeText }),
        });
      } catch {
        // Fallback directly to Python agents-service if Node gateway is not running
        response = await fetch(`${this.baseUrl}/internal/agent/execute`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runId,
            query,
            thread_id: threadId,
            workflow_input: resumeText ? { resume_text: resumeText } : {},
          }),
        });
      }

      if (!response.ok && response.status === 404) {
        response = await fetch(`${this.baseUrl}/internal/agent/execute`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runId,
            query,
            thread_id: threadId,
            workflow_input: resumeText ? { resume_text: resumeText } : {},
          }),
        });
      }
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to initiate agent run [${response.status}]: ${errText}`);
    }

    const data = await response.json();
    effectiveRunId = data.runId || runId;
    this.activeRunId = effectiveRunId;
    this.connectStream(effectiveRunId, callbacks);
    return effectiveRunId;
  }

  /**
   * Connects or reconnects to an existing run's SSE stream with state recovery.
   */
  public connectStream(runId: string, callbacks: StreamCallbacks = {}): void {
    if (this.isTerminated) return;

    this.activeRunId = runId;
    this.close();

    const streamUrl = new URL(`${this.baseUrl}/api/agent/stream/${runId}`);
    if (this.lastEventId) {
      streamUrl.searchParams.set("lastEventId", this.lastEventId);
    }

    this.eventSource = new EventSource(streamUrl.toString(), { withCredentials: true });

    const registeredEvents: EventType[] = [
      "thinking",
      "researching",
      "calling_agent",
      "waiting",
      "processing",
      "structuring",
      "completed",
      "failed",
      "ping",
    ];

    const handleRawMessage = (rawJson: string) => {
      try {
        const parsed: AgentStreamEvent = JSON.parse(rawJson);

        if (parsed.id) {
          this.lastEventId = parsed.id;
        }

        // Heartbeat ping — reset retry counter & ignore for domain callbacks
        if (parsed.type === "ping") {
          this.retryCount = 0;
          return;
        }

        callbacks.onEvent?.(parsed);

        if (parsed.type === "completed") {
          this.isTerminated = true;
          this.close();
          callbacks.onCompleted?.(parsed.payload);
        } else if (parsed.type === "failed") {
          this.isTerminated = true;
          this.close();
          callbacks.onError?.(parsed.payload);
        } else if (parsed.type === "waiting") {
          this.isTerminated = true;
          this.close();
          callbacks.onWaiting?.(parsed.payload);
        }
      } catch (parseErr) {
        console.error("[AgentStreamClient] Error parsing SSE event payload:", parseErr);
      }
    };

    // Listen on default message event (standard SSE data: lines)
    this.eventSource.onmessage = (event: MessageEvent) => {
      handleRawMessage(event.data);
    };

    // Also listen on named events (SSE event: <type> lines)
    registeredEvents.forEach((type) => {
      this.eventSource?.addEventListener(type, (event: MessageEvent) => {
        handleRawMessage(event.data);
      });
    });

    this.eventSource.onopen = () => {
      this.retryCount = 0;
    };

    this.eventSource.onerror = (err) => {
      if (this.isTerminated) return;

      console.warn(`[AgentStreamClient] SSE connection error for runId ${runId}:`, err);
      this.close();

      if (this.retryCount < this.maxRetries) {
        const backoffDelay = Math.min(1000 * Math.pow(2, this.retryCount), 10000);
        this.retryCount++;
        console.info(`[AgentStreamClient] Reconnecting in ${backoffDelay}ms (attempt ${this.retryCount}/${this.maxRetries})...`);
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          if (!this.isTerminated && this.activeRunId) {
            this.connectStream(this.activeRunId, callbacks);
          }
        }, backoffDelay);
      } else {
        callbacks.onError?.(new Error("Max reconnection attempts exceeded for agent stream"));
      }
    };
  }

  /**
   * Gracefully closes the SSE connection and stops reconnection attempts.
   */
  public close(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  public getRunId(): string | null {
    return this.activeRunId;
  }
}
