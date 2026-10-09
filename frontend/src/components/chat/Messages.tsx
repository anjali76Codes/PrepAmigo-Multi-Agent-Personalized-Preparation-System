import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { FlashcardDeck } from '../practice/FlashcardDeck';
import { ChatJourney, type JourneyStep } from './AgentJourney';
import type { FlashcardDeck as FlashcardDeckType } from '../../data/mockData';
import { useAppContext } from '../../context/AppContext';
import { Mascot } from '../ui/Mascot';

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
  const { setActivePrepId } = useAppContext();
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
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${msg.sender === 'user'
              ? 'bg-soft-rose text-expresso'
              : 'bg-expresso rounded-full overflow-hidden'
              }`}
          >
            {msg.sender === 'user' ? (
              <Icon name="person" />
            ) : (
              <Mascot
                variant="nosy.png"
                size="sm"
                alt="PrepAmigo"
                className="w-full h-full object-contain"
              />
            )}
          </div>

          <div className={`space-y-4 ${msg.sender === 'user' ? 'items-end flex flex-col' : 'flex-1'}`}>
            {msg.content && (
              <div className={`px-4 py-3 rounded-card ${msg.sender === 'user' ? 'bg-expresso text-white rounded-tr-sm' : 'bg-surface border border-border rounded-tl-sm text-carbon-900'
                }`}>
                {msg.content}
              </div>
            )}

            {/* NEW: agent journey shown as the response while agents work */}
            {msg.scenario === 'agent-journey' && msg.data && (
              <ChatJourney
                steps={msg.data.steps as JourneyStep[]}
                activeIndex={msg.data.activeIndex}
                autoPlay={msg.data.activeIndex === undefined}
                finalAction={msg.data.finalAction}
                onComplete={() => onJourneyComplete?.(msg.id)}
              />
            )}

            {msg.scenario === 'setup' && msg.data && (
              <div className="p-4 bg-white border border-border rounded-2xl shadow-xs max-w-md space-y-3">
                <div className="flex items-center gap-2.5 text-deep-emerald font-bold text-sm">
                  <span className="w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center shrink-0">
                    <Icon name="checkmark" className="text-base" />
                  </span>
                  <span>{msg.data.role} at {msg.data.company} plan ready!</span>
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <Link
                    to="/roadmap"
                    onClick={() => {
                      if (msg.data?.planId) setActivePrepId(msg.data.planId);
                    }}
                  >
                    <Button variant="primary" size="sm" className="flex items-center gap-1.5 text-xs font-bold py-2 px-3.5 rounded-xl">
                      Go to Roadmap <Icon name="arrow-forward-outline" />
                    </Button>
                  </Link>
                  <Link
                    to="/calendar"
                    onClick={() => {
                      if (msg.data?.planId) setActivePrepId(msg.data.planId);
                    }}
                  >
                    <Button variant="outline" size="sm" className="flex items-center gap-1.5 text-xs py-2 px-3 rounded-xl">
                      <Icon name="calendar-outline" /> Calendar
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {msg.scenario === 'plan-update' && (
              <Card variant="default" className="p-6">
                <div className="flex items-center gap-3 mb-4 text-expresso font-bold">
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
                      <span className="text-expresso font-medium">Missed Reading (Moved)</span>
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