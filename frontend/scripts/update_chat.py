import os

# 1. ChatInput.tsx
chat_input = """import { useState } from 'react';
import { Icon } from '../ui/Icon';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 bg-surface p-2 rounded-2xl border border-border shadow-sm focus-within:border-primary/50 transition-colors">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        placeholder="Type a message or select a suggestion..."
        className="flex-1 bg-transparent px-4 py-2 text-primary-text placeholder:text-secondary-text outline-none"
      />
      <button
        type="submit"
        disabled={!text.trim() || disabled}
        className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors shrink-0"
      >
        <Icon name="send" />
      </button>
    </form>
  );
}
"""

with open("src/components/chat/ChatInput.tsx", "w") as f:
    f.write(chat_input)

# 2. AgentActivity.tsx
agent_activity = """import { motion, useReducedMotion } from 'framer-motion';
import { Icon } from '../ui/Icon';
import type { AgentName } from '../../data/mockData';

interface AgentActivityProps {
  activeAgent: AgentName | null;
  statusText: string;
}

export function AgentActivity({ activeAgent, statusText }: AgentActivityProps) {
  const shouldReduceMotion = useReducedMotion();
  
  const allAgents: AgentName[] = [
    'Company Research',
    'Job Intelligence',
    'Interview Intelligence',
    'Skill Gap',
    'Research',
    'Assessment',
    'Planner',
    'Progress'
  ];

  return (
    <div className="bg-surface border-b border-border p-4 overflow-hidden shrink-0">
      <div className="flex items-center gap-3 mb-4 overflow-x-auto hide-scrollbar pb-2">
        {allAgents.map((agent, i) => {
          const isActive = activeAgent === agent;
          const isDone = activeAgent ? allAgents.indexOf(agent) < allAgents.indexOf(activeAgent) : false;
          
          return (
            <div key={agent} className="flex items-center gap-2 shrink-0">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                isActive ? 'bg-primary/10 border-primary/20 text-primary' : 
                isDone ? 'bg-accent/10 border-accent/20 text-accent' : 
                'bg-background border-border text-secondary-text'
              }`}>
                {isActive && (
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-3 h-3 border-2 border-current border-t-transparent rounded-full"
                  />
                )}
                {isDone && <Icon name="checkmark-outline" />}
                {agent}
              </div>
              {i < allAgents.length - 1 && (
                <div className="w-4 h-px bg-border" />
              )}
            </div>
          );
        })}
      </div>
      
      <div className="flex items-center gap-2 text-sm text-secondary-text bg-background p-3 rounded-lg border border-border">
        <Icon name="information-circle-outline" className="text-primary" />
        <span className="font-medium text-primary-text">{activeAgent || 'Idle'}:</span> {statusText || 'Waiting for input...'}
      </div>
    </div>
  );
}
"""

with open("src/components/chat/AgentActivity.tsx", "w") as f:
    f.write(agent_activity)

# 3. Messages.tsx
messages = """import { motion } from 'framer-motion';
import { Icon } from '../ui/Icon';
import { FlashcardDeck } from '../preps/FlashcardDeck';
import type { FlashcardDeck as FlashcardDeckType } from '../../data/mockData';
import { Link } from 'react-router-dom';

export interface Message {
  id: string;
  sender: 'user' | 'agent';
  content: string;
  scenario?: 'setup' | 'plan-update' | 'missed-task' | 'flashcards';
  data?: any;
}

interface MessagesProps {
  messages: Message[];
}

export function Messages({ messages }: MessagesProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      {messages.map((msg, i) => (
        <motion.div
          key={msg.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex gap-4 max-w-3xl mx-auto ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
            msg.sender === 'user' ? 'bg-accent/10 text-accent' : 'bg-primary text-white'
          }`}>
            <Icon name={msg.sender === 'user' ? 'person' : 'chatbubbles-outline'} />
          </div>
          
          <div className={`space-y-4 ${msg.sender === 'user' ? 'items-end flex flex-col' : 'flex-1'}`}>
            <div className={`px-4 py-3 rounded-2xl ${
              msg.sender === 'user' ? 'bg-accent text-white rounded-tr-sm' : 'bg-surface border border-border rounded-tl-sm text-primary-text'
            }`}>
              {msg.content}
            </div>

            {msg.scenario === 'setup' && msg.data && (
              <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
                <h4 className="font-bold text-lg text-primary-text">Prep Created: {msg.data.role} at {msg.data.company}</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-background p-4 rounded-lg border border-border">
                    <div className="text-sm text-secondary-text mb-1">Top Expectations</div>
                    <ul className="list-disc list-inside text-sm text-primary-text">
                      <li>System Design</li>
                      <li>Data Structures</li>
                    </ul>
                  </div>
                  <div className="bg-background p-4 rounded-lg border border-border">
                    <div className="text-sm text-secondary-text mb-1">Identified Gaps</div>
                    <ul className="list-disc list-inside text-sm text-warning font-medium">
                      <li>System Design (High)</li>
                      <li>Graphs (Medium)</li>
                    </ul>
                  </div>
                </div>
                <Link to="/app/preps/prep-1" className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-primary/90">
                  View Roadmap <Icon name="arrow-forward-outline" />
                </Link>
              </div>
            )}

            {msg.scenario === 'plan-update' && (
              <div className="bg-surface border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4 text-accent font-bold">
                  <Icon name="sync-outline" className="text-xl" /> Plan Reprioritized
                </div>
                <p className="text-sm text-secondary-text mb-4">
                  <strong>Reason:</strong> Low score on the recent DSA quiz.
                </p>
                <div className="flex items-center gap-4 text-sm bg-background p-4 rounded-lg border border-border">
                  <div className="line-through text-secondary-text">Arrays & Hashing</div>
                  <Icon name="arrow-forward-outline" className="text-secondary-text" />
                  <div className="text-primary font-bold">Trees & Graphs</div>
                </div>
              </div>
            )}

            {msg.scenario === 'missed-task' && (
              <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
                <div className="bg-warning/10 text-warning border border-warning/20 rounded-lg p-4 font-medium flex items-center gap-2">
                  <Icon name="warning-outline" /> 2 Missed Tasks
                </div>
                <div className="bg-background p-4 rounded-lg border border-border">
                  <h5 className="text-sm font-bold text-primary-text mb-2">Rescheduled Roadmap</h5>
                  <div className="space-y-2">
                    <div className="text-sm flex justify-between p-2 rounded bg-surface border border-border">
                      <span className="text-secondary-text">Today</span>
                      <span className="text-accent font-medium">Missed Reading (Moved)</span>
                    </div>
                    <div className="text-sm flex justify-between p-2 rounded bg-background border border-border opacity-70">
                      <span className="text-secondary-text">Tomorrow</span>
                      <span className="text-primary-text">Arrays Quiz (Pushed back)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {msg.scenario === 'flashcards' && msg.data && (
              <div className="mt-4">
                <FlashcardDeck deck={msg.data as FlashcardDeckType} />
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
"""

with open("src/components/chat/Messages.tsx", "w") as f:
    f.write(messages)

# 4. Chat.tsx
chat = """import { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChatInput } from '../components/chat/ChatInput';
import { AgentActivity } from '../components/chat/AgentActivity';
import { Messages, Message } from '../components/chat/Messages';
import { LearningContextPanel } from '../components/preps/LearningContextPanel';
import { mockPreps, AgentName } from '../data/mockData';
import { Icon } from '../components/ui/Icon';

export function Chat() {
  const shouldReduceMotion = useReducedMotion();
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeAgent, setActiveAgent] = useState<AgentName | null>(null);
  const [statusText, setStatusText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [highlightContext, setHighlightContext] = useState(false);

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
      triggerContextHighlight();
    } else if (lower.includes('scored badly') || lower.includes('adjust my plan')) {
      await runPipeline(['Assessment', 'Planner'], "Analyzing recent assessment results...", "Reprioritizing upcoming sprints...");
      setMessages(prev => [...prev, {
        id: Date.now().toString(), sender: 'agent', 
        content: "I've adjusted your roadmap to spend more time on your weak areas.",
        scenario: 'plan-update'
      }]);
    } else if (lower.includes('missed')) {
      await runPipeline(['Progress', 'Planner'], "Checking missed days...", "Redistributing workload...");
      setMessages(prev => [...prev, {
        id: Date.now().toString(), sender: 'agent', 
        content: "No worries! I've shifted your tasks to maintain a balanced workload.",
        scenario: 'missed-task'
      }]);
    } else if (lower.includes('revision cards')) {
      await runPipeline(['Planner', 'Assessment'], "Fetching relevant topics...", "Generating flashcards...");
      setMessages(prev => [...prev, {
        id: Date.now().toString(), sender: 'agent', 
        content: "Here's a quick revision deck for System Design:",
        scenario: 'flashcards',
        data: mockPreps[0].assessments.flashcardDecks[0]
      }]);
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

  const triggerContextHighlight = () => {
    setHighlightContext(true);
    setTimeout(() => setHighlightContext(false), 2000);
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
              boxShadow: highlightContext ? '0 0 0 2px var(--color-primary)' : '0 0 0 0px transparent'
            }}
            transition={{ duration: 0.5 }}
            className="rounded-xl overflow-hidden"
          >
            <LearningContextPanel context={mockContext} />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
"""

with open("src/pages/Chat.tsx", "w") as f:
    f.write(chat)
