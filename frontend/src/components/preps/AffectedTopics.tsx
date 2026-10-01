import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

interface AffectedTopicsProps {
  topics: string[];
}

export function AffectedTopics({ topics }: AffectedTopicsProps) {
  if (!topics || topics.length === 0) return null;

  return (
    <Card variant="default" className="p-4 bg-beige-100 border-beige-600/20">
      <h4 className="text-sm font-semibold text-beige-600 flex items-center gap-2 mb-3">
        <Icon name="alert-circle-outline" />
        Topics Affected by Plan Change
      </h4>
      <div className="flex flex-wrap gap-2">
        {topics.map(topic => (
          <span key={topic} className="text-xs px-2 py-1 bg-beige-100 text-beige-600 rounded-control border border-beige-600/20">
            {topic}
          </span>
        ))}
      </div>
    </Card>
  );
}
