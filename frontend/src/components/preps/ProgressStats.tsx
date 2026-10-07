import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

interface ProgressStatsProps {
  stats: {
    xp: number;
    aiCredits?: number;
    level: number;
    streak: number;
    badges: any[];
    completedSprints?: number;
    totalSprints?: number;
    nextLevelXp?: number;
  };
}

export function ProgressStats({ stats }: ProgressStatsProps) {
  const levelProgress = ((stats.xp % 1000) / 1000) * 100;
  const aiCredits = stats.aiCredits ?? Math.floor(stats.xp / 10);
  const nextLevel = stats.nextLevelXp ?? (1000 - (stats.xp % 1000));
  const badgeCount = Array.isArray(stats.badges)
    ? stats.badges.filter((b) => b.unlocked !== false).length
    : 0;

  return (
    <Card variant="default" className="p-6 md:p-8">
      <div className="flex flex-col md:flex-row items-center gap-8">
        {/* Level Ring */}
        <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" className="fill-none stroke-bg stroke-[8]" />
            <circle
              cx="50"
              cy="50"
              r="45"
              className="fill-none stroke-chrome stroke-[8] transition-all duration-1000"
              strokeDasharray="283"
              style={{ strokeDashoffset: 283 - (283 * levelProgress) / 100 }}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-carbon-900">{stats.level}</span>
            <span className="text-[10px] font-bold text-carbon-500 uppercase tracking-widest">
              Level
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-6 w-full">
          <div className="bg-bg/50 p-3.5 rounded-2xl border border-border/60">
            <div className="text-xs font-semibold text-carbon-500 flex items-center gap-1.5 mb-1">
              <Icon name="star" className="text-yellow-500" /> Total XP
            </div>
            <div className="text-2xl font-black text-carbon-900">
              {stats.xp.toLocaleString()}
            </div>
            <span className="text-[10px] text-green-600 font-bold">+20 per topic, +30 per quiz</span>
          </div>

          <div className="bg-bg/50 p-3.5 rounded-2xl border border-border/60">
            <div className="text-xs font-semibold text-carbon-500 flex items-center gap-1.5 mb-1">
              <Icon name="sparkles" className="text-purple-600" /> AI Credits
            </div>
            <div className="text-2xl font-black text-purple-700">
              {aiCredits.toLocaleString()}
            </div>
            <span className="text-[10px] text-purple-600/80 font-medium">10 XP = 1 AI Credit</span>
          </div>

          <div className="bg-bg/50 p-3.5 rounded-2xl border border-border/60">
            <div className="text-xs font-semibold text-carbon-500 flex items-center gap-1.5 mb-1">
              <Icon name="flame" className="text-amber-500" /> Day Streak
            </div>
            <div className="text-2xl font-black text-carbon-900">{stats.streak}</div>
            <span className="text-[10px] text-amber-600 font-bold">
              {stats.streak > 0 ? "🔥 Streak Active" : "Start today's topic"}
            </span>
          </div>

          <div className="bg-bg/50 p-3.5 rounded-2xl border border-border/60">
            <div className="text-xs font-semibold text-carbon-500 flex items-center gap-1.5 mb-1">
              <Icon name="medal-outline" className="text-chrome" /> Badges Earned
            </div>
            <div className="text-2xl font-black text-carbon-900">{badgeCount}</div>
            <span className="text-[10px] text-carbon-500 font-medium">
              Next level in {nextLevel} XP
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
