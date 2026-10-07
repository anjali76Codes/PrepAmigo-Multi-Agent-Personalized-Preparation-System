import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import type { TrophyItem } from '../../lib/gamification';
import { cn } from '../../utils/utils';

const TIER_STYLES: Record<TrophyItem['tier'], { bg: string; border: string; text: string; iconBg: string }> = {
  bronze: {
    bg: 'bg-amber-50/70',
    border: 'border-amber-300',
    text: 'text-amber-800',
    iconBg: 'bg-amber-200 text-amber-900',
  },
  silver: {
    bg: 'bg-slate-50/80',
    border: 'border-slate-300',
    text: 'text-slate-800',
    iconBg: 'bg-slate-200 text-slate-900',
  },
  gold: {
    bg: 'bg-yellow-50/80',
    border: 'border-yellow-400',
    text: 'text-yellow-900',
    iconBg: 'bg-yellow-300 text-yellow-950',
  },
  platinum: {
    bg: 'bg-cyan-50/80',
    border: 'border-cyan-300',
    text: 'text-cyan-900',
    iconBg: 'bg-cyan-200 text-cyan-950',
  },
  diamond: {
    bg: 'bg-purple-50/80',
    border: 'border-purple-300',
    text: 'text-purple-900',
    iconBg: 'bg-purple-200 text-purple-950',
  },
};

export function TrophyGrid({ trophies }: { trophies: TrophyItem[] }) {
  return (
    <Card variant="default" className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-carbon-900 flex items-center gap-2">
            <Icon name="trophy" className="text-yellow-500" />
            Sprint Trophies
          </h3>
          <p className="text-xs text-carbon-500 mt-0.5">
            Earned for conquering full preparation sprints & roadmap milestones
          </p>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-lavender-100 text-chrome">
          {trophies.filter((t) => t.unlocked).length} / {trophies.length} Unlocked
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {trophies.map((trophy) => {
          const tierStyle = TIER_STYLES[trophy.tier] || TIER_STYLES.bronze;
          return (
            <div
              key={trophy.id}
              className={cn(
                'relative p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between gap-3',
                trophy.unlocked
                  ? `${tierStyle.bg} ${tierStyle.border} shadow-sm hover:scale-[1.02]`
                  : 'bg-bg border-border opacity-60 grayscale'
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-2xl shadow-inner',
                    trophy.unlocked ? tierStyle.iconBg : 'bg-surface-muted text-carbon-400'
                  )}
                >
                  <Icon name={trophy.unlocked ? trophy.icon : 'lock-closed-outline'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded bg-black/5 text-carbon-700">
                      {trophy.tier}
                    </span>
                    {trophy.unlocked && (
                      <span className="text-[10px] text-green-700 font-bold flex items-center gap-0.5">
                        <Icon name="checkmark-circle" className="text-xs" /> Unlocked
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-sm text-carbon-900 mt-1 leading-tight truncate">
                    {trophy.name}
                  </h4>
                  <p className="text-xs text-carbon-500 mt-1 line-clamp-2">
                    {trophy.description}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-black/5 flex items-center justify-between text-[11px] font-semibold text-carbon-600">
                <span>Goal: {trophy.requirement}</span>
                {trophy.unlocked ? (
                  <span className="text-green-600 font-bold">Earned</span>
                ) : (
                  <span className="text-carbon-400 font-medium">Locked</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
