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
              bg-coral-100
              rounded-2xl
              p-4
              border border-chrome-accent/40
            "
          >
            <div className="flex items-start justify-between">
              <span className="text-lg font-bold text-cocoa">
                XP
              </span>

              <motion.img
                src="/assets/Mascot/star.png"
                alt=""
                className="w-20 h-20 absolute right-1"
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
            </div>

            <div className="mt-2 text-2xl font-extrabold text-deep-emerald">
              {stats.xp.toLocaleString()}
            </div>
          </motion.div>

          {/* AI Credits */}
          <motion.div
            whileHover={{ y: -3 }}
            transition={{ duration: 0.2 }}
            className="
              relative overflow-hidden
              bg-cocoa
              text-white
              rounded-2xl
              p-4
              border border-chrome
            "
          >
            <div className="flex items-start justify-between">
              <span className="text-lg font-bold text-white/75">
                AI Credits
              </span>

              <motion.img
                src="/assets/Mascot/creds.png"
                alt=""
                className="w-20 h-20 absolute right-1"
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

            <div className="mt-2 text-2xl font-extrabold text-white">
              {aiCredits.toLocaleString()}
            </div>
          </motion.div>

          {/* Streak */}
          <motion.div
            whileHover={{ y: -3 }}
            transition={{ duration: 0.2 }}
            className="
              relative overflow-hidden
              bg-beige-100
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
                  w-9 h-9
                  rounded-full
                  bg-surface
                  text-beige-600
                  font-extrabold
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

              <motion.div
                className="
                  flex items-center justify-center
                  w-9 h-9
                  rounded-full
                  bg-chrome-accent
                  text-deep-emerald
                  font-extrabold
                "
                animate={{
                  y: [0, -4, 0],
                  rotate: [0, 5, 0],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                {badgeCount}
              </motion.div>
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
    </Card>
  );
}