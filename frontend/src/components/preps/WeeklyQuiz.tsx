import { Card } from '../ui/Card';
import type { WeeklyQuiz as WeeklyQuizType } from '../../data/mockData';
import { Icon } from '../ui/Icon';

export function WeeklyQuiz({ quiz }: { quiz: WeeklyQuizType }) {
  return (
    <Card className="p-6 bg-surface border-border flex justify-between items-center group hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
          quiz.status === 'completed' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'
        }`}>
          <Icon name="help-circle-outline" className="text-2xl" />
        </div>
        <div>
          <h4 className="font-semibold text-lg text-primary-text">{quiz.title}</h4>
          <p className="text-sm text-secondary-text mt-1 flex items-center gap-2">
            Status: <span className="capitalize">{quiz.status}</span>
            {quiz.status === 'completed' && (
              <>
                <span>•</span>
                <span>Weak topics: System Design</span>
              </>
            )}
          </p>
        </div>
      </div>
      
      <div className="text-right">
        {quiz.score !== undefined ? (
          <div>
            <div className={`text-2xl font-bold ${quiz.score >= 80 ? 'text-primary' : 'text-warning'}`}>
              {quiz.score}%
            </div>
            <div className="text-xs text-secondary-text">Latest Score</div>
          </div>
        ) : (
          <button className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90">
            Start Quiz
          </button>
        )}
      </div>
    </Card>
  );
}
