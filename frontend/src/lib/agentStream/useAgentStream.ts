import { useState, useCallback, useRef, useEffect } from "react";
import { AgentStreamClient } from "./agentStreamClient";
import type { AgentStreamEvent, StreamState } from "./types";

export function useAgentStream(baseUrl?: string) {
  const clientRef = useRef<AgentStreamClient | null>(null);
  const [state, setState] = useState<StreamState>({
    status: "idle",
    runId: null,
    events: [],
    lastEvent: null,
    error: null,
    result: null,
  });

  if (!clientRef.current) {
    clientRef.current = new AgentStreamClient(baseUrl);
  }

  const startRun = useCallback(
    async (query: string, threadId?: string) => {
      setState({
        status: "connecting",
        runId: null,
        events: [],
        lastEvent: null,
        error: null,
        result: null,
      });

      try {
        const runId = await clientRef.current!.startAgentRun(
          query,
          {
            onEvent: (event: AgentStreamEvent) => {
              setState((prev) => ({
                ...prev,
                status: "streaming",
                events: [...prev.events, event],
                lastEvent: event,
              }));
            },
            onCompleted: (payload: Record<string, any>) => {
              setState((prev) => ({
                ...prev,
                status: "completed",
                result: payload,
              }));
            },
            onError: (err: any) => {
              setState((prev) => ({
                ...prev,
                status: "failed",
                error: err?.message || err?.error || "Stream failed",
              }));
            },
          },
          threadId,
        );

        setState((prev) => ({ ...prev, runId, status: "streaming" }));
        return runId;
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          status: "failed",
          error: err?.message || "Failed to trigger run",
        }));
        throw err;
      }
    },
    [],
  );

  const reconnect = useCallback((runId: string) => {
    setState((prev) => ({ ...prev, status: "connecting", runId }));
    clientRef.current!.connectStream(runId, {
      onEvent: (event: AgentStreamEvent) => {
        setState((prev) => ({
          ...prev,
          status: "streaming",
          events: [...prev.events, event],
          lastEvent: event,
        }));
      },
      onCompleted: (payload: Record<string, any>) => {
        setState((prev) => ({
          ...prev,
          status: "completed",
          result: payload,
        }));
      },
      onError: (err: any) => {
        setState((prev) => ({
          ...prev,
          status: "failed",
          error: err?.message || err?.error || "Stream failed",
        }));
      },
    });
  }, []);

  const stop = useCallback(() => {
    clientRef.current?.close();
    setState((prev) => ({ ...prev, status: "idle" }));
  }, []);

  useEffect(() => {
    return () => {
      clientRef.current?.close();
    };
  }, []);

  return {
    ...state,
    startRun,
    reconnect,
    stop,
    isRunning: state.status === "connecting" || state.status === "streaming",
  };
}
