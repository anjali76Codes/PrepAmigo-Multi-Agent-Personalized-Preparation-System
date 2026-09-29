import { motion } from 'framer-motion';
import { Icon } from '../ui/Icon';
import { FlashcardDeck } from '../practice/FlashcardDeck';
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
      {messages.map((msg) => (
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
