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
type WorkflowField = {
  name: string;
  label: string;
  description: string;
  required: boolean;
  recipients: string[];
  maxLength: number;
};
type ChatTurn = { speaker: "user" | "assistant"; text: string };

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:3000"
).replace(/\/$/, "");

export function InterviewPrep() {
  const [inputMode, setInputMode] = useState<"chat" | "fields">("chat");
  const [fields, setFields] = useState<WorkflowField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [answer, setAnswer] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [status, setStatus] = useState<WorkflowStatus>("idle");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [error, setError] = useState("");
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/agent/interview-prep/fields`, {
      credentials: "include",
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok)
          throw new Error(payload.error || "Could not load workflow fields.");
        const loadedFields = payload.fields as WorkflowField[];
        setFields(loadedFields);
        setValues((current) =>
          Object.fromEntries(
            loadedFields.map((field) => [
              field.name,
              current[field.name] || "",
            ]),
          ),
        );
      })
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load workflow fields.",
        ),
      );
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
      setQuestion(clarification);
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
      setQuestion("");
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
      setQuestion("");
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
          fields: values,
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
    setChatTurns((previous) => [...previous, { speaker: "user", text: message }]);
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
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-forest-700">
              Research workspace
            </p>
            <h1 className="text-3xl font-extrabold text-carbon-900">
              Interview intelligence
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-carbon-500">
              Company context and live role-market signals, gathered at the same
              time.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-control border border-border bg-white px-3 py-2 text-sm font-semibold">
            <span
              className={`h-2 w-2 rounded-full ${status === "failed" ? "bg-danger-600" : status === "complete" ? "bg-forest-700" : busy ? "bg-sunny-500 animate-pulse" : status === "awaiting_input" ? "bg-coral-500" : "bg-carbon-500/40"}`}
            />
            {statusLabel}
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
          <section
            className="rounded-card border border-border bg-white p-5 shadow-card md:p-6"
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-control bg-forest-100 text-forest-800">
                <Icon name="briefcase-outline" className="text-xl" />
              </div>
              <div>
                <h2 className="font-bold text-carbon-900">Interview details</h2>
                <p className="text-xs text-carbon-500">
                  Required details are collected before the agents start.
                </p>
              </div>
            </div>

            <div className="mb-5 inline-flex rounded-control border border-border bg-bg p-1" role="group" aria-label="Input mode">
              <button
                type="button"
                aria-pressed={inputMode === "chat"}
                onClick={() => setInputMode("chat")}
                className={`rounded-control px-3 py-2 text-sm font-semibold ${inputMode === "chat" ? "bg-white text-carbon-900 shadow-card" : "text-carbon-500"}`}
              >
                <Icon name="chatbubble-ellipses-outline" className="mr-1" /> Chat
              </button>
              <button
                type="button"
                aria-pressed={inputMode === "fields"}
                onClick={() => setInputMode("fields")}
                className={`rounded-control px-3 py-2 text-sm font-semibold ${inputMode === "fields" ? "bg-white text-carbon-900 shadow-card" : "text-carbon-500"}`}
              >
                <Icon name="list-outline" className="mr-1" /> Defined inputs
              </button>
            </div>

            {inputMode === "fields" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((field) => (
                <label key={field.name} className="space-y-1.5">
                  <span className="flex items-center gap-1 text-xs font-bold uppercase text-carbon-500">
                    {field.label}
                    {field.required && <span aria-label="required">*</span>}
                  </span>
                  <input
                    value={values[field.name] || ""}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field.name]: event.target.value,
                      }))
                    }
                    maxLength={field.maxLength}
                    placeholder={field.description}
                    aria-required={field.required}
                    className="w-full rounded-control border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-forest-700"
                  />
                  <span className="block text-[11px] text-carbon-500">
                    Used by{" "}
                    {field.recipients
                      .map((recipient) => recipient.replaceAll("_", " "))
                      .join(" and ")}
                  </span>
                </label>
              ))}
            </div>
            ) : (
              <div className="space-y-4">
                <div className="max-h-72 space-y-3 overflow-y-auto rounded-control border border-border bg-bg p-3" aria-live="polite">
                  {chatTurns.length === 0 ? (
                    <p className="text-sm text-carbon-500">Tell me what you know so far. I’ll ask directly for any required details that are missing.</p>
                  ) : chatTurns.map((turn, index) => (
                    <div key={`${turn.speaker}-${index}`} className={`max-w-[90%] rounded-control px-3 py-2 text-sm ${turn.speaker === "user" ? "ml-auto bg-forest-800 text-white" : "mr-auto border border-border bg-white text-carbon-900"}`}>
                      {turn.text}
                    </div>
                  ))}
                  {busy && <p className="text-xs text-carbon-500">Reading your message…</p>}
                </div>
                <form onSubmit={(event) => { event.preventDefault(); sendChatMessage(); }} className="flex items-end gap-2">
                  <textarea
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    maxLength={4000}
                    rows={2}
                    placeholder="For example: I’m looking for an SDE role in Seattle"
                    aria-label="Tell the orchestrator about your interview"
                    className="min-w-0 flex-1 resize-y rounded-control border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-forest-700"
                  />
                  <button type="submit" disabled={busy || !chatInput.trim()} aria-label={status === "awaiting_input" ? "Answer question" : "Send message"} title={status === "awaiting_input" ? "Answer question" : "Send message"} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-forest-800 text-white disabled:opacity-50">
                    <Icon name="send-outline" />
                  </button>
                </form>
              </div>
            )}

            {inputMode === "fields" && status === "awaiting_input" && (
              <div
                className="mt-5 rounded-control border-l-4 border-coral-500 bg-coral-100 p-4"
                role="status"
              >
                <p className="text-sm font-semibold text-carbon-900">
                  {question}
                </p>
                <label className="mt-3 block space-y-1.5">
                  <span className="text-xs font-bold uppercase text-carbon-500">
                    Clarification
                  </span>
                  <textarea
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    maxLength={200}
                    rows={2}
                    placeholder="Add a short clarification if the fields above do not capture it"
                    className="w-full resize-y rounded-control border border-border bg-white px-3 py-2 text-sm text-carbon-900 outline-none focus:border-coral-500"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void submit(true)}
                  disabled={busy}
                  className="mt-3 inline-flex items-center gap-2 rounded-control bg-carbon-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Icon name="return-down-forward-outline" /> Continue with
                  these details
                </button>
              </div>
            )}

            {error && (
              <p
                className="mt-4 rounded-control bg-danger-100 px-3 py-2 text-sm text-danger-600"
                role="alert"
              >
                {error}
              </p>
            )}

            {inputMode === "fields" && <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-control bg-forest-800 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-forest-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="flash-outline" /> Run both agents
              </button>
              <span className="text-xs text-carbon-500">
                Blank fields pause the workflow for clarification.
              </span>
            </div>}
          </section>

          <section
            className="rounded-card border border-border bg-carbon-900 p-5 text-white md:p-6"
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-sunny-500">
                  Execution
                </p>
                <h2 className="mt-1 text-lg font-bold">Parallel agent run</h2>
              </div>
              <Icon
                name={busy ? "sync-outline" : "git-compare-outline"}
                className={`text-2xl text-sky-500 ${busy ? "animate-spin" : ""}`}
              />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-control border border-white/15 bg-white/5 p-3">
                <p className="text-[11px] font-bold uppercase text-sky-500">
                  Company Research
                </p>
                <p className="mt-1 text-sm">
                  {result?.company_research?.status ||
                    (busy ? "Working" : "Waiting")}
                </p>
              </div>
              <div className="rounded-control border border-white/15 bg-white/5 p-3">
                <p className="text-[11px] font-bold uppercase text-sunny-500">
                  Job Intelligence
                </p>
                <p className="mt-1 text-sm">
                  {result?.job_intelligence?.status ||
                    (busy ? "Working" : "Waiting")}
                </p>
              </div>
            </div>
            <ol
              className="mt-5 max-h-44 space-y-2 overflow-y-auto text-sm text-white/80"
              aria-label="Workflow events"
            >
              {events.length ? (
                events.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex gap-2">
                    <span className="text-sky-500">•</span>
                    <span>{item}</span>
                  </li>
                ))
              ) : (
                <li className="text-white/50">
                  Progress events will appear here.
                </li>
              )}
            </ol>
          </section>
        </section>

        {result && (
          <section className="space-y-4" aria-live="polite">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-forest-700">
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
              <article className="min-w-0 rounded-card border border-border bg-white p-5 shadow-card">
                <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                  <h3 className="font-bold text-carbon-900">Company dossier</h3>
                  <span className="text-xs font-semibold text-forest-700">
                    {result.company_research?.status || "unavailable"}
                  </span>
                </div>
                {companyProfile ? (
                  <div className="mt-4 space-y-3 text-sm">
                    <h4 className="text-lg font-bold text-carbon-900">
                      {String(
                        companyProfile.name || values.company || "Company",
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
                          className="inline-block text-forest-700 underline"
                          href={companyProfile.website}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Company website
                        </a>
                      )}
                    {result.company_research?.data?.dossier && (
                      <details className="border-t border-border pt-3">
                        <summary className="cursor-pointer font-semibold">
                          Full research synthesis
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

              <article className="min-w-0 rounded-card border border-border bg-white p-5 shadow-card">
                <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                  <h3 className="font-bold text-carbon-900">
                    Role market profile
                  </h3>
                  <span className="text-xs font-semibold text-forest-700">
                    {result.job_intelligence?.status || "unavailable"}
                  </span>
                </div>
                {jobProfile ? (
                  <div className="mt-4 space-y-4 text-sm">
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-carbon-500">
                      <span>
                        {String(jobProfile.postingsCount ?? 0)} postings
                      </span>
                      <span>
                        Coverage: {String(jobProfile.coverage || "unknown")}
                      </span>
                      {jobProfile.isFallback === true && (
                        <span className="text-amber-600">
                          Broader market search
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="mb-2 text-xs font-bold uppercase text-carbon-500">
                        Skills
                      </h4>
                      {skills.length ? (
                        <ul className="divide-y divide-border">
                          {skills.slice(0, 12).map((skill, index) => (
                            <li
                              key={`${skill.name}-${index}`}
                              className="flex items-center justify-between gap-3 py-2"
                            >
                              <span className="font-semibold text-carbon-900">
                                {skill.name || "Skill"}
                                <small className="ml-2 font-normal text-carbon-500">
                                  {skill.category}
                                </small>
                              </span>
                              <span className="shrink-0 text-xs text-carbon-500">
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
