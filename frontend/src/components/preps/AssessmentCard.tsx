import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

interface AssessmentCardProps {
  item: any;
  type: 'quiz' | 'flashcard';
}

export function AssessmentCard({ item, type }: AssessmentCardProps) {
  return (
    <Card className="p-4 bg-surface border-border flex justify-between items-center group hover:border-primary/30 transition-colors cursor-pointer">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          type === 'quiz' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'
        }`}>
          <Icon name={type === 'quiz' ? 'help-circle-outline' : 'albums-outline'} className="text-xl" />
        </div>
        <div>
          <h4 className="font-semibold text-primary-text group-hover:text-primary transition-colors">
            {type === 'quiz' ? item.title : item.topic}
          </h4>
          <p className="text-xs text-secondary-text mt-1">
            {type === 'quiz' ? `Status: ${item.status}` : `${item.cards?.length || 0} cards`}
          </p>
        </div>
      </div>
      
      <div className="text-right">
        {type === 'quiz' && item.score !== undefined && (
          <div className="text-lg font-bold text-accent">{item.score}%</div>
        )}
        {type === 'flashcard' && item.dueForRevision && (
          <span className="text-xs bg-warning/10 text-warning px-2 py-1 rounded border border-warning/20">
            Due Today
          </span>
        )}
      </div>
    </Card>
  );
}
