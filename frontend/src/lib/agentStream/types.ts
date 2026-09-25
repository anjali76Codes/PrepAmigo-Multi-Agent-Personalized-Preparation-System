export type EventType =
  | "thinking"
  | "researching"
  | "calling_agent"
  | "waiting"
  | "processing"
  | "structuring"
  | "completed"
  | "failed"
  | "ping";

export interface AgentStreamEvent {
  id: string;
  runId: string;
  type: EventType;
  payload: Record<string, any>;
  timestamp: number;
}

export interface StreamCallbacks {
  onEvent?: (event: AgentStreamEvent) => void;
  onCompleted?: (payload: Record<string, any>) => void;
  onError?: (error: any) => void;
  onStateChange?: (state: StreamState) => void;
}

export type StreamStatus = "idle" | "connecting" | "streaming" | "completed" | "failed";

export interface StreamState {
  status: StreamStatus;
  runId: string | null;
  events: AgentStreamEvent[];
  lastEvent: AgentStreamEvent | null;
  error: string | null;
  result: any | null;
}
