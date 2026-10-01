import { Icon } from '../ui/Icon';
import type { LearningContext } from '../../data/mockData';

interface PrepOverviewProps {
  context: LearningContext;
}

export function PrepOverview({ context }: PrepOverviewProps) {
  const { companyInfo, jobRequirements, interviewPatterns } = context;

  return (
    <div className="space-y-6">
      <div className="bg-lavender-100 rounded-[2rem] p-8 border border-lavender-200">
        <h3 className="text-2xl font-bold mb-4 text-lavender-900 flex items-center gap-3">
          <Icon name="business" className="text-lavender-700" />
          Company Snapshot
        </h3>
        <p className="text-lavender-800/80 mb-6 font-medium text-lg">{companyInfo.description}</p>
        <div className="flex flex-wrap gap-2">
          {companyInfo.culture.map((c, i) => (
            <span key={i} className="px-4 py-1.5 bg-white/50 border border-lavender-200/50 rounded-full text-sm font-bold text-lavender-900">
              {c}
            </span>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-lavender-100 rounded-[2rem] p-8 shadow-pop border border-chrome-border">
          <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <Icon name="list" className="text-chrome" />
            Job Requirements
          </h3>
          <ul className="space-y-4">
            {jobRequirements.map(req => (
              <li key={req.id} className="flex items-start gap-4 text-sm bg-chrome-accent rounded-xl p-4 border border-white/10">
                <Icon name="checkmark-circle" className="text-navy-800 text-2xl shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-lg text-chrome mb-1">{req.skill}</div>
                  <div className="text-xs text-navy-900 font-medium uppercase">{req.importance} • {req.category}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-surface rounded-[2rem] p-8 border border-border">
          <h3 className="text-2xl font-bold mb-6 text-carbon-900 flex items-center gap-3">
            <Icon name="git-merge" className="text-navy-500" />
            Interview Patterns
          </h3>
          <ul className="space-y-4">
            {interviewPatterns.map((pat, i) => (
              <li key={i} className="flex gap-4 items-start bg-bg rounded-xl p-4 border border-border/50">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-navy-100 flex items-center justify-center text-navy-700 font-extrabold text-sm shadow-sm">
                  {i + 1}
                </div>
                <div>
                  <div className="font-bold text-lg text-carbon-900 mb-1 leading-tight">{pat.round}</div>
                  <div className="text-sm text-carbon-500 font-medium">{pat.focus}</div>
                  <div className="text-xs text-navy-700 font-bold uppercase tracking-widest mt-2">{pat.format}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
