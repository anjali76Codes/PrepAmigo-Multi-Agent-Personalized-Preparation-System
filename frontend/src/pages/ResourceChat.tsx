import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
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

function UserAvatar() {
  return (
    <div className="w-12 h-12 rounded-full bg-chrome text-on-chrome flex items-center justify-center shrink-0">
      <Icon name="person" className="text-xl" />
    </div>
  );
}

function AiAvatar() {
  return (
    <div className="w-16 h-16 rounded-full bg-chrome flex items-center justify-center overflow-hidden shrink-0">
      <Mascot size="md" variant="nosy.png" />
    </div>
  );
}

function Processing() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), STEP_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex items-center gap-5 bg-surface border border-border rounded-2xl pl-3 pr-6 py-4 w-fit max-w-full shadow-xs">
      <Mascot size="md" variant="working.gif" style={{ width: 110, height: 110 }} />
      <ul className="space-y-2">
        {STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li
              key={label}
              className={`flex items-center gap-2 text-base transition-colors ${done ? "text-rosewood" : active ? "text-carbon-900 font-semibold" : "text-rosewood/50"
                }`}
            >
              <span className="w-4 h-4 flex items-center justify-center shrink-0">
                {done ? (
                  <Icon name="checkmark" className="text-sm text-chrome" />
                ) : active ? (
                  <span className="flex gap-0.5">
                    {[0, 1, 2].map((d) => (
                      <motion.span
                        key={d}
                        className="w-1 h-1 rounded-full bg-chrome"
                        animate={{ opacity: [0.2, 1, 0.2] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }}
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
    </div>
  );
}

export function ResourceChat() {
  const location = useLocation();
  const navigate = useNavigate();
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

  // Load existing session if chatId is in URL
  useEffect(() => {
    if (chatId) {
      chatSessionsApi.get(chatId).then((res) => {
        if (res.data?.messages) {
          setMessages(res.data.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            sources: m.sources,
          })));
          setSessionId(chatId);
        }
      }).catch((err) => console.warn("[ResourceChat] Could not load chat session:", err));
    }
  }, [chatId]);

  const handleSend = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;

    if (currentCredits < 2) {
      setCreditError("You need at least 2 AI credits to use this feature. Complete levels or quizzes to earn more credits!");
      return;
    }
    setCreditError(null);

    const uId = nextId();
    const aId = nextId();
    const userMsg: Message = { id: uId, role: "user", content: question };
    const thinkingMsg: Message = { id: aId, role: "assistant", content: "", thinking: true };

    const newMessagesList = [...messages, userMsg];
    setMessages((p) => [...p, userMsg, thinkingMsg]);
    setBusy(true);

    const finishWith = async (content: string, sources: ResourceSource[] = []) => {
      const assistantMsg: Message = { id: aId, role: "assistant", content, sources };
      setMessages((p) => p.map((m) => (m.id === aId ? { ...m, thinking: false, content, sources } : m)));
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
      const response = await apiFetch<ResourceSearchResponse>("/api/resources/search", {
        method: "POST",
        body: JSON.stringify({ query: question }),
      });
      await finishWith(response.data.answer, response.data.sources);
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : "The resource assistant could not answer. Please try again.";
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

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <header className="bg-white border-b border-border px-4 py-3 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/resource-pack" className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-carbon-500 hover:bg-lavender-100 transition-colors">
            <Icon name="arrow-back" />
          </Link>
          <div>
            <h1 className="font-extrabold text-carbon-900 leading-tight">Resource Assistant</h1>
            <p className="text-[11px] font-semibold text-carbon-500">RAG-powered workspace search</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* AI Credits Badge */}
          <div className="flex items-center gap-1.5 bg-lavender-50 border border-chrome/20 px-3 py-1 rounded-full text-xs font-bold text-carbon-800">
            <img src="/assets/icons/creds.png" alt="" className="w-4 h-4 object-contain" />
            <span>{currentCredits} Credits</span>
            <span className="text-[10px] text-carbon-500 font-normal">(2/msg)</span>
          </div>

          <Link to="/resource-pack/chat/history" className="px-3 py-1.5 text-xs font-bold border border-border text-chrome rounded-lg hover:bg-lavender-100 transition-colors">
            History
          </Link>
        </div>
      </header>

      {/* Credit Warning Banner if 0 or < 2 credits */}
      {(!hasSufficientCredits || creditError) && (
        <div className="bg-coral-50 border-b border-coral-200 px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-coral-800">
          <div className="flex items-center gap-2">
            <Icon name="warning-outline" className="text-base text-coral-600" />
            <span>
              {creditError || `You need at least 2 AI credits to use this feature (Current: ${currentCredits}). Complete roadmap levels and quizzes to earn more credits!`}
            </span>
          </div>
          <Link to="/roadmap" className="underline font-bold text-coral-900 ml-2 shrink-0">
            Earn Credits
          </Link>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center text-center pt-12 gap-5">
              <Mascot variant="nosy.png" size="xl" />
              <div>
                <h2 className="text-2xl font-extrabold text-carbon-900">What do you want to know?</h2>
                <p className="text-sm text-carbon-500 mt-1">Ask about your sprints, notes, and references.</p>
              </div>
            </div>
          )}

          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
            >
              {m.role === "user" ? <UserAvatar /> : <AiAvatar />}

              <div className={m.role === "user" ? "max-w-[80%]" : "flex-1 min-w-0"}>
                {m.role === "user" ? (
                  <div className="rounded-2xl rounded-tr-md px-4 py-2.5 bg-chrome text-on-chrome leading-relaxed whitespace-pre-wrap">
                    {m.content}
                  </div>
                ) : m.thinking ? (
                  <Processing />
                ) : (
                  <div className="rounded-2xl rounded-tl-md px-5 py-4 bg-surface border border-border shadow-xs w-fit max-w-full">
                    <p className="leading-relaxed text-carbon-900 whitespace-pre-wrap">{m.content}</p>
                    {!!m.sources?.length && (
                      <details className="mt-4 border-t border-border pt-3 group">
                        <summary className="text-[11px] font-bold uppercase tracking-wider text-carbon-500 cursor-pointer list-none flex items-center gap-2 select-none hover:text-carbon-700 transition-colors">
                          <Icon name="chevron-forward" className="text-base transition-transform group-open:rotate-90" />
                          View Sources ({m.sources.length})
                        </summary>
                        <ul className="space-y-2 mt-3 pl-6 border-l-2 border-border/50 ml-1">
                          {m.sources.map((source) => (
                            <li key={source.source_id} className="text-xs">
                              {source.url ? (
                                <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-chrome hover:underline">
                                  {source.title}
                                </a>
                              ) : (
                                <span className="font-semibold text-carbon-800">{source.title}</span>
                              )}
                              <span className="ml-2 text-carbon-500">{source.folder_path || source.source_type}</span>
                            </li>
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
      </div>

      {/* Floating Chat Input at the bottom */}
      <div className="bg-gradient-to-t from-bg via-bg/95 to-transparent px-4 pb-5 pt-3 shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="shadow-lg rounded-3xl">
            <ChatInput
              onSend={handleSend}
              disabled={busy || !hasSufficientCredits}
              placeholder={hasSufficientCredits ? "Ask about your resources... (2 AI credits)" : "You need AI credits to send a message"}
              hideTemplates={true}
            />
          </div>
          <p className="text-center text-xs text-carbon-500 mt-3 font-medium">
            This assistant is specifically for querying and summarizing your saved notes, not for general AI conversations.
          </p>
        </div>
      </div>
    </div>
  );
}