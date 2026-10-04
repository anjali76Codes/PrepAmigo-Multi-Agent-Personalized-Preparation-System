import { motion } from 'framer-motion';
import { Icon } from '../ui/Icon';
import { Card } from '../ui/Card';
import { Alert } from '../ui/Alert';
import { FlashcardDeck } from '../practice/FlashcardDeck';
import { AgentJourney, type JourneyStep } from './AgentJourney'; // NEW
import type { FlashcardDeck as FlashcardDeckType } from '../../data/mockData';

export interface Message {
  id: string;
  sender: 'user' | 'agent';
  content: string;
  scenario?: 'setup' | 'plan-update' | 'missed-task' | 'flashcards' | 'agent-journey'; // NEW
  data?: any;
}

interface MessagesProps {
  messages: Message[];
  onJourneyComplete?: (messageId: string) => void; // NEW
}

export function Messages({ messages, onJourneyComplete }: MessagesProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      {messages.map((msg) => (
        <motion.div
          key={msg.id}
          id={`msg-${msg.id}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex gap-4 max-w-5xl mx-auto ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.sender === 'user' ? 'bg-navy-100 text-navy-700' : 'bg-carbon-900 text-white'
            }`}>
            <Icon name={msg.sender === 'user' ? 'person' : 'chatbubbles-outline'} />
          </div>

          <div className={`space-y-4 ${msg.sender === 'user' ? 'items-end flex flex-col' : 'flex-1'}`}>
            {msg.content && (
              <div className={`px-4 py-3 rounded-card ${msg.sender === 'user' ? 'bg-navy-700 text-white rounded-tr-sm' : 'bg-surface border border-border rounded-tl-sm text-carbon-900'
                }`}>
                {msg.content}
              </div>
            )}

            {/* NEW: agent journey shown as the response while agents work */}
            {msg.scenario === 'agent-journey' && msg.data && (
              <AgentJourney
                steps={msg.data.steps as JourneyStep[]}
                activeIndex={msg.data.activeIndex}          // controlled (optional)
                autoPlay={msg.data.activeIndex === undefined} // demo mode if not controlled
                finalAction={msg.data.finalAction}
                onComplete={() => onJourneyComplete?.(msg.id)}
              />
            )}

            {msg.scenario === 'setup' && msg.data && (
              <Card variant="default" className="p-6 space-y-4">
                <h4 className="font-bold text-lg text-carbon-900">Prep Created: {msg.data.role} at {msg.data.company}</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-bg p-4 rounded-control border border-border">
                    <div className="text-sm text-carbon-500 mb-1">Top Expectations</div>
                    <ul className="list-disc list-inside text-sm text-carbon-900">
                      <li>System Design</li>
                      <li>Data Structures</li>
                    </ul>
                  </div>
                  <div className="bg-bg p-4 rounded-control border border-border">
                    <div className="text-sm text-carbon-500 mb-1">Identified Gaps</div>
                    <ul className="list-disc list-inside text-sm text-beige-600 font-medium">
                      <li>System Design (High)</li>
                      <li>Graphs (Medium)</li>
                    </ul>
                  </div>
                </div>
                {/* <Link to="/dashboard/preps/prep-1">
                  <Button variant="primary">
                    View Roadmap <Icon name="arrow-forward-outline" />
                  </Button>
                </Link> */}
              </Card>
            )}

            {msg.scenario === 'plan-update' && (
              <Card variant="default" className="p-6">
                <div className="flex items-center gap-3 mb-4 text-navy-700 font-bold">
                  <Icon name="sync-outline" className="text-xl" /> Plan Reprioritized
                </div>
                <p className="text-sm text-carbon-500 mb-4">
                  <strong>Reason:</strong> Low score on the recent DSA quiz.
                </p>
                <div className="flex items-center gap-4 text-sm bg-bg p-4 rounded-control border border-border">
                  <div className="line-through text-carbon-500">Arrays & Hashing</div>
                  <Icon name="arrow-forward-outline" className="text-carbon-500" />
                  <div className="text-carbon-900 font-bold">Trees & Graphs</div>
                </div>
              </Card>
            )}

            {msg.scenario === 'missed-task' && (
              <Card variant="default" className="p-6 space-y-4">
                <Alert variant="warning" icon="warning-outline">
                  2 Missed Tasks
                </Alert>
                <div className="bg-bg p-4 rounded-control border border-border">
                  <h5 className="text-sm font-bold text-carbon-900 mb-2">Rescheduled Roadmap</h5>
                  <div className="space-y-2">
                    <div className="text-sm flex justify-between p-2 rounded bg-surface border border-border">
                      <span className="text-carbon-500">Today</span>
                      <span className="text-navy-700 font-medium">Missed Reading (Moved)</span>
                    </div>
                    <div className="text-sm flex justify-between p-2 rounded bg-bg border border-border opacity-70">
                      <span className="text-carbon-500">Tomorrow</span>
                      <span className="text-carbon-900">Arrays Quiz (Pushed back)</span>
                    </div>
                  </div>
                </div>
              </Card>
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