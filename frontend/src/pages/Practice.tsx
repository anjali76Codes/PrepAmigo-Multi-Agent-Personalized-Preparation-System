import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAppContext } from '../context/AppContext';
import { WeeklyQuiz } from '../components/practice/WeeklyQuiz';
import { FlashcardDeck } from '../components/practice/FlashcardDeck';
import { PracticeItem } from '../components/preps/PracticeItem';
import { Icon } from '../components/ui/Icon';

export function Practice() {
  const shouldReduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<'quizzes' | 'flashcards' | 'coding' | 'mocks'>('quizzes');
  
  // Combine all assessments from all active preps for this global hub
  const { preps: mockPreps } = useAppContext();
  const allQuizzes = mockPreps.flatMap(p => p.assessments.quizzes);
  const allFlashcards = mockPreps.flatMap(p => p.assessments.flashcardDecks);
  const allTasks = mockPreps.flatMap(p => p.assessments.tasks);
  
  const codingTasks = allTasks.filter(t => t.type === 'coding');
  const mockInterviews = allTasks.filter(t => t.type === 'mock-interview');

  const tabs = [
    { id: 'quizzes', label: 'Weekly Quizzes', icon: 'help-circle-outline' },
    { id: 'flashcards', label: 'Flashcards', icon: 'albums-outline' },
    { id: 'coding', label: 'Coding Tasks', icon: 'code-slash-outline' },
    { id: 'mocks', label: 'Mock Interviews', icon: 'people-outline' },
  ] as const;

  return (
    <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
      <div className="border-b border-border bg-surface shrink-0 z-10 sticky top-0 px-4 md:px-8 py-6">
        <h1 className="text-3xl font-bold text-primary-text mb-2">Practice Hub</h1>
        <p className="text-secondary-text mb-6">Test your knowledge and strengthen your weak areas.</p>
        
        <div className="flex overflow-x-auto hide-scrollbar gap-6 border-t border-border mt-2 pt-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-secondary-text hover:text-primary-text'
              }`}
            >
              <Icon name={tab.icon} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 relative safe-area-bottom">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="max-w-4xl space-y-6"
        >
          {activeTab === 'quizzes' && allQuizzes.map(quiz => (
            <WeeklyQuiz key={quiz.id} />
          ))}
          {activeTab === 'flashcards' && allFlashcards.map(deck => (
            <FlashcardDeck key={deck.id} />
          ))}
          {activeTab === 'coding' && codingTasks.map(task => (
            <PracticeItem key={task.id} item={task} />
          ))}
          {activeTab === 'mocks' && mockInterviews.map(task => (
            <PracticeItem key={task.id} item={task} />
          ))}
        </motion.div>
      </div>
    </div>
  );
}
