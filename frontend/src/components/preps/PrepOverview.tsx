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
      <Card className="p-6 bg-[var(--color-surface)] border-[var(--color-border)]">
        <h3 className="text-lg font-semibold mb-4 text-[var(--color-forest-700)]-text flex items-center gap-2">
          <Icon name="business-outline" className="text-[var(--color-forest-700)]" />
          Company Snapshot
        </h3>
        <p className="text-[var(--color-navy-500)] mb-4">{companyInfo.description}</p>
        <div className="flex flex-wrap gap-2">
          {companyInfo.culture.map((c, i) => (
            <span key={i} className="px-3 py-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-full text-xs text-[var(--color-navy-500)]">
              {c}
            </span>
          ))}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6 bg-[var(--color-surface)] border-[var(--color-border)]">
          <h3 className="text-lg font-semibold mb-4 text-[var(--color-forest-700)]-text flex items-center gap-2">
            <Icon name="list-outline" className="text-[var(--color-forest-700)]" />
            Job Requirements
          </h3>
          <ul className="space-y-3">
            {jobRequirements.map(req => (
              <li key={req.id} className="flex items-start gap-3 text-sm">
                <Icon name="checkmark-circle-outline" className="text-[var(--color-forest-700)] mt-0.5" />
                <div>
                  <div className="font-medium text-[var(--color-forest-700)]-text">{req.skill}</div>
                  <div className="text-xs text-[var(--color-navy-500)] capitalize">{req.importance} • {req.category}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-6 bg-[var(--color-surface)] border-[var(--color-border)]">
          <h3 className="text-lg font-semibold mb-4 text-[var(--color-forest-700)]-text flex items-center gap-2">
            <Icon name="git-merge-outline" className="text-[var(--color-forest-700)]" />
            Interview Patterns
          </h3>
          <ul className="space-y-4">
            {interviewPatterns.map((pat, i) => (
              <li key={i} className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--color-navy-900)]/10 flex items-center justify-center text-[var(--color-forest-700)] font-bold text-xs">
                  {i + 1}
                </div>
                <div>
                  <div className="font-medium text-[var(--color-forest-700)]-text">{pat.round}</div>
                  <div className="text-sm text-[var(--color-navy-500)]">{pat.focus}</div>
                  <div className="text-xs text-[var(--color-forest-700)] mt-1">{pat.format}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
