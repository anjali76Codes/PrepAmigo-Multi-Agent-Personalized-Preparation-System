import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Icon } from "../components/ui/Icon";
import { ChatInput } from "../components/chat/ChatInput";
import { Mascot } from "../components/ui/Mascot";


interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps?: { label: string; status: "pending" | "active" | "done" }[];
}

export function ResourceChat() {
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If entered from ResourcePack with an initial message, send it
    if (location.state?.initialMessage && messages.length === 0) {
      handleSend(location.state.initialMessage);
      // clear the state so it doesn't double send on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state, messages.length]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  const handleSend = (text: string) => {
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsGenerating(true);

    const assistantMsgId = (Date.now() + 1).toString();
    const steps = [
      { label: "Thinking", status: "active" as const },
      { label: "Searching", status: "pending" as const },
      { label: "Structuring", status: "pending" as const },
      { label: "Response", status: "pending" as const }
    ];

    setMessages(prev => [...prev, { id: assistantMsgId, role: "assistant", content: "", steps }]);

    // Simulate RAG steps
    let currentStepIndex = 0;
    const interval = setInterval(() => {
      setMessages(prev => prev.map(m => {
        if (m.id === assistantMsgId && m.steps) {
          const newSteps = [...m.steps];
          if (currentStepIndex < newSteps.length) {
            if (currentStepIndex > 0) newSteps[currentStepIndex - 1].status = "done";
            newSteps[currentStepIndex].status = "active";
          } else {
            newSteps[newSteps.length - 1].status = "done";
          }
          return { ...m, steps: newSteps };
        }
        return m;
      }));

      currentStepIndex++;
      
      if (currentStepIndex > steps.length) {
        clearInterval(interval);
        setMessages(prev => prev.map(m => {
          if (m.id === assistantMsgId) {
            return { ...m, content: "This is a simulated response based on your notes. It seems you have important notes about Java Exception Handling and AWS deployment." };
          }
          return m;
        }));
        setIsGenerating(false);
      }
    }, 800);
  };

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <header className="bg-white border-b border-border px-4 py-3 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/resource-pack/notes" className="px-3 py-1.5 text-xs font-bold bg-surface-muted text-carbon-700 rounded-lg hover:bg-border transition-colors">
            [View Notes]
          </Link>
          <h1 className="font-extrabold text-carbon-900">My Notes</h1>
        </div>
        <Link to="/resource-pack/chat/history" className="px-3 py-1.5 text-xs font-bold border border-border text-carbon-700 rounded-lg hover:bg-surface-muted transition-colors">
          [History]
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-4">
            <Mascot variant="Thinking.png" size="lg" />
            <p className="font-bold text-lg">Ask a question to start.</p>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 ${msg.role === 'user' ? 'bg-navy-900 text-white rounded-br-none' : 'bg-white border border-border text-carbon-900 rounded-bl-none shadow-sm'}`}>
              {msg.role === 'assistant' && msg.steps && !msg.content && (
                <div className="flex flex-col gap-2">
                  {msg.steps.map((step, idx) => (
                    <div key={idx} className={`flex items-center gap-2 text-sm font-medium ${step.status === 'pending' ? 'text-carbon-400' : step.status === 'active' ? 'text-navy-600' : 'text-forest-600'}`}>
                      {step.status === 'pending' ? <Icon name="ellipse-outline" /> : step.status === 'active' ? <Icon name="sync" className="animate-spin" /> : <Icon name="checkmark-circle" />}
                      {step.label}
                    </div>
                  ))}
                </div>
              )}
              {msg.content && <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
            </div>
          </div>
        ))}
        <div ref={endOfMessagesRef} />
      </div>

      <div className="p-4 bg-white border-t border-border shrink-0">
        <div className="max-w-4xl mx-auto">
          <ChatInput onSend={handleSend} disabled={isGenerating} showOptions={false} />
        </div>
      </div>
    </div>
  );
}
