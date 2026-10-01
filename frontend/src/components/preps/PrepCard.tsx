import { Icon } from '../ui/Icon';
import type { Prep } from '../../data/mockData';

interface PrepCardProps {
  prep: Prep;
  onClick: (id: string) => void;
}

export function PrepCard({ prep, onClick }: PrepCardProps) {
  const { learningContext, durationDays } = prep;
  const progressPct = Math.round((learningContext.progress.xp / (durationDays * 100)) * 100);
  const topGap = learningContext.knowledgeGaps.sort((a, b) => b.impactScore - a.impactScore)[0]?.skill || 'None';

  return (
    <div
      className="bg-lavender-50 rounded-[2rem] p-8 cursor-pointer hover:-translate-y-1 hover:shadow-pop transition-all group border border-border"
      onClick={() => onClick(prep.id)}
    >
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-2xl font-bold text-carbon-900 group-hover:text-chrome transition-colors">{learningContext.companyInfo.name}</h3>
          <p className="text-carbon-500 font-medium">{learningContext.targetRole}</p>
        </div>
        <div className="bg-navy-500 text-chrome px-4 py-1.5 rounded-full text-sm font-bold">
          {durationDays} Days Left
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-8">
        <div className="bg-lavender-100 rounded-2xl p-4">
          <div className="text-xs font-bold text-carbon-500 mb-2 uppercase tracking-wider">Progress</div>
          <div className="font-extrabold text-2xl text-carbon-900 flex items-center gap-2">
            <Icon name="bar-chart" className="text-navy-500 text-xl" />
            {Math.min(progressPct, 100)}%
          </div>
        </div>
        <div className="bg-surface-muted rounded-2xl p-4">
          <div className="text-xs font-bold text-carbon-500 mb-2 uppercase tracking-wider">Top Gap</div>
          <div className="font-extrabold text-lg text-carbon-900 flex items-center gap-2">
            <Icon name="warning" className="text-beige-500 text-xl" />
            <span className="truncate">{topGap}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
