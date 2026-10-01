import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

interface AffectedTopicsProps {
  topics: string[];
}

export function AffectedTopics({ topics }: AffectedTopicsProps) {
  if (!topics || topics.length === 0) return null;

  return (
    <Card variant="default" className="p-4 bg-lavender-50 border-chrome-border/20">
      <h4 className="text-sm font-semibold text-chrome flex items-center gap-2 mb-3">
        <Icon name="alert-circle-outline" />
        Topics Affected by Plan Change
      </h4>
      <div className="flex flex-wrap gap-2">
        {topics.map(topic => (
          <span key={topic} className="text-xs px-2 py-1 bg-lavender-100 text-chrome rounded-control border border-chrome-border/20">
            {topic}
          </span>
        ))}
      </div>
    </Card>
  );
}
