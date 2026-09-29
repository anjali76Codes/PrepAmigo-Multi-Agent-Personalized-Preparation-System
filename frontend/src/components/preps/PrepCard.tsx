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
      variant="default"
      className="p-6 cursor-pointer hover:-translate-y-1 hover:shadow-pop transition-all group"
      onClick={() => onClick(prep.id)}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-carbon-900 group-hover:text-forest-700 transition-colors">{learningContext.companyInfo.name}</h3>
          <p className="text-carbon-500">{learningContext.targetRole}</p>
        </div>
        <div className="bg-navy-100 text-forest-700 px-3 py-1 rounded-full text-sm font-medium">
          {durationDays} Days Left
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mt-6">
        <div className="bg-bg rounded-card p-3 border border-border">
          <div className="text-xs text-carbon-500 mb-1">Readiness</div>
          <div className="font-semibold text-carbon-900 flex items-center gap-2">
            <Icon name="bar-chart-outline" className="text-forest-700" />
            {Math.min(readiness, 100)}%
          </div>
        </div>
        <div className="bg-bg rounded-card p-3 border border-border">
          <div className="text-xs text-carbon-500 mb-1">Top Gap</div>
          <div className="font-semibold text-carbon-900 flex items-center gap-2">
            <Icon name="warning-outline" className="text-amber-600" />
            <span className="truncate">{topGap}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
