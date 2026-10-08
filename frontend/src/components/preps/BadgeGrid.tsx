import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import type { BadgeItem } from '../../lib/gamification';
import { cn } from '../../utils/utils';

export function BadgeGrid({ badges }: { badges: BadgeItem[] }) {
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <Card
      variant="default"
      className="rounded-3xl p-6 md:p-7 bg-deep-emerald text-white border-none"
    >
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl md:text-2xl font-extrabold text-white">
              Badges & Achievements
            </h3>

            <Icon
              name="medal-outline"
              className="text-xl text-chrome-accent"
            />
          </div>

          <p className="text-sm text-on-chrome-muted mt-1">
            Small wins that mark your progress.
          </p>
        </div>

        <div className="shrink-0 text-sm font-bold text-on-chrome-muted">
          <span className="text-chrome-accent">
            {unlockedCount}
          </span>
          <span className="mx-1 text-white/30">/</span>
          {badges.length}
        </div>
      </div>

      {/* Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {badges.map((badge, index) => (
          <motion.div
            key={badge.id}
            whileHover={
              badge.unlocked
                ? {
                  y: -4,
                  transition: { duration: 0.2 },
                }
                : undefined
            }
            className="h-full"
          >
            <div
              className={cn(
                'relative h-full min-h-[170px] overflow-hidden',
                'rounded-2xl p-4 flex flex-col items-center text-center',
                'transition-shadow duration-300',

                badge.unlocked
                  ? 'bg-surface shadow-card'
                  : 'bg-white/5 border border-white/10 opacity-55'
              )}
            >
              {/* Badge icon */}
              <div className="relative mb-3">
                {badge.unlocked && (
                  <div className="absolute inset-0 rounded-full bg-chrome-accent/30 blur-xl" />
                )}

                <motion.div
                  className={cn(
                    'relative z-10 w-16 h-16 rounded-2xl',
                    'flex items-center justify-center text-2xl',
                    badge.unlocked
                      ? 'bg-lavender-100 text-deep-emerald'
                      : 'bg-white/10 text-white/30'
                  )}
                  animate={
                    badge.unlocked
                      ? {
                        y: [0, -3, 0],
                        rotate: [-1, 1, -1],
                      }
                      : undefined
                  }
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <Icon
                    name={
                      badge.unlocked
                        ? badge.icon
                        : 'lock-closed-outline'
                    }
                  />
                </motion.div>
              </div>

              {/* Content */}
              <div className="min-w-0 w-full">
                <h4
                  className={cn(
                    'text-sm font-extrabold leading-tight line-clamp-1',
                    badge.unlocked
                      ? 'text-deep-emerald'
                      : 'text-white/50'
                  )}
                >
                  {badge.name}
                </h4>

                <p
                  className={cn(
                    'text-[10px] leading-relaxed mt-1 line-clamp-2',
                    badge.unlocked
                      ? 'text-cocoa'
                      : 'text-white/35'
                  )}
                >
                  {badge.description}
                </p>
              </div>

              {/* Bottom state */}
              <div className="mt-auto pt-3 w-full">
                <div
                  className={cn(
                    'h-1 rounded-full overflow-hidden',
                    badge.unlocked
                      ? 'bg-lavender-100'
                      : 'bg-white/10'
                  )}
                >
                  {badge.unlocked && (
                    <motion.div
                      className="h-full rounded-full bg-chrome"
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{
                        duration: 0.6,
                        delay: index * 0.05,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}