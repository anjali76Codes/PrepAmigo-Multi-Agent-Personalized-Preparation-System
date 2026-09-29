import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

interface AffectedTopicsProps {
  topics: string[];
}

export function AffectedTopics({ topics }: AffectedTopicsProps) {
  if (!topics || topics.length === 0) return null;

  return (
    <Card className="p-4 bg-[var(--color-amber-600)]/5 border-warning/20">
      <h4 className="text-sm font-semibold text-[var(--color-amber-600)] flex items-center gap-2 mb-3">
        <Icon name="alert-circle-outline" />
        Topics Affected by Plan Change
      </h4>
      <div className="flex flex-wrap gap-2">
        {topics.map(topic => (
          <span key={topic} className="text-xs px-2 py-1 bg-[var(--color-amber-600)]/10 text-[var(--color-amber-600)] rounded-[var(--radius-control)] border border-warning/20">
            {topic}
          </span>
        ))}
      </div>
    </Card>
  );
}
