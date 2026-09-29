import type { RoadmapDay } from '../../data/mockData';
import { Icon } from '../ui/Icon';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';

interface RoadmapDayCardProps {
  day: RoadmapDay;
}

export function RoadmapDayCard({ day }: RoadmapDayCardProps) {
  const getStatusVariant = (status: string) => {
    switch(status) {
      case 'done': return 'forest';
      case 'today': return 'navy';
      case 'missed': 
      case 'rescheduled': return 'warning';
      default: return 'default';
    }
  };

  return (
    <Card variant="default" className="flex items-start gap-4 p-4 hover:border-forest-700/30 transition-colors group">
      <div className="flex flex-col items-center justify-center bg-navy-100/50 text-carbon-900 rounded-control w-12 h-12 shrink-0">
        <span className="text-xs text-carbon-500">Day</span>
        <span className="font-bold">{day.dayNumber}</span>
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <h4 className="font-semibold text-carbon-900 group-hover:text-forest-700 transition-colors">{day.topic}</h4>
          <Badge variant={getStatusVariant(day.status) as any}>{day.status}</Badge>
        </div>
        <p className="text-sm text-carbon-500 mt-1">{day.objective}</p>
        
        <div className="flex flex-wrap gap-2 mt-3">
          <div className="text-xs text-carbon-500 flex items-center gap-1 bg-surface px-2 py-1 rounded border border-border">
            <Icon name="time-outline" /> {day.estimatedMinutes}m
          </div>
          {day.references.map((ref, idx) => (
            <div key={idx} className="text-xs text-forest-700 flex items-center gap-1 bg-forest-100/50 px-2 py-1 rounded border border-forest-700/10">
              <Icon name="link-outline" /> {ref}
            </div>
          ))}
        </div>

        {day.practiceTask && (
          <div className="mt-3 text-xs bg-surface text-carbon-900 px-3 py-2 rounded-control border border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="code-working-outline" className="text-forest-700" />
              <span className="font-medium">Task:</span> {day.practiceTask.title}
            </div>
            <span className="capitalize text-carbon-500">{day.practiceTask.status}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
