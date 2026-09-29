import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import type { Sprint } from '../../data/mockData';
import { RevisionCycles } from './RevisionCycles';
import { RoadmapDayCard } from './RoadmapDayCard';

interface SprintTimelineProps {
  sprints: Sprint[];
}

export function SprintTimeline({ sprints }: SprintTimelineProps) {
  return (
    <div className="space-y-6">
      {sprints.map(sprint => (
        <Card key={sprint.id} className="p-6 bg-[var(--color-surface)] border-[var(--color-border)] overflow-hidden relative">
          {sprint.focus.includes('Reprioritized') && (
            <div className="absolute top-4 right-4 bg-[var(--color-amber-600)]/10 text-[var(--color-amber-600)] text-xs px-2 py-1 rounded border border-warning/20 flex items-center gap-1">
              <Icon name="warning-outline" /> Reprioritized
            </div>
          )}
          
          <h3 className="text-xl font-bold text-[var(--color-forest-700)]-text mb-1">{sprint.title}</h3>
          <p className="text-[var(--color-navy-500)] text-sm mb-6">{sprint.focus}</p>

          <div className="space-y-4">
            {sprint.days.map(day => (
              <RoadmapDayCard key={day.dayNumber} day={day} />
            ))}
          </div>

          <div className="mt-6 border-t border-[var(--color-border)] pt-6">
            <RevisionCycles sprintId={sprint.id} />
          </div>
        </Card>
      ))}
    </div>
  );
}
