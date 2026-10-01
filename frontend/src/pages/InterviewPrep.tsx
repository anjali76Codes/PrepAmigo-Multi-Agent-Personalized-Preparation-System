import { useEffect, useRef, useState } from "react";
import { Icon } from "../components/ui/Icon";

type WorkflowStatus =
  | "idle"
  | "starting"
  | "running"
  | "awaiting_input"
  | "complete"
  | "partial"
  | "failed";
type JobSkill = {
  name?: string;
  category?: string;
  priority?: string;
  percentage?: number;
};
type WorkflowResult = {
  status?: string;
  summary?: string;
  company_research?: {
    status?: string;
    data?: { profile?: Record<string, unknown>; dossier?: string };
    error?: string;
  };
  job_intelligence?: {
    status?: string;
    data?: Record<string, unknown>;
    error?: string;
  };
};
type ChatTurn = { speaker: "user" | "assistant"; text: string };

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:3000"
).replace(/\/$/, "");

export function InterviewPrep() {
  const [answer, setAnswer] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [status, setStatus] = useState<WorkflowStatus>("idle");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [error, setError] = useState("");
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => sourceRef.current?.close();
  }, []);

  const listenToRun = (runId: string) => {
    sourceRef.current?.close();
    const source = new EventSource(`${API_URL}/api/agent/stream/${runId}`, {
      withCredentials: true,
    });
    sourceRef.current = source;

    for (const eventType of [
      "thinking",
      "researching",
      "calling_agent",
      "processing",
      "structuring",
    ]) {
      source.addEventListener(eventType, (event) => {
        const parsed = JSON.parse((event as MessageEvent).data);
        const message =
          parsed.payload?.message ||
          parsed.payload?.step ||
          eventType.replaceAll("_", " ");
        setEvents((previous) => [...previous.slice(-7), message]);
        setStatus("running");
      });
    }

    source.addEventListener("waiting", (event) => {
      const parsed = JSON.parse((event as MessageEvent).data);
      const questionPayload = parsed.payload?.question;
      const clarification =
        (typeof questionPayload === "string"
          ? questionPayload
          : questionPayload?.question) ||
        parsed.payload?.message ||
        "I still need a required detail before I can start the agents.";
      setChatTurns((previous) => [
        ...previous,
        { speaker: "assistant", text: clarification },
      ]);
      setAnswer("");
      setStatus("awaiting_input");
      source.close();
    });

    source.addEventListener("completed", (event) => {
      const parsed = JSON.parse((event as MessageEvent).data);
      const payload = parsed.payload || {};
      setResult(payload.result || null);
      setStatus(payload.status === "partial" ? "partial" : "complete");
      setAnswer("");
      if (payload.message) {
        setChatTurns((previous) => [
          ...previous,
          { speaker: "assistant", text: payload.message },
        ]);
      }
      source.close();
    });

    source.addEventListener("failed", (event) => {
      const parsed = JSON.parse((event as MessageEvent).data);
      setResult(parsed.payload?.result || null);
      setError(
        parsed.payload?.detail ||
          parsed.payload?.error ||
          "The workflow could not be completed.",
      );
      setChatTurns((previous) => [
        ...previous,
        {
          speaker: "assistant",
          text:
            parsed.payload?.detail ||
            parsed.payload?.error ||
            "The workflow could not be completed.",
        },
      ]);
      setStatus("failed");
      source.close();
    });

    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) return;
      setError(
        "The live connection was interrupted. Retry the request or check the service status.",
      );
      setStatus("failed");
      source.close();
    };
  };

  const submit = async (resume = false, userMessage?: string) => {
    setError("");
    setEvents([]);
    if (!resume) {
      setResult(null);
      setThreadId(null);
      setAnswer("");
    }
    setStatus("starting");
    try {
      const endpoint = resume
        ? "/api/agent/interview-prep/resume"
        : "/api/agent/interview-prep";
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {},
          ...(resume ? { threadId } : {}),
          ...(resume && (userMessage || answer.trim())
            ? { answer: userMessage || answer.trim() }
            : {}),
          ...(!resume && userMessage ? { message: userMessage } : {}),
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          payload.error || "Could not start interview preparation.",
        );
      if (payload.threadId) setThreadId(payload.threadId);
      if (resume) setAnswer("");
      listenToRun(payload.runId);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not reach the interview-preparation service.",
      );
      setStatus("failed");
    }
  };

  const sendChatMessage = () => {
    const message = chatInput.trim();
    if (!message || busy) return;
    setChatInput("");
    setChatTurns((previous) => [
      ...previous,
      { speaker: "user", text: message },
    ]);
    void submit(status === "awaiting_input", message);
  };

  const companyProfile = result?.company_research?.data?.profile;
  const jobProfile = result?.job_intelligence?.data;
  const skills = Array.isArray(jobProfile?.skills)
    ? (jobProfile.skills as JobSkill[])
    : [];
  const statusLabel = {
    idle: "Ready",
    starting: "Starting",
    running: "Research in progress",
    awaiting_input: "Needs your input",
    complete: "Complete",
    partial: "Partial result",
    failed: "Unable to complete",
  }[status];
  const busy = status === "starting" || status === "running";

  return (
    <div className="h-full overflow-y-auto bg-bg px-4 py-6 text-carbon-700 md:px-8 md:py-9">
      <div className="mx-auto max-w-6xl space-y-6 pb-24">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-navy-700">
              Your Personal Researcher
            </p>
            <h1 className="text-3xl font-extrabold text-carbon-900">
              Get ready for your interview
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-carbon-500">
              Let's gather some deep context about the company and market signals so you feel completely prepared.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-control border border-border bg-white px-3 py-2 text-sm font-semibold">
            <span
              className={`h-2 w-2 rounded-full ${status === "failed" ? "bg-danger-600" : status === "complete" ? "bg-navy-700" : busy ? "bg-beige-500 animate-pulse" : status === "awaiting_input" ? "bg-coral-500" : "bg-carbon-500/40"}`}
            />
            {statusLabel}
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
          <section className="rounded-card border border-border bg-white p-5 shadow-card md:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lavender-100 text-navy-800">
                <Icon name="chatbubbles-outline" className="text-xl" />
              </div>
              <div>
                <h2 className="font-bold text-carbon-900">Let's chat about the role</h2>
                <p className="text-xs text-carbon-500">
                  Just tell me what you're applying for, and I'll ask for anything else I need.
                </p>
              </div>
            </div>

            <div className="space-y-4">
                <div
                  className="max-h-72 space-y-3 overflow-y-auto rounded-control border border-border bg-bg p-3"
                  aria-live="polite"
                >
                  {chatTurns.length === 0 ? (
                    <p className="text-sm text-carbon-500">
                      Tell me what you know so far. I’ll ask directly for any
                      required details that are missing.
                    </p>
                  ) : (
                    chatTurns.map((turn, index) => (
                      <div
                        key={`${turn.speaker}-${index}`}
                        className={`max-w-[90%] rounded-control px-3 py-2 text-sm ${turn.speaker === "user" ? "ml-auto bg-navy-800 text-white" : "mr-auto border border-border bg-white text-carbon-900"}`}
                      >
                        {turn.text}
                      </div>
                    ))
                  )}
                  {busy && (
                    <p className="text-xs text-carbon-500">
                      Reading your message…
                    </p>
                  )}
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    sendChatMessage();
                  }}
                  className="flex items-end gap-2"
                >
                  <textarea
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    maxLength={4000}
                    rows={2}
                    placeholder="For example: I’m looking for an SDE role in Seattle"
                    aria-label="Tell the orchestrator about your interview"
                    className="min-w-0 flex-1 resize-y rounded-control border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-navy-700"
                  />
                  <button
                    type="submit"
                    disabled={busy || !chatInput.trim()}
                    aria-label={
                      status === "awaiting_input"
                        ? "Answer question"
                        : "Send message"
                    }
                    title={
                      status === "awaiting_input"
                        ? "Answer question"
                        : "Send message"
                    }
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-navy-800 text-white disabled:opacity-50"
                  >
                    <Icon name="send-outline" />
                  </button>
                </form>
                {error && (
                  <p
                    className="mt-4 rounded-control bg-danger-100 px-3 py-2 text-sm text-danger-600"
                    role="alert"
                  >
                    {error}
                  </p>
                )}
              </div>
          </section>

          <section
            className="rounded-card border border-border bg-white p-5 text-carbon-900 md:p-6 shadow-sm"
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-navy-500">
                  Behind the scenes
                </p>
                <h2 className="mt-1 text-lg font-bold">Research Progress</h2>
              </div>
              <Icon
                name={busy ? "sync-outline" : "git-compare-outline"}
                className={`text-2xl text-navy-500 ${busy ? "animate-spin" : ""}`}
              />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-control border border-border bg-lavender-100 p-3">
                <p className="text-[11px] font-bold uppercase text-navy-700">
                  Company Research
                </p>
                <p className="mt-1 text-sm font-medium">
                  {result?.company_research?.status ||
                    (busy ? "Working..." : "Waiting")}
                </p>
              </div>
              <div className="rounded-control border border-border bg-chrome-accent p-3">
                <p className="text-[11px] font-bold uppercase text-navy-900">
                  Job Intelligence
                </p>
                <p className="mt-1 text-sm font-medium">
                  {result?.job_intelligence?.status ||
                    (busy ? "Working..." : "Waiting")}
                </p>
              </div>
            </div>
            <ol
              className="mt-5 max-h-44 space-y-2 overflow-y-auto text-sm text-carbon-600 font-medium"
              aria-label="Workflow events"
            >
              {events.length ? (
                events.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex gap-2">
                    <span className="text-navy-500">•</span>
                    <span>{item}</span>
                  </li>
                ))
              ) : (
                <li className="text-carbon-400">
                  Progress updates will appear here once we start.
                </li>
              )}
            </ol>
          </section>
        </section>

        {result && (
          <section className="space-y-4" aria-live="polite">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-navy-700">
                  Combined result · {result.status || status}
                </p>
                <h2 className="mt-1 text-xl font-bold text-carbon-900">
                  {result.summary || "Interview preparation research"}
                </h2>
              </div>
              {threadId && (
                <span className="text-xs text-carbon-500">
                  Thread {threadId.slice(-8)}
                </span>
              )}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <article className="min-w-0 rounded-card border-none bg-lavender-100 text-navy-900 p-5 shadow-pop">
                <div className="flex items-center justify-between gap-2 border-b border-navy-900/10 pb-3">
                  <h3 className="font-bold">What to know about them</h3>
                  <span className="text-xs font-semibold text-navy-700">
                    {result.company_research?.status || "unavailable"}
                  </span>
                </div>
                {companyProfile ? (
                  <div className="mt-4 space-y-3 text-sm">
                    <h4 className="text-lg font-bold text-carbon-900">
                      {String(
                        companyProfile.name || "Company",
                      )}
                    </h4>
                    {typeof companyProfile.industry === "string" &&
                      companyProfile.industry && (
                        <p>
                          <span className="font-semibold">Industry:</span>{" "}
                          {companyProfile.industry}
                        </p>
                      )}
                    {typeof companyProfile.description === "string" &&
                      companyProfile.description && (
                        <p className="leading-relaxed text-carbon-700">
                          {companyProfile.description}
                        </p>
                      )}
                    {typeof companyProfile.website === "string" &&
                      companyProfile.website && (
                        <a
                          className="inline-block text-navy-900 font-bold underline"
                          href={companyProfile.website}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Check out their website
                        </a>
                      )}
                    {result.company_research?.data?.dossier && (
                      <details className="border-t border-navy-900/10 pt-3">
                        <summary className="cursor-pointer font-semibold text-navy-900">
                          Dive into the full research
                        </summary>
                        <p className="mt-3 whitespace-pre-wrap leading-relaxed text-carbon-700">
                          {result.company_research.data.dossier}
                        </p>
                      </details>
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-carbon-500">
                    {result.company_research?.error ||
                      "No structured company profile was returned."}
                  </p>
                )}
              </article>

              <article className="min-w-0 rounded-card border-none bg-chrome-accent text-navy-900 p-5 shadow-pop">
                <div className="flex items-center justify-between gap-2 border-b border-navy-900/10 pb-3">
                  <h3 className="font-bold">
                    What they're looking for
                  </h3>
                  <span className="text-xs font-semibold text-navy-700">
                    {result.job_intelligence?.status || "unavailable"}
                  </span>
                </div>
                {jobProfile ? (
                  <div className="mt-4 space-y-4 text-sm">
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-navy-800/70 font-medium">
                      <span>
                        {String(jobProfile.postingsCount ?? 0)} postings
                      </span>
                      <span>
                        Coverage: {String(jobProfile.coverage || "unknown")}
                      </span>
                      {jobProfile.isFallback === true && (
                        <span className="text-beige-600">
                          Broader market search
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="mb-2 text-xs font-bold uppercase text-navy-900/60">
                        Top Skills
                      </h4>
                      {skills.length ? (
                        <ul className="divide-y divide-navy-900/10">
                          {skills.slice(0, 12).map((skill, index) => (
                            <li
                              key={`${skill.name}-${index}`}
                              className="flex items-center justify-between gap-3 py-2"
                            >
                              <span className="font-semibold text-navy-900">
                                {skill.name || "Skill"}
                                <small className="ml-2 font-normal text-navy-900/60">
                                  {skill.category}
                                </small>
                              </span>
                              <span className="shrink-0 text-xs font-bold text-navy-900/60">
                                {skill.priority || ""}
                                {typeof skill.percentage === "number"
                                  ? ` · ${skill.percentage}%`
                                  : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-carbon-500">
                          No skill signals were found.
                        </p>
                      )}
                    </div>
                    {Array.isArray(jobProfile.commonResponsibilities) &&
                      jobProfile.commonResponsibilities.length > 0 && (
                        <div>
                          <h4 className="mb-2 text-xs font-bold uppercase text-carbon-500">
                            Responsibilities
                          </h4>
                          <ul className="list-disc space-y-1 pl-5">
                            {(jobProfile.commonResponsibilities as string[])
                              .slice(0, 5)
                              .map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                          </ul>
                        </div>
                      )}
                    {Array.isArray(jobProfile.commonQualifications) &&
                      jobProfile.commonQualifications.length > 0 && (
                        <div>
                          <h4 className="mb-2 text-xs font-bold uppercase text-carbon-500">
                            Qualifications
                          </h4>
                          <ul className="list-disc space-y-1 pl-5">
                            {(jobProfile.commonQualifications as string[])
                              .slice(0, 5)
                              .map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                          </ul>
                        </div>
                      )}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-carbon-500">
                    {result.job_intelligence?.error ||
                      "No job-market profile was returned."}
                  </p>
                )}
              </article>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
