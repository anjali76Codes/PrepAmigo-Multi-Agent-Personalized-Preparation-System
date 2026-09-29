import type { Roadmap } from '../../data/mockData';
import { SprintTimeline } from './SprintTimeline';
import { Card } from '../ui/Card';

interface RoadmapViewProps {
  roadmap: Roadmap;
}

export function RoadmapView({ roadmap }: RoadmapViewProps) {
  if (!roadmap || roadmap.sprints.length === 0) {
    return (
      <Card variant="default" className="p-8 text-center">
        <p className="text-carbon-500">No roadmap available for this prep.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <SprintTimeline sprints={roadmap.sprints} />
    </div>
  );
}
