import type { RoadmapDay } from '../../data/mockData';
import { Icon } from '../ui/Icon';

interface RoadmapDayCardProps {
  day: RoadmapDay;
}

export function RoadmapDayCard({ day }: RoadmapDayCardProps) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl border border-border bg-background hover:border-primary/30 transition-colors">
      <div className="flex flex-col items-center justify-center bg-primary/5 border border-primary/10 rounded-lg w-12 h-12 shrink-0">
        <span className="text-xs text-secondary-text">Day</span>
        <span className="font-bold text-primary-text">{day.dayNumber}</span>
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <h4 className="font-semibold text-primary-text">{day.topic}</h4>
          <span className={`text-xs px-2 py-1 rounded-md border ${
            day.status === 'done' ? 'bg-accent/10 text-accent border-accent/20' :
            day.status === 'today' ? 'bg-primary/10 text-primary border-primary/20' :
            day.status === 'missed' || day.status === 'rescheduled' ? 'bg-warning/10 text-warning border-warning/20' :
            'bg-border/50 text-secondary-text border-border'
          }`}>
            {day.status}
          </span>
        </div>
        <p className="text-sm text-secondary-text mt-1">{day.objective}</p>
        
        <div className="flex flex-wrap gap-2 mt-3">
          <div className="text-xs text-secondary-text flex items-center gap-1 bg-surface px-2 py-1 rounded border border-border">
            <Icon name="time-outline" /> {day.estimatedMinutes}m
          </div>
          {day.references.map((ref, idx) => (
            <div key={idx} className="text-xs text-primary flex items-center gap-1 bg-primary/5 px-2 py-1 rounded border border-primary/10">
              <Icon name="link-outline" /> {ref}
            </div>
          ))}
        </div>

        {day.practiceTask && (
          <div className="mt-3 text-xs bg-surface text-primary-text px-3 py-2 rounded-lg border border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="code-working-outline" className="text-primary" />
              <span className="font-medium">Task:</span> {day.practiceTask.title}
            </div>
            <span className="capitalize text-secondary-text">{day.practiceTask.status}</span>
          </div>
        )}
      </div>
    </div>
  );
}
