import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Icon } from "../components/ui/Icon";
import { ChatInput } from "../components/chat/ChatInput";
import { Mascot } from "../components/ui/Mascot";
import { SUGGESTED_QUESTIONS } from "../data/mockNotes";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: boolean;
}

const MOCK_ANSWER =
  "Based on your resources, you have notes on Java exception handling and AWS deployment. " +
  "Want me to go deeper on either topic?";

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
    <div className="w-16 h-16 rounded-full bg-lavender-100 border border-border flex items-center justify-center shrink-0 overflow-hidden">
      <Mascot size="md" variant="Chilling.png" style={{ width: 56, height: 56 }} />
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
              className={`flex items-center gap-2 text-base transition-colors ${done ? "text-navy-300" : active ? "text-carbon-900 font-semibold" : "text-navy-300/50"
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const consumed = useRef(false);
  const counter = useRef(0);
  const timers = useRef<number[]>([]);
  const nextId = () => `m-${++counter.current}`;

  const handleSend = (text: string) => {
    const aId = nextId();
    setMessages((p) => [
      ...p,
      { id: nextId(), role: "user", content: text },
      { id: aId, role: "assistant", content: "", thinking: true },
    ]);
    setBusy(true);
    timers.current.push(
      window.setTimeout(() => {
        setMessages((p) => p.map((m) => (m.id === aId ? { ...m, thinking: false, content: MOCK_ANSWER } : m)));
        setBusy(false);
      }, STEPS.length * STEP_MS + 400)
    );
  };

  // Send the message passed from the home page exactly once.
  // No cleanup here: StrictMode's fake unmount would kill the pending answer timer.
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
          <h1 className="font-extrabold text-carbon-900">Resource Assistant</h1>
        </div>
        <Link to="/resource-pack/chat/history" className="px-3 py-1.5 text-xs font-bold border border-border text-chrome rounded-lg hover:bg-lavender-100 transition-colors">
          History
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center text-center pt-12 gap-5">
              <Mascot variant="Thinking.png" size="xl" />
              <div>
                <h2 className="text-2xl font-extrabold text-carbon-900">What do you want to know?</h2>
                <p className="text-sm text-carbon-500 mt-1">Ask about your sprints, notes, and references.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-xl">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button key={q} onClick={() => handleSend(q)}
                    className="px-4 py-2 bg-white border border-border rounded-full text-xs font-bold text-chrome hover:bg-lavender-100 transition-colors">
                    {q}
                  </button>
                ))}
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
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      <div className="bg-bg px-4 pb-4 pt-2 shrink-0">
        <div className="max-w-4xl mx-auto">
          <ChatInput onSend={handleSend} disabled={busy} placeholder="Ask about your resources..." />
        </div>
      </div>
    </div>
  );
}