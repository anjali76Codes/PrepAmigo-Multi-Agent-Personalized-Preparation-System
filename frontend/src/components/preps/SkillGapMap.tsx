import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import type { SkillGap, Skill } from '../../data/mockData';
import { AffectedTopics } from './AffectedTopics';

interface SkillGapMapProps {
  gaps: SkillGap[];
  skills: Skill[];
}

export function SkillGapMap({ gaps }: SkillGapMapProps) {
  // severity colors (forest = strong, navy = moderate, amber = high-priority gap)
  const getSeverity = (impact: number) => {
    if (impact >= 80) return 'text-[var(--color-amber-600)] bg-[var(--color-amber-600)]/10 border-warning/20'; // high-priority
    if (impact >= 50) return 'text-[var(--color-forest-700)] bg-[var(--color-navy-900)]/10 border-primary/20'; // moderate (navy)
    return 'text-[var(--color-forest-700)] bg-[var(--color-forest-700)]/10 border-accent/20'; // strong (forest)
  };

  return (
    <Card className="p-6 bg-[var(--color-surface)] border-[var(--color-border)]">
      <h3 className="text-lg font-semibold mb-6 text-[var(--color-forest-700)]-text flex items-center gap-2">
        <Icon name="git-network-outline" className="text-[var(--color-forest-700)]" />
        Topic Dependency & Skill Gaps
      </h3>
      
      <div className="space-y-4 relative">
        {gaps.map((gap, index) => (
          <div key={gap.id} className="relative flex items-start gap-4">
            {index !== gaps.length - 1 && (
              <div className="absolute left-[19px] top-10 bottom-[-20px] w-px bg-border z-0" />
            )}
            
            <div className={`relative z-10 w-10 h-10 rounded-[var(--radius-card)] border flex items-center justify-center shrink-0 ${getSeverity(gap.impactScore)}`}>
              <Icon name="warning-outline" className="text-lg" />
            </div>
            
            <div className="flex-1 pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-[var(--color-forest-700)]-text">{gap.skill}</h4>
                  <p className="text-xs text-[var(--color-navy-500)] mt-1">{gap.hoursAllocated} hours allocated</p>
                </div>
                <div className="text-xs font-bold px-2 py-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-control)] text-[var(--color-forest-700)]-text">
                  Impact: {gap.impactScore}
                </div>
              </div>
              <div className="mt-4">
                <AffectedTopics topics={[gap.skill]} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
