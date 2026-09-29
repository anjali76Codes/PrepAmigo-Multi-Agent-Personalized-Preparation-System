import type { Skill } from '../../data/mockData';
import { Card } from '../ui/Card';

export function SkillLevelBars({ skills, velocity }: { skills: Skill[], velocity: string }) {
  return (
    <Card variant="default" className="p-6">
      <div className="flex justify-between items-start mb-6">
        <h3 className="text-lg font-bold text-carbon-900">Skill Levels</h3>
        <span className="text-xs font-medium bg-navy-100 text-forest-700 px-3 py-1 rounded-full">
          Velocity: {velocity}
        </span>
      </div>
      
      <div className="space-y-5">
        {skills.map(skill => (
          <div key={skill.name}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-carbon-900">{skill.name}</span>
              <span className="text-xs text-carbon-500">{skill.level}/100</span>
            </div>
            <div className="h-2 bg-bg rounded-full overflow-hidden border border-border">
              <div 
                className="h-full bg-forest-700 rounded-full transition-all duration-1000"
                style={{ width: `${skill.level}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
