import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import type { Prep } from '../../data/mockData';

interface PrepCardProps {
  prep: Prep;
  onClick: (id: string) => void;
}

export function PrepCard({ prep, onClick }: PrepCardProps) {
  const { learningContext, durationDays } = prep;
  const readiness = Math.round((learningContext.progress.xp / (durationDays * 100)) * 100);
  const topGap = learningContext.knowledgeGaps.sort((a, b) => b.impactScore - a.impactScore)[0]?.skill || 'None';

  return (
    <Card 
      className="p-6 cursor-pointer hover:shadow-lg transition-all border border-border bg-surface hover:bg-elevated"
      onClick={() => onClick(prep.id)}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-primary-text">{learningContext.companyInfo.name}</h3>
          <p className="text-secondary-text">{learningContext.targetRole}</p>
        </div>
        <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
          {durationDays} Days Left
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mt-6">
        <div className="bg-background rounded-xl p-3 border border-border">
          <div className="text-xs text-secondary-text mb-1">Readiness</div>
          <div className="font-semibold text-primary-text flex items-center gap-2">
            <Icon name="bar-chart-outline" className="text-accent" />
            {Math.min(readiness, 100)}%
          </div>
        </div>
        <div className="bg-background rounded-xl p-3 border border-border">
          <div className="text-xs text-secondary-text mb-1">Top Gap</div>
          <div className="font-semibold text-primary-text flex items-center gap-2">
            <Icon name="warning-outline" className="text-warning" />
            <span className="truncate">{topGap}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
