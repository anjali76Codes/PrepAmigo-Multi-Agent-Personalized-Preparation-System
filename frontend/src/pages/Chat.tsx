import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatInput, type AttachedFile } from '../components/chat/ChatInput';
import { Messages } from '../components/chat/Messages';
import type { Message } from '../components/chat/Messages';
import type { JourneyStep } from '../components/chat/AgentJourney';
import { useAppContext } from '../context/AppContext';
import { Icon } from '../components/ui/Icon';
import { cn } from '../utils/utils';
import { useAuth } from '../hooks/useAuth';
import { featureFlags } from '../config/featureFlags';
import { AgentStreamClient } from '../lib/agentStream/agentStreamClient';
import type { AgentStreamEvent } from '../lib/agentStream/types';
import { toolCallText } from '../lib/agentStream/toolCall';

const PIPELINE_STEPS: JourneyStep[] = [
  { agent: 'Supervisor', text: 'Analyzing your goal and routing…' },
  { agent: 'Company Research', text: 'Gathering company intelligence…' },
  { agent: 'Job Intelligence', text: 'Analyzing role expectations…' },
  { agent: 'Skill Gap Agent', text: 'Evaluating skill gaps…' },
  { agent: 'Research Agent', text: 'Curating study materials…' },
  { agent: 'Planner Agent', text: 'Structuring your personalized roadmap…' },
];

let idCounter = 0;
const uid = () => `${Date.now()}-${idCounter++}`;

export function Chat() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const initialFiredRef = useRef(false);
  const processingRef = useRef(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [threadId] = useState<string>(() => `chat-${Date.now()}`);

  const clientRef = useRef<AgentStreamClient | null>(null);

  useEffect(() => {
    clientRef.current = new AgentStreamClient();
    return () => {
      clientRef.current?.close();
    };
  }, []);

  const { refreshPreps } = useAppContext();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);

  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      setTimeout(() => {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.scenario === 'agent-journey') {
          document.getElementById(`msg-${lastMsg.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
    prevLengthRef.current = messages.length;
  }, [messages]);

  const suggestions = [
    'I have 45 days to prepare for SDE at Google in Seattle',
    'I want to prepare for Backend Engineer at Stripe',
    'Help me prepare for Frontend Engineer at Netflix',
    'Give me revision cards for system design',
  ];

  const addAgentMessage = (msg: Omit<Message, 'id' | 'sender'>) =>
    setMessages((prev) => [...prev, { id: uid(), sender: 'agent', ...msg }]);

  const mapEventToStepIndex = (ev: AgentStreamEvent): number => {
    const node = String(ev.payload?.node || ev.payload?.agent || '').toLowerCase();
    const msg = String(ev.payload?.message || ev.payload?.step || '').toLowerCase();

    if (node.includes('supervisor') || ev.type === 'calling_agent') return 0;
    if (node.includes('company') || msg.includes('company')) return 1;
    if (node.includes('job') || msg.includes('job') || msg.includes('posting')) return 2;
    if (node.includes('skill') || msg.includes('gap') || ev.type === 'processing') return 3;
    if (node.includes('research') || msg.includes('material') || msg.includes('resource')) return 4;
    if (node.includes('plan') || msg.includes('plan') || ev.type === 'structuring') return 5;
    return 0;
  };

  const handleSend = async (text: string, attachedFile?: AttachedFile | null) => {
    const trimmed = text.trim();
    if (!trimmed || processingRef.current) return;

    // ── AUTH CHECK ────────────────────────────────────────────────────────
    // If auth is enabled AND user is unauthenticated, DO NOT CALL API!
    if (featureFlags.enableAuth && !user) {
      sessionStorage.setItem('prepamigo_pending_query', trimmed);
      navigate('/login', {
        state: { initialQuery: trimmed, from: '/dashboard/chat' },
      });
      return;
    }

    const displayContent = attachedFile
      ? `${trimmed}\n\n📎 Attached Resume: ${attachedFile.name}`
      : trimmed;

    setMessages((prev) => [...prev, { id: uid(), sender: 'user', content: displayContent }]);
    processingRef.current = true;
    setIsProcessing(true);

    const journeyId = uid();
    setMessages((prev) => [
      ...prev,
      {
        id: journeyId,
        sender: 'agent',
        content: '',
        scenario: 'agent-journey',
        data: { steps: PIPELINE_STEPS, activeIndex: 0 },
      },
    ]);

    // null: keep the current step (only its status text changes)
    const updateJourneyIndex = (requested: number | null, statusText?: string) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== journeyId) return m;
          const index = Math.min(requested ?? (Number(m.data?.activeIndex) || 0), PIPELINE_STEPS.length - 1);
          return {
            ...m,
            data: {
              ...m.data,
              activeIndex: index,
              steps: statusText
                ? m.data.steps.map((step: JourneyStep, stepIndex: number) =>
                  stepIndex === index ? { ...step, text: statusText } : step
                )
                : m.data.steps,
            },
          };
        })
      );
    };

    try {
      if (!clientRef.current) {
        clientRef.current = new AgentStreamClient();
      }

      await clientRef.current.startAgentRun(
        trimmed,
        {
          onEvent: (event) => {
            if (event.type === 'ping') {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== journeyId || m.scenario !== 'agent-journey') return m;
                  const activeIndex = Math.min(
                    Number(m.data?.activeIndex) || 0,
                    PIPELINE_STEPS.length - 1,
                  );
                  return {
                    ...m,
                    data: {
                      ...m.data,
                      steps: m.data.steps.map((step: JourneyStep, stepIndex: number) =>
                        stepIndex === activeIndex
                          ? { ...step, text: `${step.agent} is still working on this step…` }
                          : step
                      ),
                    },
                  };
                })
              );
              return;
            }
            const stepIdx = mapEventToStepIndex(event);
            const statusText = event.type === 'tool_call'
              ? toolCallText(event.payload)
              : typeof event.payload?.message === 'string'
                ? event.payload.message
                : undefined;
            // a tool call from an agent the map doesn't know (index 0) must not rewind the journey
            updateJourneyIndex(event.type === 'tool_call' && stepIdx === 0 ? null : stepIdx, statusText);
          },
          onWaiting: (payload) => {
            // ReAct evaluator paused for clarification
            setMessages((prev) => prev.filter((m) => m.id !== journeyId));
            const questionText =
              (typeof payload?.question === 'string'
                ? payload.question
                : payload?.question?.question) ||
              payload?.message ||
              'I need a few more details to prepare your roadmap. Could you clarify?';
            addAgentMessage({
              content: questionText,
            });
            setIsProcessing(false);
            processingRef.current = false;
          },
          onCompleted: (payload) => {
            setMessages((prev) => prev.filter((m) => m.id !== journeyId));
            const messageText =
              payload?.message ||
              payload?.result?.summary ||
              "I've analyzed your preparation request and generated your roadmap.";

            const company =
              payload?.result?.company_research?.data?.profile?.name ||
              payload?.company_profile?.name ||
              'Target Company';
            const role = payload?.result?.job_intelligence?.data?.role || 'Target Role';
            const planId = payload?.plan_id || payload?.result?.plan_id || payload?.result?.study_plan?.plan_id;

            addAgentMessage({
              content: messageText,
              scenario: (payload?.result || planId) ? 'setup' : undefined,
              data: (payload?.result || planId)
                ? {
                  role,
                  company,
                  planId,
                }
                : undefined,
            });

            void refreshPreps();
            // User requested: No autoredirect. The user gets a button to go to the roadmap.

            setIsProcessing(false);
            processingRef.current = false;
          },
          onError: (err) => {
            setMessages((prev) => prev.filter((m) => m.id !== journeyId));
            const errorMsg =
              err instanceof Error
                ? err.message
                : err?.detail ||
                err?.error ||
                'The agent workflow encountered an error. Please try again.';
            addAgentMessage({
              content: `Error: ${errorMsg}`,
            });
            setIsProcessing(false);
            processingRef.current = false;
          },
        },
        threadId,
        // Chat uploaded file text supersedes stored profile resume
        attachedFile?.text || user?.profile?.resume_text
      );
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== journeyId));
      addAgentMessage({
        content: `Could not start the workflow: ${err?.message || 'Agent service is unreachable.'}`,
      });
      setIsProcessing(false);
      processingRef.current = false;
    }
  };

  // Automatically fire initial query from landing page or post-auth redirect
  useEffect(() => {
    if (initialFiredRef.current) return;

    const stateQuery = (location.state as { initialQuery?: string })?.initialQuery;
    const sessionQuery = sessionStorage.getItem('prepamigo_pending_query');
    const queryToFire = stateQuery || sessionQuery;

    if (queryToFire && queryToFire.trim()) {
      if (featureFlags.enableAuth && !user) {
        return; // Wait until authenticated if auth is enabled
      }
      initialFiredRef.current = true;
      sessionStorage.removeItem('prepamigo_pending_query');
      window.history.replaceState({}, document.title);
      handleSend(queryToFire.trim());
    }
  }, [user]);

  const hasStarted = messages.length > 0;

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-bg h-full overflow-hidden">
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* AgentActivity removed: the journey now lives inside the conversation */}

        {hasStarted && (
          <>
            <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-white/70 backdrop-blur-xs shrink-0 z-20">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-bold text-deep-emerald uppercase tracking-wider">Preparation Agent</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMessages([]);
                  clientRef.current?.close();
                  clientRef.current = new AgentStreamClient();
                }}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-border bg-bg text-carbon-700 hover:bg-lavender-100 hover:text-deep-emerald transition-colors disabled:opacity-50"
              >
                <Icon name="add-outline" className="text-sm" />
                <span>New Plan</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Messages messages={messages} />
              <div ref={messagesEndRef} className="h-4" />
            </div>
          </>
        )}

        <div
          className={cn(
            'flex flex-col w-full z-10 relative',
            hasStarted
              ? 'mt-auto pt-6 pb-4 px-4 bg-bg border-t border-border safe-area-bottom'
              : 'flex-1 justify-center items-center px-4 sm:px-8 overflow-y-auto'
          )}
        >
          {hasStarted && (
            <div className="absolute top-0 left-0 w-full h-12 -translate-y-full bg-gradient-to-t from-bg to-transparent pointer-events-none" />
          )}

          <AnimatePresence mode="popLayout">
            {!hasStarted && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                className="flex flex-col items-center w-full mb-12 mt-10"
              >
                <h2 className="text-4xl font-extrabold text-carbon-900 tracking-tight">How can PrepAmigo help?</h2>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            layout
            layoutId="prepamigo-input"
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className={cn('w-full relative z-20', hasStarted ? 'max-w-3xl mx-auto' : 'max-w-2xl mx-auto')}
          >
            <ChatInput
              onSend={handleSend}
              disabled={isProcessing}
              placeholder={hasStarted ? 'Message PrepAmigo...' : "Tell PrepAmigo what you're preparing for..."}
            />
          </motion.div>

          <AnimatePresence mode="popLayout">
            {!hasStarted && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20, transition: { duration: 0.2 } }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl mt-12"
              >
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(s)}
                    disabled={isProcessing}
                    className="flex flex-col gap-2 items-start justify-center p-5 text-left bg-white border border-border rounded-[1.5rem] hover:-translate-y-1 hover:shadow-pop hover:border-chrome-accent/30 transition-all text-carbon-900 disabled:opacity-50 group"
                  >
                    <Icon
                      name={i === 0 ? 'rocket' : i === 1 ? 'bar-chart' : i === 2 ? 'time' : 'albums'}
                      className="text-xl text-carbon-500 group-hover:text-chrome-accent transition-colors"
                    />
                    <span className="text-sm font-medium leading-relaxed">{s}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* <div className="w-full md:w-96 border-l border-border bg-surface flex flex-col h-full overflow-hidden shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.05)]">
        <div className="p-6 border-b border-border bg-bg shrink-0">
          <h3 className="text-lg font-bold text-carbon-900 flex items-center gap-3">
            <Icon name="person" className="text-chrome-accent text-xl" /> Live Context
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4 relative">
          <motion.div
            animate={{
              boxShadow: highlightField ? '0 0 0 2px var(--color-violet-500)' : '0 0 0 0px transparent',
            }}
            transition={{ duration: 0.5 }}
            className="rounded-card overflow-hidden"
          >
            <LearningContextPanel
              context={mockContext}
              highlightField={highlightField}
              highlightSource={highlightSource}
            />
          </motion.div>
        </div>
      </div> */}
    </div>
  );
}