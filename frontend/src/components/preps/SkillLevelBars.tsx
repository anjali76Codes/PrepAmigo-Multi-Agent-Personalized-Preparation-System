import type { Skill } from '../../data/mockData';
import { Card } from '../ui/Card';

export function SkillLevelBars({ skills, velocity }: { skills: Skill[], velocity: string }) {
  return (
    <Card className="p-6 bg-[var(--color-surface)] border-[var(--color-border)]">
      <div className="flex justify-between items-start mb-6">
        <h3 className="text-lg font-bold text-[var(--color-forest-700)]-text">Skill Levels</h3>
        <span className="text-xs font-medium bg-[var(--color-navy-900)]/10 text-[var(--color-forest-700)] px-3 py-1 rounded-full">
          Velocity: {velocity}
        </span>
      </div>
      
      <div className="space-y-5">
        {skills.map(skill => (
          <div key={skill.name}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-[var(--color-forest-700)]-text">{skill.name}</span>
              <span className="text-xs text-[var(--color-navy-500)]">{skill.level}/100</span>
            </div>
            <div className="h-2 bg-[var(--color-bg)] rounded-full overflow-hidden border border-[var(--color-border)]">
              <div 
                className="h-full bg-[var(--color-navy-900)] rounded-full transition-all duration-1000"
                style={{ width: `${skill.level}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
