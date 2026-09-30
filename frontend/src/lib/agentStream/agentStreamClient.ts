import type { AgentStreamEvent, EventType, StreamCallbacks } from "./types";

export class AgentStreamClient {
  private baseUrl: string;
  private eventSource: EventSource | null = null;
  private lastEventId: string | null = null;
  private retryCount = 0;
  private maxRetries = 5;
  private activeRunId: string | null = null;
  private isTerminated = false;

  constructor(baseUrl: string = "http://localhost:3000") {
    this.baseUrl = baseUrl;
  }

  /**
   * Triggers an agent run via POST /api/agent/run and begins SSE stream consumption.
   */
  public async startAgentRun(
    query: string,
    callbacks: StreamCallbacks = {},
    threadId?: string,
  ): Promise<string> {
    this.close();
    this.isTerminated = false;
    this.retryCount = 0;
    this.lastEventId = null;

    const response = await fetch(`${this.baseUrl}/api/agent/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, threadId }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to initiate agent run [${response.status}]: ${errText}`);
    }

    const { runId } = await response.json();
    this.activeRunId = runId;
    this.connectStream(runId, callbacks);
    return runId;
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

    this.eventSource = new EventSource(streamUrl.toString());

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

    registeredEvents.forEach((type) => {
      this.eventSource?.addEventListener(type, (event: MessageEvent) => {
        try {
          const parsed: AgentStreamEvent = JSON.parse(event.data);

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
            callbacks.onCompleted?.(parsed.payload);
            this.close();
          } else if (parsed.type === "failed") {
            this.isTerminated = true;
            callbacks.onError?.(parsed.payload);
            this.close();
          } else if (parsed.type === "waiting") {
            this.isTerminated = true;
            callbacks.onWaiting?.(parsed.payload);
            this.close();
          }
        } catch (parseErr) {
          console.error("[AgentStreamClient] Error parsing SSE event payload:", parseErr);
        }
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
        setTimeout(() => {
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
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  public getRunId(): string | null {
    return this.activeRunId;
  }
}
