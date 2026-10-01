import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

interface AssessmentCardProps {
  item: any;
  type: 'quiz' | 'flashcard';
}

export function AssessmentCard({ item, type }: AssessmentCardProps) {
  return (
    <Card variant="default" className="p-4 flex justify-between items-center group hover:border-chrome-border/30 transition-colors cursor-pointer">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          type === 'quiz' ? 'bg-lavender-100 text-chrome' : 'bg-lavender-100 text-chrome'
        }`}>
          <Icon name={type === 'quiz' ? 'help-circle-outline' : 'albums-outline'} className="text-xl" />
        </div>
        <div>
          <h4 className="font-semibold text-carbon-900 group-hover:text-chrome transition-colors">
            {type === 'quiz' ? item.title : item.topic}
          </h4>
          <p className="text-xs text-carbon-500 mt-1">
            {type === 'quiz' ? `Status: ${item.status}` : `${item.cards?.length || 0} cards`}
          </p>
        </div>
      </div>
      
      <div className="text-right">
        {type === 'quiz' && item.score !== undefined && (
          <div className="text-lg font-bold text-chrome">{item.score}%</div>
        )}
        {type === 'flashcard' && item.dueForRevision && (
          <span className="text-xs bg-lavender-100 text-chrome px-2 py-1 rounded border border-chrome-border/20">
            Due Today
          </span>
        )}
      </div>
    </Card>
  );
}
