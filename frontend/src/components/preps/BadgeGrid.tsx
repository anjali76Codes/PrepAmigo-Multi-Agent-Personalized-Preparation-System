import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import type { BadgeItem } from '../../lib/gamification';
import { cn } from '../../utils/utils';

export function BadgeGrid({ badges }: { badges: BadgeItem[] }) {
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <Card variant="default" className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-carbon-900 flex items-center gap-2">
            <Icon name="medal-outline" className="text-chrome" />
            Badges & Achievements
          </h3>
          <p className="text-xs text-carbon-500 mt-0.5">
            Special recognitions for consistency and milestones
          </p>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-lavender-100 text-chrome">
          {unlockedCount} / {badges.length} Badges
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {badges.map((badge) => (
          <div
            key={badge.id}
            className={cn(
              'flex flex-col items-center text-center p-4 rounded-2xl border transition-all duration-200',
              badge.unlocked
                ? 'bg-white border-border shadow-xs hover:border-chrome/50 hover:shadow-sm'
                : 'bg-bg/80 border-border/60 opacity-50 grayscale'
            )}
          >
            <div
              className={cn(
                'w-14 h-14 rounded-2xl flex items-center justify-center mb-2 text-2xl transition-transform',
                badge.unlocked
                  ? 'bg-lavender-100 text-chrome shadow-xs'
                  : 'bg-surface-muted text-carbon-400'
              )}
            >
              <Icon name={badge.unlocked ? badge.icon : 'lock-closed-outline'} />
            </div>
            <span className="text-xs font-bold text-carbon-900 line-clamp-1">
              {badge.name}
            </span>
            <span className="text-[10px] text-carbon-500 mt-1 line-clamp-2 leading-tight">
              {badge.description}
            </span>
            <div className="mt-2 pt-1.5 border-t border-border/50 w-full">
              <span
                className={cn(
                  'text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block',
                  badge.unlocked
                    ? 'bg-green-100 text-green-800'
                    : 'bg-surface-muted text-carbon-500'
                )}
              >
                {badge.unlocked ? 'Unlocked' : badge.requirement}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
