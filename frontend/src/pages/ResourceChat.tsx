import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Icon } from "../components/ui/Icon";
import { ChatInput } from "../components/chat/ChatInput";
import { Mascot } from "../components/ui/Mascot";
import { apiFetch } from "../lib/api/client";
import { useAuth } from "../hooks/useAuth";
import { useAppContext } from "../context/AppContext";
import { chatSessionsApi } from "../lib/api/chatSessions";

interface ResourceSource {
  source_id: string;
  title: string;
  source_type: string;
  folder_path: string;
  url: string;
}
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: boolean;
  sources?: ResourceSource[];
}

interface ResourceSearchResponse {
  success: boolean;
  data: { answer: string; sources: ResourceSource[]; ai_credits?: number };
}

const STEPS = [
  "Scanning your sprint notes",
  "Going through saved links",
  "Reading your prep notes",
  "Putting the answer together",
];
const STEP_MS = 1000;
const CHAT_EXAMPLES = [
  { label: "Summarize my notes", icon: "journal" },
  { label: "What resources did I save?", icon: "link" },
  { label: "Get the notes summary in my current sprint", icon: "time-outline" },
  { label: "Make a quick revision checklist from my notes", icon: "checkmark" },
];

const SPRING = { type: "spring", stiffness: 260, damping: 30, mass: 0.9 } as const;

function UserAvatar() {
  return (
    <div className="w-12 h-12 rounded-full bg-chrome text-on-chrome flex items-center justify-center shrink-0 border border-chrome-border">
      <Icon name="person" className="text-xl" />
    </div>
  );
}

function AiAvatar() {
  return (
    <div className="w-16 h-16 rounded-full bg-cocoa flex items-center justify-center overflow-hidden shrink-0">
      <Mascot size="md" variant="nosy.png" />
    </div>
  );
}

function Processing() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(
      () => setStep((s) => Math.min(s + 1, STEPS.length - 1)),
      STEP_MS,
    );
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative overflow-hidden flex items-center gap-5 bg-surface border border-border rounded-3xl rounded-tl-md pl-3 pr-6 py-4 w-fit max-w-full shadow-card">
      <Mascot
        size="md"
        variant="working.gif"
        style={{ width: 110, height: 110 }}
      />
      <ul className="space-y-2">
        {STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li
              key={label}
              className={`flex items-center gap-2 text-base transition-colors duration-300 ${done
                  ? "text-rosewood"
                  : active
                    ? "text-carbon-900 font-semibold"
                    : "text-rosewood/50"
                }`}
            >
              <span className="w-4 h-4 flex items-center justify-center shrink-0">
                {done ? (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 18 }}
                    className="flex"
                  >
                    <Icon name="checkmark" className="text-sm text-chrome" />
                  </motion.span>
                ) : active ? (
                  <span className="flex gap-0.5">
                    {[0, 1, 2].map((d) => (
                      <motion.span
                        key={d}
                        className="w-1 h-1 rounded-full bg-chrome"
                        animate={{ opacity: [0.2, 1, 0.2] }}
                        transition={{
                          duration: 0.9,
                          repeat: Infinity,
                          delay: d * 0.15,
                        }}
                      />
                    ))}
                  </span>
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-border" />
                )}
              </span>
              {label}
            </li>
          );
        })}
      </ul>

      {/* Progress along the bottom edge */}
      <motion.span
        className="absolute left-0 bottom-0 h-0.5 bg-chrome"
        initial={false}
        animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

export function ResourceChat() {
  const location = useLocation();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const { chatId } = useParams<{ chatId?: string }>();
  const { user, refreshUser } = useAuth();
  const { refreshPreps } = useAppContext();

  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(chatId);
  const [creditError, setCreditError] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const consumed = useRef(false);
  const counter = useRef(0);
  const nextId = () => `m-${++counter.current}`;

  const currentCredits = user?.ai_credits ?? 30;
  const hasSufficientCredits = currentCredits >= 2;
  const hasMessages = messages.length > 0;

  // Load existing session if chatId is in URL
  useEffect(() => {
    if (chatId) {
      chatSessionsApi
        .get(chatId)
        .then((res) => {
          if (res.data?.messages) {
            setMessages(
              res.data.messages.map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                sources: m.sources,
              })),
            );
            setSessionId(chatId);
          }
        })
        .catch((err) =>
          console.warn("[ResourceChat] Could not load chat session:", err),
        );
    }
  }, [chatId]);

  const handleSend = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;

    if (currentCredits < 2) {
      setCreditError(
        "You need at least 2 AI credits to use this feature. Complete levels or quizzes to earn more credits!",
      );
      return;
    }
    setCreditError(null);

    const uId = nextId();
    const aId = nextId();
    const userMsg: Message = { id: uId, role: "user", content: question };
    const thinkingMsg: Message = {
      id: aId,
      role: "assistant",
      content: "",
      thinking: true,
    };

    const newMessagesList = [...messages, userMsg];
    const conversationHistory = messages
      .filter((message) => !message.thinking)
      .slice(-10)
      .map(({ role, content }) => ({ role, content }));
    setMessages((p) => [...p, userMsg, thinkingMsg]);
    setBusy(true);

    const finishWith = async (
      content: string,
      sources: ResourceSource[] = [],
    ) => {
      const assistantMsg: Message = {
        id: aId,
        role: "assistant",
        content,
        sources,
      };
      setMessages((p) =>
        p.map((m) =>
          m.id === aId ? { ...m, thinking: false, content, sources } : m,
        ),
      );
      setBusy(false);

      // Save to chat session in backend
      const fullSessionMessages = [...newMessagesList, assistantMsg];
      try {
        const sessionRes = await chatSessionsApi.save({
          sessionId,
          messages: fullSessionMessages,
        });
        if (sessionRes.data?.id && !sessionId) {
          setSessionId(sessionRes.data.id);
        }
      } catch (err) {
        console.warn("[ResourceChat] Could not persist chat session:", err);
      }

      // Refresh credits in both auth context and app context
      void refreshUser();
      void refreshPreps();
    };

    try {
      const response = await apiFetch<ResourceSearchResponse>(
        "/api/resources/search",
        {
          method: "POST",
          body: JSON.stringify({
            query: question,
            history: conversationHistory,
          }),
        },
      );
      await finishWith(response.data.answer, response.data.sources);
    } catch (error: any) {
      const msg =
        error instanceof Error
          ? error.message
          : "The resource assistant could not answer. Please try again.";
      if (msg.toLowerCase().includes("credit")) {
        setCreditError(msg);
      }
      await finishWith(msg);
    }
  };

  // Send the message passed from the home page exactly once.
  useEffect(() => {
    const msg = location.state?.initialMessage;
    if (msg && !consumed.current) {
      consumed.current = true;
      navigate(location.pathname, { replace: true, state: null });
      handleSend(msg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const showBanner = !hasSufficientCredits || !!creditError;

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <header className="bg-surface border-b border-border px-4 py-3 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/resource-pack"
            aria-label="Back to Resource Pack"
            className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-chrome hover:bg-lavender-100 transition-colors"
          >
            <motion.span
              whileHover={reduce ? undefined : { x: -2 }}
              className="flex"
            >
              <Icon name="arrow-back" />
            </motion.span>
          </Link>
          <div>
            <h1 className="font-extrabold text-carbon-900 leading-tight">
              Resource Assistant
            </h1>
            <p className="text-[11px] font-semibold text-carbon-500">
              RAG-powered workspace search
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* AI Credits Badge */}
          <div className="flex items-center gap-1.5 bg-beige-100 border border-border px-3 py-1 rounded-full text-xs font-bold text-carbon-800">
            <img
              src="/assets/icons/creds.png"
              alt=""
              className="w-4 h-4 object-contain"
            />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={currentCredits}
                initial={{ y: reduce ? 0 : -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: reduce ? 0 : 8, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {currentCredits} Credits
              </motion.span>
            </AnimatePresence>
            <span className="text-[10px] text-carbon-500 font-normal">
              (2/msg)
            </span>
          </div>

          <Link
            to="/resource-pack/chat/history"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-border text-chrome rounded-full hover:bg-lavender-100 transition-colors"
          >
            <Icon name="time-outline" className="text-sm" />
            History
          </Link>
        </div>
      </header>

      {/* Credit Warning Banner if 0 or < 2 credits */}
      <AnimatePresence initial={false}>
        {showBanner && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden shrink-0"
          >
            <div className="bg-coral-100 border-b border-coral-500/30 px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-danger-600">
              <div className="flex items-center gap-2">
                <Icon
                  name="warning-outline"
                  className="text-base text-coral-500"
                />
                <span>
                  {creditError ||
                    `You need at least 2 AI credits to use this feature (Current: ${currentCredits}). Complete roadmap levels and quizzes to earn more credits!`}
                </span>
              </div>
              <Link
                to="/roadmap"
                className="underline font-bold text-expresso ml-2 shrink-0"
              >
                Earn Credits
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-h-0">
        {/* Messages: only present once the conversation starts */}
        {hasMessages && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="flex-1 min-h-0 overflow-y-auto"
          >
            <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 space-y-6">
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{
                    opacity: 0,
                    y: reduce ? 0 : 12,
                    scale: reduce ? 1 : 0.98,
                  }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  {m.role === "user" ? <UserAvatar /> : <AiAvatar />}

                  <div
                    className={
                      m.role === "user" ? "max-w-[80%]" : "flex-1 min-w-0"
                    }
                  >
                    {m.role === "user" ? (
                      <div className="rounded-3xl rounded-tr-md px-5 py-3 bg-chrome text-on-chrome leading-relaxed whitespace-pre-wrap shadow-card">
                        {m.content}
                      </div>
                    ) : m.thinking ? (
                      <Processing />
                    ) : (
                      <div className="rounded-3xl rounded-tl-md px-5 py-4 bg-surface border border-border shadow-card w-fit max-w-full">
                        <p className="leading-relaxed text-carbon-900 whitespace-pre-wrap">
                          {m.content}
                        </p>
                        {!!m.sources?.length && (
                          <details className="mt-4 border-t border-border pt-3 group">
                            <summary className="text-xs font-bold text-carbon-500 cursor-pointer list-none flex items-center gap-2 select-none hover:text-chrome transition-colors">
                              <Icon
                                name="chevron-forward"
                                className="text-base transition-transform group-open:rotate-90"
                              />
                              Sources ({m.sources.length})
                            </summary>
                            <ul className="flex flex-col gap-2 mt-3">
                              {m.sources.map((source, i) => (
                                <motion.li
                                  key={source.source_id}
                                  initial={{ opacity: 0, x: reduce ? 0 : -6 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: i * 0.04 }}
                                  className="flex items-center gap-2.5 rounded-xl bg-lavender-50 border border-border px-3 py-2 text-xs min-w-0"
                                >
                                  <Icon
                                    name={source.url ? "link" : "journal"}
                                    className="text-base text-cocoa shrink-0"
                                  />
                                  <div className="min-w-0 flex-1">
                                    {source.url ? (
                                      <a
                                        href={source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block truncate font-semibold text-chrome hover:underline"
                                      >
                                        {source.title}
                                      </a>
                                    ) : (
                                      <span className="block truncate font-semibold text-carbon-900">
                                        {source.title}
                                      </span>
                                    )}
                                    <span className="block truncate text-carbon-500">
                                      {source.folder_path || source.source_type}
                                    </span>
                                  </div>
                                </motion.li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              <div ref={endRef} />
            </div>
          </motion.div>
        )}

        {/*
          Composer block. The same ChatInput element lives here in both modes
          (never remounted): centered with the hero + suggestions when the chat
          is empty, docked to the bottom once messages exist. `layout="position"`
          makes it glide between the two spots.
        */}
        <div
          className={
            hasMessages
              ? "shrink-0 px-4 pb-5 pt-3 bg-gradient-to-t from-bg via-bg/95 to-transparent"
              : "flex-1 min-h-0 overflow-y-auto px-4 flex flex-col justify-center pb-10"
          }
        >
          <div
            className={`relative w-full mx-auto flex flex-col items-center ${hasMessages ? "max-w-4xl" : "max-w-3xl"
              }`}
          >
            {/* Hero (mascot + heading) */}
            <AnimatePresence mode="popLayout">
              {!hasMessages && (
                <motion.div
                  key="hero"
                  initial={{ opacity: 0, y: reduce ? 0 : 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{
                    opacity: 0,
                    y: reduce ? 0 : -16,
                    scale: reduce ? 1 : 0.96,
                    transition: { duration: 0.18 },
                  }}
                  transition={SPRING}
                  className="flex flex-col items-center text-center gap-4 mb-7 w-full"
                >
                  <motion.div
                    animate={reduce ? undefined : { y: [0, -6, 0] }}
                    transition={{
                      duration: 3.2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="rounded-full bg-cocoa border border-border overflow-hidden"
                  >
                    <Mascot variant="nosy.png" size="xl" />
                  </motion.div>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-extrabold text-carbon-900">
                      What do you want to know?
                    </h2>
                    <p className="text-sm text-carbon-500 mt-1">
                      Ask about your sprints, notes, and references.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* The composer: glides from center to bottom */}
            <motion.div
              layout={reduce ? false : "position"}
              transition={SPRING}
              className="w-full rounded-3xl shadow-pop transition-shadow focus-within:ring-2 focus-within:ring-chrome-border"
            >
              <ChatInput
                onSend={handleSend}
                disabled={busy || !hasSufficientCredits}
                placeholder={
                  hasSufficientCredits
                    ? "Ask about your resources... (2 AI credits)"
                    : "You need AI credits to send a message"
                }
                hideTemplates={true}
              />
            </motion.div>

            {/* Suggestions right below the input */}
            <AnimatePresence>
              {!hasMessages && (
                <motion.div
                  key="suggestions"
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  variants={{
                    hidden: {},
                    show: {
                      transition: {
                        staggerChildren: 0.07,
                        delayChildren: 0.15,
                      },
                    },
                    exit: { transition: { staggerChildren: 0.03 } },
                  }}
                  className="mt-5 flex flex-wrap justify-center gap-2.5 w-full"
                >
                  {CHAT_EXAMPLES.map((example) => (
                    <motion.button
                      key={example.label}
                      type="button"
                      variants={{
                        hidden: { opacity: 0, y: reduce ? 0 : 14, scale: 0.95 },
                        show: {
                          opacity: 1,
                          y: 0,
                          scale: 1,
                          transition: SPRING,
                        },
                        exit: {
                          opacity: 0,
                          y: reduce ? 0 : 8,
                          transition: { duration: 0.14 },
                        },
                      }}
                      whileHover={
                        reduce || busy || !hasSufficientCredits
                          ? undefined
                          : { y: -2, transition: { duration: 0.15 } }
                      }
                      whileTap={reduce ? undefined : { scale: 0.97 }}
                      onClick={() => void handleSend(example.label)}
                      disabled={busy || !hasSufficientCredits}
                      className="group flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-carbon-800 shadow-xs transition-colors hover:border-chrome-accent hover:bg-lavender-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Icon
                        name={example.icon}
                        className="text-base text-chrome transition-transform group-hover:scale-110"
                      />
                      {example.label}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.p
              layout={reduce ? false : "position"}
              transition={SPRING}
              className="text-center text-xs text-carbon-500 mt-3 font-medium"
            >
              This assistant is specifically for querying and summarizing your
              saved notes, not for general AI conversations.
            </motion.p>
          </div>
        </div>
      </div>
    </div>
  );
}