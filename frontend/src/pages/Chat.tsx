import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatInput } from '../components/chat/ChatInput';
import { AgentActivity } from '../components/chat/AgentActivity';
import { Messages } from '../components/chat/Messages';
import type { Message } from '../components/chat/Messages';
import { LearningContextPanel } from '../components/preps/LearningContextPanel';
import { useAppContext } from '../context/AppContext';
import type { AgentName } from '../data/mockData';
import { Icon } from '../components/ui/Icon';
import { Mascot } from '../components/ui/Mascot';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/Button';

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeAgent, setActiveAgent] = useState<AgentName | null>(null);
  const [statusText, setStatusText] = useState('');
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
    "I have 45 days to prepare for SDE at Company X",
    "I scored badly on my DSA quiz, adjust my plan",
    "I missed the last two days",
    "Give me revision cards for system design"
  ];

  const handleSend = async (text: string) => {
    const newMsg: Message = { id: Date.now().toString(), sender: 'user', content: text };
    setMessages(prev => [...prev, newMsg]);
    setIsProcessing(true);

    const lower = text.toLowerCase();
    
    if (lower.includes('45 days') && lower.includes('company x')) {
      await runPipeline(['Company Research', 'Job Intelligence', 'Research', 'Skill Gap', 'Planner'], 
        "Analyzing Company X...",
        "Building your 45-day roadmap..."
      );
      setMessages(prev => [...prev, {
        id: Date.now().toString(), sender: 'agent', 
        content: "I've analyzed the role and generated your personalized roadmap. Here is the summary:",
        scenario: 'setup',
        data: { role: 'SDE', company: 'Company X' }
      }]);
      setHighlightField('all');
      setHighlightSource('Planner');
    } else if (lower.includes('scored badly') || lower.includes('adjust my plan')) {
      await runPipeline(['Assessment', 'Planner'], "Analyzing recent assessment results...", "Reprioritizing upcoming sprints...");
      setMessages(prev => [...prev, {
        id: Date.now().toString(), sender: 'agent', 
        content: "I've adjusted your roadmap to spend more time on your weak areas.",
        scenario: 'plan-update'
      }]);
      setHighlightField('gaps');
      setHighlightSource('Assessment');
    } else if (lower.includes('missed')) {
      await runPipeline(['Research', 'Planner'], "Checking missed days...", "Redistributing workload...");
      setMessages(prev => [...prev, {
        id: Date.now().toString(), sender: 'agent', 
        content: "No worries! I've shifted your tasks to maintain a balanced workload.",
        scenario: 'missed-task'
      }]);
      setHighlightField('summary');
      setHighlightSource('Progress');
    } else if (lower.includes('revision cards')) {
      await runPipeline(['Planner', 'Assessment'], "Fetching relevant topics...", "Generating flashcards...");
      setMessages(prev => [...prev, {
        id: Date.now().toString(), sender: 'agent', 
        content: "Here's a quick revision deck for System Design:",
        scenario: 'flashcards',
        data: mockPreps[0].assessments.flashcardDecks[0]
      }]);
      setHighlightField('gaps');
      setHighlightSource('Planner');
    } else {
      setActiveAgent('Planner');
      setStatusText('Thinking...');
      await new Promise(r => setTimeout(r, 1000));
      setMessages(prev => [...prev, {
        id: Date.now().toString(), sender: 'agent', 
        content: "I can help with interview preparation, roadmap adjustments, and study materials. Try one of the suggested prompts!"
      }]);
    }
    
    setActiveAgent(null);
    setStatusText('');
    setIsProcessing(false);
  };

  const runPipeline = async (agents: AgentName[], startMsg: string, endMsg: string) => {
    for (let i = 0; i < agents.length; i++) {
      setActiveAgent(agents[i]);
      setStatusText(i === 0 ? startMsg : i === agents.length - 1 ? endMsg : `Processing step ${i + 1}...`);
      await new Promise(r => setTimeout(r, 1200));
    }
  };

  const hasStarted = messages.length > 0;

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-bg h-full overflow-hidden">
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        <AgentActivity activeAgent={activeAgent} statusText={statusText} />
        
        {hasStarted && (
          <div className="flex-1 overflow-y-auto">
            <Messages messages={messages} />
            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
        
        <div className={cn(
          "flex flex-col w-full z-10 relative",
          hasStarted ? "mt-auto pt-6 pb-4 px-4 bg-bg border-t border-border safe-area-bottom" : "flex-1 justify-center items-center px-4 sm:px-8 overflow-y-auto"
        )}>
          {hasStarted && (
            <div className="absolute top-0 left-0 w-full h-12 -translate-y-full bg-gradient-to-t from-bg to-transparent pointer-events-none" />
          )}

          <AnimatePresence mode="popLayout">
            {!hasStarted && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                className="flex flex-col items-center w-full mb-8"
              >
                <Mascot size="lg" mood="idle" className="mb-6 bg-surface shadow-card border border-border" />
                <h2 className="text-2xl font-bold text-ink mb-2 text-center">How can PrepAmigo help?</h2>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div 
            layout
            layoutId="chat-input-morph"
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className={cn("w-full relative z-20", hasStarted ? "max-w-3xl mx-auto" : "max-w-2xl mx-auto")}
          >
            <ChatInput 
              onSend={handleSend} 
              disabled={isProcessing} 
              placeholder={hasStarted ? "Message PrepAmigo..." : "Tell PrepAmigo what you're preparing for..."}
            />
          </motion.div>

          <AnimatePresence mode="popLayout">
            {!hasStarted && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20, transition: { duration: 0.2 } }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl mt-8"
              >
                {suggestions.map((s, i) => (
                  <Button 
                    key={i}
                    variant="outline"
                    onClick={() => handleSend(s)}
                    disabled={isProcessing}
                    className="h-auto p-4 justify-start text-left text-ink text-sm bg-surface hover:bg-surface-muted hover:border-violet-500/50 whitespace-normal font-normal"
                  >
                    {s}
                  </Button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="w-full md:w-80 border-l border-border bg-surface flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-border bg-bg shrink-0">
          <h3 className="font-bold text-ink flex items-center gap-2">
            <Icon name="person-outline" className="text-violet-500" /> Live Context
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4 relative">
          <motion.div
            animate={{ 
              boxShadow: highlightField ? '0 0 0 2px var(--color-violet-500)' : '0 0 0 0px transparent'
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
