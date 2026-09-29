import type { ProgressStats as ProgressStatsType } from '../../data/mockData';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

export function ProgressStats({ stats }: { stats: ProgressStatsType }) {
  const levelProgress = (stats.xp % 1000) / 1000 * 100; // Mock math: 1000 XP per level

  return (
    <Card className="p-6 bg-[var(--color-surface)] border-[var(--color-border)]">
      <div className="flex flex-col md:flex-row items-center gap-8">
        <div className="relative w-32 h-32 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" className="fill-none stroke-background stroke-[8]" />
            <circle 
              cx="50" cy="50" r="45" 
              className="fill-none stroke-primary stroke-[8] stroke-dasharray-[283] transition-all duration-1000"
              style={{ strokeDashoffset: 283 - (283 * levelProgress) / 100 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-[var(--color-forest-700)]-text">{stats.level}</span>
            <span className="text-xs text-[var(--color-navy-500)] uppercase tracking-wider">Level</span>
          </div>
        </div>
        
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-6 w-full">
          <div>
            <div className="text-sm text-[var(--color-navy-500)] flex items-center gap-1 mb-1">
              <Icon name="star" className="text-[var(--color-forest-700)]" /> Total XP
            </div>
            <div className="text-2xl font-bold text-[var(--color-forest-700)]-text">{stats.xp.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-[var(--color-navy-500)] flex items-center gap-1 mb-1">
              <Icon name="flame" className="text-[var(--color-amber-600)]" /> Day Streak
            </div>
            <div className="text-2xl font-bold text-[var(--color-forest-700)]-text">{stats.streak}</div>
          </div>
          <div>
            <div className="text-sm text-[var(--color-navy-500)] flex items-center gap-1 mb-1">
              <Icon name="medal-outline" className="text-[var(--color-forest-700)]" /> Badges
            </div>
            <div className="text-2xl font-bold text-[var(--color-forest-700)]-text">{stats.badges.length}</div>
          </div>
          <div>
            <div className="text-sm text-[var(--color-navy-500)] flex items-center gap-1 mb-1">
              <Icon name="trophy-outline" className="text-[var(--color-forest-700)]" /> Next Level
            </div>
            <div className="text-2xl font-bold text-[var(--color-forest-700)]-text">{1000 - (stats.xp % 1000)} <span className="text-sm text-[var(--color-navy-500)] font-normal">XP</span></div>
          </div>
        </div>
      </div>
    </Card>
  );
}
