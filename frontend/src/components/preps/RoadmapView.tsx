import type { Roadmap } from '../../data/mockData';
import { SprintTimeline } from './SprintTimeline';

interface RoadmapViewProps {
  roadmap: Roadmap;
}

export function RoadmapView({ roadmap }: RoadmapViewProps) {
  if (!roadmap || roadmap.sprints.length === 0) {
    return (
      <div className="p-8 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)]">
        <p className="text-[var(--color-navy-500)]">No roadmap available for this prep.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SprintTimeline sprints={roadmap.sprints} />
    </div>
  );
}
