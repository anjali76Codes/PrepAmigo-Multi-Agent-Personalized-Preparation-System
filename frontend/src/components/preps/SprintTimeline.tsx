import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { Badge } from '../ui/Badge';
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
        <Card key={sprint.id} variant="default" className="p-6 overflow-hidden relative">
          {sprint.focus.includes('Reprioritized') && (
            <div className="absolute top-4 right-4">
              <Badge variant="warning" className="flex items-center gap-1">
                <Icon name="warning-outline" /> Reprioritized
              </Badge>
            </div>
          )}
          
          <h3 className="text-xl font-bold text-carbon-900 mb-1">{sprint.title}</h3>
          <p className="text-carbon-500 text-sm mb-6">{sprint.focus}</p>

          <div className="space-y-4">
            {sprint.days.map(day => (
              <RoadmapDayCard key={day.dayNumber} day={day} />
            ))}
          </div>

          <div className="mt-6 border-t border-border pt-6">
            <RevisionCycles sprintId={sprint.id} />
          </div>
        </Card>
      ))}
    </div>
  );
}
