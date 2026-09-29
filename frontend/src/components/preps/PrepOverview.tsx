import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import type { LearningContext } from '../../data/mockData';

interface PrepOverviewProps {
  context: LearningContext;
}

export function PrepOverview({ context }: PrepOverviewProps) {
  const { companyInfo, jobRequirements, interviewPatterns } = context;

  return (
    <div className="space-y-6">
      <Card variant="default" className="p-6">
        <h3 className="text-lg font-semibold mb-4 text-carbon-900 flex items-center gap-2">
          <Icon name="business-outline" className="text-forest-700" />
          Company Snapshot
        </h3>
        <p className="text-carbon-500 mb-4">{companyInfo.description}</p>
        <div className="flex flex-wrap gap-2">
          {companyInfo.culture.map((c, i) => (
            <span key={i} className="px-3 py-1 bg-bg border border-border rounded-full text-xs text-carbon-500">
              {c}
            </span>
          ))}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card variant="default" className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-carbon-900 flex items-center gap-2">
            <Icon name="list-outline" className="text-forest-700" />
            Job Requirements
          </h3>
          <ul className="space-y-3">
            {jobRequirements.map(req => (
              <li key={req.id} className="flex items-start gap-3 text-sm">
                <Icon name="checkmark-circle-outline" className="text-forest-700 mt-0.5" />
                <div>
                  <div className="font-medium text-carbon-900">{req.skill}</div>
                  <div className="text-xs text-carbon-500 capitalize">{req.importance} • {req.category}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card variant="default" className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-carbon-900 flex items-center gap-2">
            <Icon name="git-merge-outline" className="text-forest-700" />
            Interview Patterns
          </h3>
          <ul className="space-y-4">
            {interviewPatterns.map((pat, i) => (
              <li key={i} className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-navy-100 flex items-center justify-center text-forest-700 font-bold text-xs">
                  {i + 1}
                </div>
                <div>
                  <div className="font-medium text-carbon-900">{pat.round}</div>
                  <div className="text-sm text-carbon-500">{pat.focus}</div>
                  <div className="text-xs text-forest-700 mt-1">{pat.format}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
