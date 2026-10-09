import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import type { TrophyItem } from '../../lib/gamification';
import { cn } from '../../utils/utils';

const TROPHY_IMAGES = [
  '/assets/icons/trophy.png',
  '/assets/icons/trophy2.png',
  '/assets/icons/trophy3.png',
  '/assets/icons/trophy4.png',
  '/assets/icons/trophy5.png',
];

const TIER_STYLES: Record<
  TrophyItem['tier'],
  {
    bg: string;
    accent: string;
    text: string;
    soft: string;
  }
> = {
  bronze: {
    bg: 'bg-soft-rose',
    accent: 'bg-beige-600',
    text: 'text-cocoa',
    soft: 'bg-white/60',
  },
  silver: {
    bg: 'bg-lavender-100',
    accent: 'bg-chrome',
    text: 'text-deep-emerald',
    soft: 'bg-white/60',
  },
  gold: {
    bg: 'bg-chrome-accent',
    accent: 'bg-expresso',
    text: 'text-deep-emerald',
    soft: 'bg-white/60',
  },
  platinum: {
    bg: 'bg-sky-100',
    accent: 'bg-forest-emerald',
    text: 'text-deep-emerald',
    soft: 'bg-white/60',
  },
  diamond: {
    bg: 'bg-soft-rose',
    accent: 'bg-rosewood',
    text: 'text-expresso',
    soft: 'bg-white/60',
  },
};

export function TrophyGrid({ trophies }: { trophies: TrophyItem[] }) {
  const unlockedCount = trophies.filter((t) => t.unlocked).length;

  return (
    <Card
      variant="default"
      className="rounded-3xl p-6 md:p-8"
    >
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <img
              src={`/assets/icons/trophy.png`}
              alt="trophy"
              className={cn(
                'w-14 object-contain p-1',
                // !badge.unlocked && 'grayscale opacity-30'
              )}
            />
            <h3 className="text-xl md:text-2xl font-extrabold text-deep-emerald">
              Sprint Trophies
            </h3>

            {/* <Icon
              name="trophy"
              className="text-xl text-expresso"
            /> */}
          </div>

          {/* <p className="text-sm text-cocoa mt-1">
            Milestones earned across your preparation journey.
          </p> */}
        </div>

        <div className="shrink-0 text-sm font-bold text-cocoa">
          <span className="text-deep-emerald">
            {unlockedCount}
          </span>
          <span className="mx-1 text-border">/</span>
          {trophies.length}
        </div>
      </div>

      {/* Trophy Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {trophies.map((trophy, index) => {
          const style =
            TIER_STYLES[trophy.tier] || TIER_STYLES.bronze;

          const trophyImage =
            TROPHY_IMAGES[index % TROPHY_IMAGES.length];

          return (
            <motion.div
              key={trophy.id}
              whileHover={
                trophy.unlocked
                  ? {
                    y: -5,
                    transition: { duration: 0.2 },
                  }
                  : undefined
              }
              className="h-full"
            >
              <div
                className={cn(
                  'relative h-full min-h-[250px] overflow-hidden rounded-2xl p-4 border-8 border-border',
                  'flex flex-col',
                  'transition-shadow duration-300',
                  trophy.unlocked
                    ? `${style.bg} shadow-card`
                    : 'bg-surface-muted/70 opacity-70'
                )}
              >
                {/* Top row */}
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'text-lg font-extrabold uppercase',
                      trophy.unlocked
                        ? style.text
                        : 'text-carbon-400'
                    )}
                  >
                    {trophy.tier}
                  </span>

                  {trophy.unlocked && (
                    <div
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full',
                        style.soft
                      )}
                    >
                      <Icon
                        name="star"
                        className={cn(
                          'text-sm',
                          style.text
                        )}
                      />
                    </div>
                  )}
                </div>

                {/* Trophy artwork */}
                <div className="relative flex-1 min-h-[125px] flex items-center justify-center">
                  {trophy.unlocked ? (
                    <>
                      {/* Soft background glow */}
                      <div
                        className={cn(
                          'absolute w-24 h-24 rounded-full blur-2xl opacity-40',
                          style.accent
                        )}
                      />

                      <motion.img
                        src={trophyImage}
                        alt={trophy.name}
                        className="relative z-10 w-28 h-28 object-contain drop-shadow-md"
                        animate={{
                          y: [0, -5, 0],
                          rotate: [-1.5, 1.5, -1.5],
                        }}
                        transition={{
                          duration: 4 + index * 0.3,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                      />
                    </>
                  ) : (
                    <div className="relative flex items-center justify-center">
                      <img
                        src={trophyImage}
                        alt=""
                        className="
                          w-24 h-24
                          object-contain
                          grayscale
                          opacity-30
                        "
                      />

                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-carbon-900/10 backdrop-blur-sm">
                          <Icon
                            name="lock-closed-outline"
                            className="text-sm text-carbon-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="relative z-10 text-center">
                  <h4
                    className={cn(
                      'font-extrabold text-lg my-3',
                      trophy.unlocked
                        ? 'text-deep-emerald'
                        : 'text-carbon-500'
                    )}
                  >
                    {trophy.name}
                  </h4>

                  <p
                    className={cn(
                      'text-xs leading-relaxed mt-1 line-clamp-2',
                      trophy.unlocked
                        ? 'text-cocoa'
                        : 'text-carbon-400'
                    )}
                  >
                    {trophy.description}
                  </p>
                </div>

                {/* Bottom accent */}
                {/* <div
                  className={cn(
                    'absolute bottom-0 left-0 right-0 h-1',
                    trophy.unlocked
                      ? style.accent
                      : 'bg-border'
                  )}
                /> */}
              </div>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}