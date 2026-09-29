import { Card } from '../ui/Card';
import type { Assessment } from '../../data/mockData';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';

export function PracticeItem({ item }: { item: Assessment }) {
  return (
    <Card className="p-6 bg-surface border-border flex justify-between items-center group hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-primary/10 text-primary">
          <Icon name={item.type === 'coding' ? 'code-slash-outline' : 'people-outline'} className="text-2xl" />
        </div>
        <div>
          <h4 className="font-semibold text-lg text-primary-text">{item.title}</h4>
          <p className="text-sm text-secondary-text mt-1 capitalize">{item.type.replace('-', ' ')} • Status: {item.status}</p>
        </div>
      </div>
      
      <div className="text-right">
        {item.score !== undefined ? (
          <div>
            <div className="text-2xl font-bold text-primary">{item.score}%</div>
            <div className="text-xs text-secondary-text">Score</div>
          </div>
        ) : (
          <Button>Start</Button>
        )}
      </div>
    </Card>
  );
}
