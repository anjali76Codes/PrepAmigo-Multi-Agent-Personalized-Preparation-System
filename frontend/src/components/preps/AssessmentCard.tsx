import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

interface AssessmentCardProps {
  item: any;
  type: 'quiz' | 'flashcard';
}

export function AssessmentCard({ item, type }: AssessmentCardProps) {
  return (
    <Card className="p-4 bg-[var(--color-surface)] border-[var(--color-border)] flex justify-between items-center group hover:border-primary/30 transition-colors cursor-pointer">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          type === 'quiz' ? 'bg-[var(--color-forest-700)]/10 text-[var(--color-forest-700)]' : 'bg-[var(--color-navy-900)]/10 text-[var(--color-forest-700)]'
        }`}>
          <Icon name={type === 'quiz' ? 'help-circle-outline' : 'albums-outline'} className="text-xl" />
        </div>
        <div>
          <h4 className="font-semibold text-[var(--color-forest-700)]-text group-hover:text-[var(--color-forest-700)] transition-colors">
            {type === 'quiz' ? item.title : item.topic}
          </h4>
          <p className="text-xs text-[var(--color-navy-500)] mt-1">
            {type === 'quiz' ? `Status: ${item.status}` : `${item.cards?.length || 0} cards`}
          </p>
        </div>
      </div>
      
      <div className="text-right">
        {type === 'quiz' && item.score !== undefined && (
          <div className="text-lg font-bold text-[var(--color-forest-700)]">{item.score}%</div>
        )}
        {type === 'flashcard' && item.dueForRevision && (
          <span className="text-xs bg-[var(--color-amber-600)]/10 text-[var(--color-amber-600)] px-2 py-1 rounded border border-warning/20">
            Due Today
          </span>
        )}
      </div>
    </Card>
  );
}
