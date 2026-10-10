import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Logo } from '../ui/Logo';

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

  const badgeCount = Array.isArray(stats.badges)
    ? stats.badges.filter((b) => b.unlocked !== false).length
    : 0;

  return (
    <Card
      variant="default"
      className="p-5 md:p-6 rounded-3xl"
    >
      <div className="flex flex-col lg:flex-row gap-5">

        {/* Level Progress */}
        <div className="flex items-center gap-5 lg:w-1/3 shrink-0">

          <div className="relative w-24 h-24 shrink-0">
            <svg
              className="w-full h-full -rotate-90"
              viewBox="0 0 100 100"
            >
              <circle
                cx="50"
                cy="50"
                r="43"
                className="fill-none stroke-lavender-100 stroke-[8]"
              />

              <motion.circle
                cx="50"
                cy="50"
                r="43"
                className="fill-none stroke-chrome stroke-[8]"
                strokeDasharray="270"
                strokeLinecap="round"
                initial={{ strokeDashoffset: 270 }}
                animate={{
                  strokeDashoffset:
                    270 - (270 * levelProgress) / 100,
                }}
                transition={{
                  duration: 0.8,
                  ease: 'easeOut',
                }}
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold text-carbon-900">
                {stats.level}
              </span>

              <span className="text-[10px] font-bold tracking-wide text-carbon-500">
                LEVEL
              </span>
            </div>
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold text-cocoa">
              Current level
            </p>

            <h2 className="text-xl font-extrabold text-deep-emerald mt-0.5">
              Level {stats.level}
            </h2>

            <div className="mt-3 w-full max-w-48">
              <div className="h-2 rounded-full bg-lavender-100 overflow-hidden">
                <motion.div
                  className="h-full bg-chrome rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${levelProgress}%` }}
                  transition={{
                    duration: 0.8,
                    ease: 'easeOut',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">

          {/* XP */}
          <motion.div
            whileHover={{ y: -3 }}
            transition={{ duration: 0.2 }}
            className="
              relative overflow-hidden
              min-h-[132px]
              flex flex-col justify-between
              bg-coral-100
              rounded-2xl
              p-4
              border border-chrome-accent/40
            "
          >
            <motion.img
              src="/assets/icons/star.png"
              alt=""
              aria-hidden
              className="absolute top-5 right-3 w-20 h-20 object-contain pointer-events-none select-none"
              animate={{
                y: [0, -5, 0],
                rotate: [-4, 4, -4],
              }}
              transition={{
                duration: 3.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />

            <span className="relative z-10 text-xs font-bold uppercase tracking-wider text-cocoa">
              XP
            </span>

            <div className="relative z-10 mt-6 flex flex-col items-start gap-1.5">
              <span className="text-3xl font-extrabold leading-none tabular-nums text-deep-emerald">
                {stats.xp.toLocaleString()}
              </span>
              <span className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-carbon-500">
                20/level · 30/quiz
              </span>
            </div>
          </motion.div>

          {/* AI Credits */}
          <motion.div
            whileHover={{ y: -3 }}
            transition={{ duration: 0.2 }}
            className="
              relative overflow-hidden
              min-h-[132px]
              flex flex-col justify-between
              bg-cocoa
              text-white
              rounded-2xl
              p-4
              border border-chrome
            "
          >
            <motion.img
              src="/assets/icons/creds.png"
              alt=""
              aria-hidden
              className="absolute top-5 right-3 w-20 h-20 object-contain pointer-events-none select-none"
              animate={{
                y: [0, -5, 0],
                rotate: [3, -3, 3],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />

            <span className="relative z-10 text-xs font-bold uppercase tracking-wider text-white/70">
              AI Credits
            </span>

            <div className="relative z-10 mt-6 flex flex-col items-start gap-1.5">
              <span className="text-3xl font-extrabold leading-none tabular-nums text-white">
                {aiCredits.toLocaleString()}
              </span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/70">
                2/lvl · 3/quiz
              </span>
            </div>
          </motion.div>

          {/* Streak */}
          <motion.div
            whileHover={{ y: -3 }}
            transition={{ duration: 0.2 }}
            className="
              relative overflow-hidden
              bg-chrome-accent
              rounded-2xl
              p-4
              border border-beige-600/20
            "
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-cocoa">
                Streak
              </span>

              <motion.div
                className="
                  flex items-center justify-center
                  w-10 h-10
                  rounded-full
                  bg-surface
                  text-beige-600
                  font-extrabold absolute top-7 right-5
                "
                animate={{
                  scale: [1, 1.08, 1],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <Logo compact />
              </motion.div>
            </div>

            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-deep-emerald">
                {stats.streak}
              </span>

              <span className="text-xs font-semibold text-cocoa">
                days
              </span>
            </div>

            <div className="mt-3 flex gap-1">
              {Array.from({ length: 7 }).map((_, index) => (
                <motion.span
                  key={index}
                  className={`h-1.5 flex-1 rounded-full ${index < Math.min(stats.streak, 7)
                    ? 'bg-beige-600'
                    : 'bg-white/70'
                    }`}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{
                    delay: index * 0.04,
                    duration: 0.2,
                  }}
                />
              ))}
            </div>
          </motion.div>

          {/* Badges */}
          <motion.div
            whileHover={{ y: -3 }}
            transition={{ duration: 0.2 }}
            className="
              relative overflow-hidden
              bg-deep-emerald
              text-white
              rounded-2xl
              p-4
              border border-deep-emerald
            "
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white/75">
                Badges
              </span>

              <motion.img
                src="/assets/icons/badge1.png"
                alt="badge"
                className="w-20 h-20 absolute right-1 top-5"
                animate={{
                  y: [0, -5, 0],
                  rotate: [3, -3, 3],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            </div>

            <div className="mt-2 text-2xl font-extrabold">
              {badgeCount}
            </div>

            <div className="mt-3 flex gap-1.5">
              {Array.from({
                length: Math.min(Math.max(badgeCount, 1), 5),
              }).map((_, index) => (
                <motion.span
                  key={index}
                  className="w-2 h-2 rounded-full bg-chrome-accent"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: index * 0.08,
                  }}
                />
              ))}
            </div>
          </motion.div>

        </div>
      </div>

      {/* Reward Metrics Guide */}
      <div className="mt-5 pt-4 border-t border-border/70 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5 font-bold text-carbon-800">
            <span className="w-2 h-2 rounded-full bg-chrome inline-block" />
            <span>Day Level: <span className="text-chrome">+20 XP</span> & <span className="text-cocoa">+2 AI Credits</span></span>
          </div>
          <div className="flex items-center gap-1.5 font-bold text-carbon-800">
            <span className="w-2 h-2 rounded-full bg-chrome inline-block" />
            <span>Quiz Assessment: <span className="text-chrome">+30 XP</span> & <span className="text-cocoa">+3 AI Credits</span></span>
          </div>
          <div className="flex items-center gap-1.5 font-bold text-carbon-800">
            <span className="w-2 h-2 rounded-full bg-chrome inline-block" />
            <span>7-Day Bonus: <span className="text-chrome">+100 XP</span> & <span className="text-cocoa">+10 AI Credits</span></span>
          </div>
        </div>
        <div className="text-[11px] font-medium text-carbon-500 italic">
          * Points awarded on initial completion only; reattempts update progress metrics.
        </div>
      </div>
    </Card>
  );
}
