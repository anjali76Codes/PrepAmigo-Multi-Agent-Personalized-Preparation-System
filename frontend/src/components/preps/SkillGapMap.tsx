import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import type { SkillGap, Skill } from '../../data/mockData';

interface SkillGapMapProps {
  gaps: SkillGap[];
  skills: Skill[];
}

export function SkillGapMap({ gaps }: SkillGapMapProps) {
  // severity colors (forest = strong, navy = moderate, amber = high-priority gap)
  const getSeverity = (impact: number) => {
    if (impact >= 80) return 'text-warning bg-warning/10 border-warning/20'; // high-priority
    if (impact >= 50) return 'text-primary bg-primary/10 border-primary/20'; // moderate (navy)
    return 'text-accent bg-accent/10 border-accent/20'; // strong (forest)
  };

  return (
    <Card className="p-6 bg-surface border-border">
      <h3 className="text-lg font-semibold mb-6 text-primary-text flex items-center gap-2">
        <Icon name="git-network-outline" className="text-primary" />
        Topic Dependency & Skill Gaps
      </h3>
      
      <div className="space-y-4 relative">
        {gaps.map((gap, index) => (
          <div key={gap.id} className="relative flex items-start gap-4">
            {index !== gaps.length - 1 && (
              <div className="absolute left-[19px] top-10 bottom-[-20px] w-px bg-border z-0" />
            )}
            
            <div className={`relative z-10 w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${getSeverity(gap.impactScore)}`}>
              <Icon name="warning-outline" className="text-lg" />
            </div>
            
            <div className="flex-1 pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-primary-text">{gap.skill}</h4>
                  <p className="text-xs text-secondary-text mt-1">{gap.hoursAllocated} hours allocated</p>
                </div>
                <div className="text-xs font-bold px-2 py-1 bg-background border border-border rounded-md text-primary-text">
                  Impact: {gap.impactScore}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
