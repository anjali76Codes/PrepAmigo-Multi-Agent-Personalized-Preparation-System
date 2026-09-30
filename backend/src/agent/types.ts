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

export interface RunAgentRequestBody {
  query: string;
  threadId?: string;
}

export interface RunAgentResponse {
  runId: string;
}

export interface InterviewPrepRequestBody {
  company?: string;
  role?: string;
  location?: string;
  threadId?: string;
  idempotencyKey?: string;
  answer?: string;
  message?: string;
  fields?: Record<string, string>;
}

export interface InterviewPrepField {
  name: string;
  label: string;
  description: string;
  required: boolean;
  recipients: string[];
  maxLength: number;
}
