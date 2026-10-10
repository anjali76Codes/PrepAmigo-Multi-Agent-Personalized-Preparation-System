const ACTIVE_RUN_KEY_PREFIX = "prepamigo_active_agent_run:";

export interface ActiveAgentRun {
  runId: string;
  startedAt: number;
  query?: string;
  threadId?: string;
}

function keyFor(userId?: string | null) {
  return `${ACTIVE_RUN_KEY_PREFIX}${userId || "anonymous"}`;
}

export function getActiveAgentRun(userId?: string | null): ActiveAgentRun | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveAgentRun>;
    if (typeof parsed.runId !== "string" || !parsed.runId) return null;
    return {
      runId: parsed.runId,
      startedAt: Number(parsed.startedAt) || Date.now(),
      query: typeof parsed.query === "string" ? parsed.query : undefined,
      threadId: typeof parsed.threadId === "string" ? parsed.threadId : undefined,
    };
  } catch {
    return null;
  }
}

export function rememberActiveAgentRun(
  runId: string,
  userId?: string | null,
  details?: { query?: string; threadId?: string },
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(keyFor(userId), JSON.stringify({
    runId,
    startedAt: Date.now(),
    ...details,
  }));
}

export function clearActiveAgentRun(userId?: string | null) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(keyFor(userId));
}
