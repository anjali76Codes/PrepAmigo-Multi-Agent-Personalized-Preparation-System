import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatInput } from '../components/chat/ChatInput';
import { Messages } from '../components/chat/Messages';
import type { Message } from '../components/chat/Messages';
import type { JourneyStep, JourneyAction } from '../components/chat/AgentJourney';
import { LearningContextPanel } from '../components/preps/LearningContextPanel';
import { useAppContext } from '../context/AppContext';
import { Icon } from '../components/ui/Icon';
import { cn } from '../utils/utils';

// 6 nodes per scenario. Rename agents to match your AGENTS list if you like.
const JOURNEYS: Record<'setup' | 'plan-update' | 'missed-task' | 'flashcards' | 'fallback', JourneyStep[]> = {
  setup: [
    { agent: 'Intake Agent', text: 'Reading your goal…' },
    { agent: 'Company Research', text: 'Analyzing Company X…' },
    { agent: 'Job Intelligence', text: 'Extracting role expectations…' },
    { agent: 'Research Agent', text: 'Collecting prep resources…' },
    { agent: 'Skill Gap Agent', text: 'Comparing against your skills…' },
    { agent: 'Planner Agent', text: 'Building your 45-day roadmap…' },
  ],
  'plan-update': [
    { agent: 'Intake Agent', text: 'Understanding what went wrong…' },
    { agent: 'Assessment Agent', text: 'Analyzing your quiz results…' },
    { agent: 'Skill Gap Agent', text: 'Finding weak topics…' },
    { agent: 'Research Agent', text: 'Picking better resources…' },
    { agent: 'Planner Agent', text: 'Reprioritizing upcoming sprints…' },
    { agent: 'Reviewer Agent', text: 'Double-checking the new plan…' },
  ],
  'missed-task': [
    { agent: 'Intake Agent', text: 'Checking what you missed…' },
    { agent: 'Progress Agent', text: 'Reviewing your streak…' },
    { agent: 'Research Agent', text: 'Checking topic priorities…' },
    { agent: 'Skill Gap Agent', text: 'Estimating the impact…' },
    { agent: 'Planner Agent', text: 'Redistributing workload…' },
    { agent: 'Reviewer Agent', text: 'Making sure it stays balanced…' },
  ],
  flashcards: [
    { agent: 'Intake Agent', text: 'Reading your request…' },
    { agent: 'Planner Agent', text: 'Fetching relevant topics…' },
    { agent: 'Research Agent', text: 'Pulling key concepts…' },
    { agent: 'Assessment Agent', text: 'Generating flashcards…' },
    { agent: 'Difficulty Agent', text: 'Tuning difficulty levels…' },
    { agent: 'Reviewer Agent', text: 'Polishing the deck…' },
  ],
  fallback: [
    { agent: 'Intake Agent', text: 'Reading your message…' },
    { agent: 'Planner Agent', text: 'Thinking…' },
    { agent: 'Research Agent', text: 'Looking for context…' },
    { agent: 'Skill Gap Agent', text: 'Checking your profile…' },
    { agent: 'Assessment Agent', text: 'Weighing options…' },
    { agent: 'Reviewer Agent', text: 'Wrapping up…' },
  ],
};

const STEP_MS = 1500;   // time the mascot spends at each node
const FINISH_MS = 1000; // time to show the "cheer" state before the answer appears

let idCounter = 0;
const uid = () => `${Date.now()}-${idCounter++}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function Chat() {
  const location = useLocation();
  const initialFiredRef = useRef(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [highlightField, setHighlightField] = useState<'role' | 'summary' | 'gaps' | 'all' | null>(null);
  const [highlightSource, setHighlightSource] = useState<string>('');

  const { preps: mockPreps } = useAppContext();
  const mockContext = mockPreps[0].learningContext;

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages]);

  const suggestions = [
    'I have 45 days to prepare for SDE at Company X',
    'I scored badly on my DSA quiz, adjust my plan',
    'I missed the last two days',
    'Give me revision cards for system design',
  ];

  // Shows the journey as the agent's "response", advances it, then removes it.
  const runJourney = async (
    steps: JourneyStep[],
    opts: { finalAction?: JourneyAction; keep?: boolean } = {}
  ) => {
    const journeyId = uid();

    setMessages((prev) => [
      ...prev,
      {
        id: journeyId,
        sender: 'agent',
        content: '',
        scenario: 'agent-journey',
        data: { steps, activeIndex: 0, finalAction: opts.finalAction },
      },
    ]);

    const setIndex = (index: number) =>
      setMessages((prev) =>
        prev.map((m) =>
          m.id === journeyId ? { ...m, data: { ...m.data, activeIndex: index } } : m
        )
      );

    for (let i = 0; i < steps.length; i++) {
      if (i > 0) setIndex(i);
      await sleep(STEP_MS);
    }

    setIndex(steps.length);
    await sleep(FINISH_MS);

    // Only remove the journey when it has no button to keep alive
    if (!opts.keep) {
      setMessages((prev) => prev.filter((m) => m.id !== journeyId));
    }
  };

  const addAgentMessage = (msg: Omit<Message, 'id' | 'sender'>) =>
    setMessages((prev) => [...prev, { id: uid(), sender: 'agent', ...msg }]);

  const handleSend = async (text: string) => {
    setMessages((prev) => [...prev, { id: uid(), sender: 'user', content: text }]);
    setIsProcessing(true);

    const lower = text.toLowerCase();

    try {
      if (
        (lower.includes('45 days') && lower.includes('company x')) ||
        lower.includes('preparing for') ||
        lower.includes('interview at')
      ) {
        const companyMatch = text.match(/at\s+([A-Za-z0-9\s_-]+?)(?:\s+in|\s*,|\s*\.|$)/i);
        const roleMatch = text.match(/for\s+(?:a\s+)?([A-Za-z0-9\s_-]+?)(?:\s+position|\s+at|\s+in|\s*,|\s*\.|$)/i);

        const company = companyMatch ? companyMatch[1].trim() : 'Target Company';
        const role = roleMatch ? roleMatch[1].trim() : 'Target Role';

        await runJourney(JOURNEYS.setup, {
          keep: true,
          finalAction: { label: 'View Roadmap', to: '/app/preps/prep-1' },
        });
        addAgentMessage({
          content: "I've analyzed the role and generated your personalized roadmap. Here is the summary:",
          scenario: 'setup',
          data: { role, company },
        });
        setHighlightField('all');
        setHighlightSource('Planner');
      } else if (lower.includes('scored badly') || lower.includes('adjust my plan')) {
        await runJourney(JOURNEYS['plan-update']);
        addAgentMessage({
          content: "I've adjusted your roadmap to spend more time on your weak areas.",
          scenario: 'plan-update',
        });
        setHighlightField('gaps');
        setHighlightSource('Assessment');
      } else if (lower.includes('missed')) {
        await runJourney(JOURNEYS['missed-task']);
        addAgentMessage({
          content: "No worries! I've shifted your tasks to maintain a balanced workload.",
          scenario: 'missed-task',
        });
        setHighlightField('summary');
        setHighlightSource('Progress');
      } else if (lower.includes('revision cards')) {
        await runJourney(JOURNEYS.flashcards);
        addAgentMessage({
          content: "Here's a quick revision deck for System Design:",
          scenario: 'flashcards',
          data: mockPreps[0].assessments.flashcardDecks[0],
        });
        setHighlightField('gaps');
        setHighlightSource('Planner');
      } else {
        await runJourney(JOURNEYS.fallback);
        addAgentMessage({
          content:
            'I can help with interview preparation, roadmap adjustments, and study materials. Try one of the suggested prompts!',
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Automatically fire initial query from landing page or post-auth redirect
  useEffect(() => {
    if (initialFiredRef.current) return;

    const stateQuery = (location.state as { initialQuery?: string })?.initialQuery;
    const sessionQuery = sessionStorage.getItem("prepamigo_pending_query");
    const queryToFire = stateQuery || sessionQuery;

    if (queryToFire && queryToFire.trim()) {
      initialFiredRef.current = true;
      sessionStorage.removeItem("prepamigo_pending_query");
      window.history.replaceState({}, document.title);
      handleSend(queryToFire.trim());
    }
  }, []);

  const hasStarted = messages.length > 0;

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-bg h-full overflow-hidden">
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* AgentActivity removed: the journey now lives inside the conversation */}

        {hasStarted && (
          <div className="flex-1 overflow-y-auto">
            <Messages messages={messages} />
            <div ref={messagesEndRef} className="h-4" />
          </div>
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
            layoutId="chat-input-morph"
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

      <div className="w-full md:w-96 border-l border-border bg-surface flex flex-col h-full overflow-hidden shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.05)]">
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
      </div>
    </div>
  );
}