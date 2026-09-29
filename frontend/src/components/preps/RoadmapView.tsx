import type { Roadmap } from '../../data/mockData';
import { SprintTimeline } from './SprintTimeline';

interface RoadmapViewProps {
  roadmap: Roadmap;
}

export function RoadmapView({ roadmap }: RoadmapViewProps) {
  if (!roadmap || roadmap.sprints.length === 0) {
    return (
      <div className="p-8 text-center bg-surface border border-border rounded-2xl">
        <p className="text-secondary-text">No roadmap available for this prep.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SprintTimeline sprints={roadmap.sprints} />
    </div>
  );
}
