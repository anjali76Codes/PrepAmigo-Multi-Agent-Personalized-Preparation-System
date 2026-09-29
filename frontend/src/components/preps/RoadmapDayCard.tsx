import type { RoadmapDay } from '../../data/mockData';
import { Icon } from '../ui/Icon';

interface RoadmapDayCardProps {
  day: RoadmapDay;
}

export function RoadmapDayCard({ day }: RoadmapDayCardProps) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg)] hover:border-primary/30 transition-colors">
      <div className="flex flex-col items-center justify-center bg-[var(--color-navy-900)]/5 border border-primary/10 rounded-[var(--radius-control)] w-12 h-12 shrink-0">
        <span className="text-xs text-[var(--color-navy-500)]">Day</span>
        <span className="font-bold text-[var(--color-forest-700)]-text">{day.dayNumber}</span>
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <h4 className="font-semibold text-[var(--color-forest-700)]-text">{day.topic}</h4>
          <span className={`text-xs px-2 py-1 rounded-[var(--radius-control)] border ${
            day.status === 'done' ? 'bg-[var(--color-forest-700)]/10 text-[var(--color-forest-700)] border-accent/20' :
            day.status === 'today' ? 'bg-[var(--color-navy-900)]/10 text-[var(--color-forest-700)] border-primary/20' :
            day.status === 'missed' || day.status === 'rescheduled' ? 'bg-[var(--color-amber-600)]/10 text-[var(--color-amber-600)] border-warning/20' :
            'bg-border/50 text-[var(--color-navy-500)] border-[var(--color-border)]'
          }`}>
            {day.status}
          </span>
        </div>
        <p className="text-sm text-[var(--color-navy-500)] mt-1">{day.objective}</p>
        
        <div className="flex flex-wrap gap-2 mt-3">
          <div className="text-xs text-[var(--color-navy-500)] flex items-center gap-1 bg-[var(--color-surface)] px-2 py-1 rounded border border-[var(--color-border)]">
            <Icon name="time-outline" /> {day.estimatedMinutes}m
          </div>
          {day.references.map((ref, idx) => (
            <div key={idx} className="text-xs text-[var(--color-forest-700)] flex items-center gap-1 bg-[var(--color-navy-900)]/5 px-2 py-1 rounded border border-primary/10">
              <Icon name="link-outline" /> {ref}
            </div>
          ))}
        </div>

        {day.practiceTask && (
          <div className="mt-3 text-xs bg-[var(--color-surface)] text-[var(--color-forest-700)]-text px-3 py-2 rounded-[var(--radius-control)] border border-[var(--color-border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="code-working-outline" className="text-[var(--color-forest-700)]" />
              <span className="font-medium">Task:</span> {day.practiceTask.title}
            </div>
            <span className="capitalize text-[var(--color-navy-500)]">{day.practiceTask.status}</span>
          </div>
        )}
      </div>
    </div>
  );
}
