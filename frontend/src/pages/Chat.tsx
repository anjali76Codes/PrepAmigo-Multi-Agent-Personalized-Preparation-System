import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChatInput } from '../components/chat/ChatInput';
import { AgentActivity } from '../components/chat/AgentActivity';
import { Messages } from '../components/chat/Messages';
import type { Message } from '../components/chat/Messages';
import { LearningContextPanel } from '../components/preps/LearningContextPanel';
import { useAppContext } from '../context/AppContext';
import type { AgentName } from '../data/mockData';
import { Icon } from '../components/ui/Icon';

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeAgent, setActiveAgent] = useState<AgentName | null>(null);
  const [statusText, setStatusText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [highlightField, setHighlightField] = useState<'role' | 'summary' | 'gaps' | 'all' | null>(null);
  const [highlightSource, setHighlightSource] = useState<string>('');

  const { preps: mockPreps } = useAppContext();
  const mockContext = mockPreps[0].learningContext;

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
      await runPipeline(['Company Research', 'Job Intelligence', 'Interview Intelligence', 'Skill Gap', 'Planner'], 
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
      await runPipeline(['Progress', 'Planner'], "Checking missed days...", "Redistributing workload...");
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


  return (
    <div className="flex-1 flex flex-col md:flex-row bg-background h-full overflow-hidden">
      <div className="flex-1 flex flex-col h-full relative">
        <AgentActivity activeAgent={activeAgent} statusText={statusText} />
        
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6">
              <Icon name="chatbubbles-outline" className="text-3xl" />
            </div>
            <h2 className="text-2xl font-bold text-primary-text mb-8">How can PrepAmigo help?</h2>
            <div className="grid gap-3 w-full max-w-2xl">
              {suggestions.map((s, i) => (
                <button 
                  key={i}
                  onClick={() => handleSend(s)}
                  disabled={isProcessing}
                  className="bg-surface border border-border p-4 rounded-xl text-left hover:border-primary/50 hover:bg-background transition-colors text-primary-text text-sm"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <Messages messages={messages} />
        )}
        
        <div className="p-4 bg-background border-t border-border z-10 safe-area-bottom">
          <div className="max-w-3xl mx-auto">
            <ChatInput onSend={handleSend} disabled={isProcessing} />
          </div>
        </div>
      </div>

      <div className="w-full md:w-80 border-l border-border bg-surface flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-border bg-background shrink-0">
          <h3 className="font-bold text-primary-text flex items-center gap-2">
            <Icon name="person-outline" className="text-primary" /> Live Context
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4 relative">
          <motion.div
            animate={{ 
              boxShadow: highlightField ? '0 0 0 2px var(--color-primary)' : '0 0 0 0px transparent'
            }}
            transition={{ duration: 0.5 }}
            className="rounded-xl overflow-hidden"
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
