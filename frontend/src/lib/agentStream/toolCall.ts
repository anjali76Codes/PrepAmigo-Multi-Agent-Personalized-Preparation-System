/** Human-readable label for a tool name like "serpapi_google_search". */
export function toolLabel(tool: unknown): string {
  const name = typeof tool === "string" && tool ? tool : "tool";
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** One line describing a `tool_call` event: running -> what it's looking up, done -> what came back. */
export function toolCallText(payload: Record<string, any> | undefined): string {
  const label = toolLabel(payload?.tool);
  const subject = payload?.query || payload?.topic || payload?.company_name;
  const status = payload?.status;
  if (status === "failed") return `${label} failed${payload?.error ? `: ${payload.error}` : ""}`;
  if (status === "completed") {
    const count = payload?.result_count;
    const ms = payload?.duration_ms;
    const took = typeof ms !== "number" ? "" : ms < 1000 ? ` in ${Math.round(ms)}ms` : ` in ${(ms / 1000).toFixed(1)}s`;
    return typeof count === "number" ? `${label} returned ${count} results${took}` : `${label} finished${took}`;
  }
  return subject ? `${label}: ${String(subject).slice(0, 120)}` : `Running ${label}…`;
}
