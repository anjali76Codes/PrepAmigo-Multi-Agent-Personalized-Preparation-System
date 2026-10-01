import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import type { SkillGap, Skill } from '../../data/mockData';
import { AffectedTopics } from './AffectedTopics';

interface SkillGapMapProps {
  gaps: SkillGap[];
  skills: Skill[];
}

export function SkillGapMap({ gaps }: SkillGapMapProps) {
  const getSeverity = (impact: number) => {
    if (impact >= 80) return 'text-warning-600 bg-warning-100 border-warning-600/20'; // high-priority
    if (impact >= 50) return 'text-chrome bg-lavender-100 border-chrome-border/20'; // moderate
    return 'text-chrome bg-lavender-100 border-chrome-border/20'; // strong
  };

  return (
    <Card variant="default" className="p-6">
      <h3 className="text-lg font-semibold mb-6 text-carbon-900 flex items-center gap-2">
        <Icon name="git-network-outline" className="text-chrome" />
        Topic Dependency & Skill Gaps
      </h3>
      
      <div className="space-y-4 relative">
        {gaps.map((gap, index) => (
          <div key={gap.id} className="relative flex items-start gap-4">
            {index !== gaps.length - 1 && (
              <div className="absolute left-[19px] top-10 bottom-[-20px] w-px bg-border z-0" />
            )}
            
            <div className={`relative z-10 w-10 h-10 rounded-card border flex items-center justify-center shrink-0 ${getSeverity(gap.impactScore)}`}>
              <Icon name="warning-outline" className="text-lg" />
            </div>
            
            <div className="flex-1 pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-carbon-900">{gap.skill}</h4>
                  <p className="text-xs text-carbon-500 mt-1">{gap.hoursAllocated} hours allocated</p>
                </div>
                <div className="text-xs font-bold px-2 py-1 bg-bg border border-border rounded-control text-carbon-900">
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
