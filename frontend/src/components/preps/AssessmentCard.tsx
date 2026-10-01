import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

interface AssessmentCardProps {
  item: any;
  type: 'quiz' | 'flashcard';
}

export function AssessmentCard({ item, type }: AssessmentCardProps) {
  return (
    <Card variant="default" className="p-4 flex justify-between items-center group hover:border-navy-700/30 transition-colors cursor-pointer">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          type === 'quiz' ? 'bg-navy-100 text-navy-700' : 'bg-navy-100 text-navy-700'
        }`}>
          <Icon name={type === 'quiz' ? 'help-circle-outline' : 'albums-outline'} className="text-xl" />
        </div>
        <div>
          <h4 className="font-semibold text-carbon-900 group-hover:text-navy-700 transition-colors">
            {type === 'quiz' ? item.title : item.topic}
          </h4>
          <p className="text-xs text-carbon-500 mt-1">
            {type === 'quiz' ? `Status: ${item.status}` : `${item.cards?.length || 0} cards`}
          </p>
        </div>
      </div>
      
      <div className="text-right">
        {type === 'quiz' && item.score !== undefined && (
          <div className="text-lg font-bold text-navy-700">{item.score}%</div>
        )}
        {type === 'flashcard' && item.dueForRevision && (
          <span className="text-xs bg-beige-100 text-beige-600 px-2 py-1 rounded border border-beige-600/20">
            Due Today
          </span>
        )}
      </div>
    </Card>
  );
}
