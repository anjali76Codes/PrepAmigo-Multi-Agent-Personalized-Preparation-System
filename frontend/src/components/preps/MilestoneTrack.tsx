import { motion, useReducedMotion } from 'framer-motion';
import type { Milestone } from '../../data/mockData';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { Mascot, type MascotVariant } from '../ui/Mascot';
import { cn } from '../../utils/utils';

const WALKING_MASCOTS: MascotVariant[] = [
  'Thinking.png',
  'working.png',
  'Motivated.png',
];

// Seconds between each node "arriving" during the intro sequence
const STEP = 0.18;

export function MilestoneTrack({ milestones }: { milestones: Milestone[] }) {
  const reduceMotion = useReducedMotion();

  const total = milestones.length;
  const unlockedCount = milestones.filter((m) => m.unlocked).length;
  const allDone = total > 0 && unlockedCount === total;

  // Mascot stands on the last unlocked node; the next one is the target.
  const lastUnlocked = Math.max(unlockedCount - 1, 0);
  const nextIndex = unlockedCount < total ? unlockedCount : -1;

  const mascotVariant: MascotVariant = allDone
    ? 'Celebration.png'
    : unlockedCount === 0
      ? 'hi.png'
      : WALKING_MASCOTS[lastUnlocked % WALKING_MASCOTS.length];

  // Column centers: node i sits at (i + 0.5) / total across the row.
  const centerOf = (i: number) => `${((i + 0.5) / Math.max(total, 1)) * 100}%`;

  const fillWidth =
    total > 1 && unlockedCount > 0
      ? `${(lastUnlocked / (total - 1)) * 100}%`
      : '0%';

  // One shared timing so the track, mascot and nodes land together.
  const travel = reduceMotion ? 0 : 0.5 + lastUnlocked * STEP;

  return (
    <Card
      variant="default"
      className="relative overflow-hidden rounded-3xl bg-expresso border-none p-6 md:p-8 text-white"
    >
      {/* Header */}
      <div className="relative z-10 mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h3 className="text-xl md:text-2xl font-extrabold text-white">
            Milestone Journey
          </h3>
          <Icon name="flag-outline" className="text-xl text-chrome-accent" />
        </div>

        <div className="text-xl font-extrabold text-chrome-accent">
          {unlockedCount}
          <span className="mx-1 text-white/25">/</span>
          <span className="text-white/60">{total}</span>
        </div>
      </div>

      {/* Journey */}
      <div className="relative z-10 overflow-x-auto pb-2">
        <div className="min-w-[640px] pt-24">
          {/* Node row: track, mascot and nodes share this coordinate space */}
          <div className="relative h-[60px]">
            {/* Track */}
            <div
              className="absolute top-1/2 h-[3px] -translate-y-1/2"
              style={{ left: `${50 / Math.max(total, 1)}%`, right: `${50 / Math.max(total, 1)}%` }}
            >
              <div className="absolute inset-0 border-t-2 border-dashed border-white/15" />
              <motion.div
                className="absolute left-0 top-0 h-full rounded-full bg-chrome-accent"
                initial={{ width: 0 }}
                animate={{ width: fillWidth }}
                transition={{ duration: travel, ease: 'easeInOut' }}
              />
            </div>

            {/* Mascot walks from the start to the current node */}
            {total > 0 && (
              <motion.div
                className="absolute bottom-full pb-2"
                style={{ x: '-50%' }}
                initial={{ left: centerOf(0) }}
                animate={{ left: centerOf(lastUnlocked) }}
                transition={{ duration: travel, ease: 'easeInOut' }}
              >
                <motion.div
                  animate={reduceMotion ? undefined : { y: [0, -5, 0] }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: travel,
                  }}
                >
                  <Mascot
                    size="md"
                    variant={mascotVariant}
                    alt=""
                    className="drop-shadow-lg"
                  />
                </motion.div>
              </motion.div>
            )}

            {/* Nodes */}
            <div
              className="relative grid h-full items-center"
              style={{ gridTemplateColumns: `repeat(${Math.max(total, 1)}, minmax(0, 1fr))` }}
            >
              {milestones.map((milestone, index) => {
                const unlocked = milestone.unlocked;
                const isNext = index === nextIndex;

                return (
                  <div key={milestone.id} className="flex justify-center">
                    <motion.div
                      initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        type: 'spring',
                        stiffness: 380,
                        damping: 22,
                        delay: unlocked ? index * STEP : travel,
                      }}
                      className={cn(
                        'relative flex h-[56px] w-[56px] items-center justify-center rounded-full border-4',
                        unlocked &&
                        'border-chrome-accent bg-chrome-accent text-expresso shadow-pop',
                        isNext &&
                        'border-dashed border-chrome-accent/70 bg-expresso text-chrome-accent',
                        !unlocked && !isNext && 'border-white/10 bg-expresso text-white/25'
                      )}
                    >
                      <Icon
                        name={unlocked ? 'checkmark' : 'lock-closed-outline'}
                        className={unlocked ? 'text-2xl' : 'text-lg'}
                      />

                      {/* The one looping attention cue: the next target */}
                      {isNext && !reduceMotion && (
                        <motion.span
                          aria-hidden
                          className="absolute inset-[-9px] rounded-full border-2 border-chrome-accent/50"
                          animate={{ scale: [1, 1.15, 1], opacity: [0.7, 0, 0.7] }}
                          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      )}
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Labels: condition is only shown for what to do next */}
          <div
            className="mt-4 grid"
            style={{ gridTemplateColumns: `repeat(${Math.max(total, 1)}, minmax(0, 1fr))` }}
          >
            {milestones.map((milestone, index) => {
              const unlocked = milestone.unlocked;
              const isNext = index === nextIndex;

              return (
                <div key={milestone.id} className="px-2 text-center">
                  <h4
                    className={cn(
                      'text-sm font-extrabold leading-tight',
                      unlocked && 'text-white',
                      isNext && 'text-chrome-accent',
                      !unlocked && !isNext && 'text-white/35'
                    )}
                  >
                    {milestone.title}
                  </h4>

                  {isNext && (
                    <motion.p
                      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: travel + 0.15, duration: 0.3 }}
                      className="mt-1 text-[10px] leading-relaxed text-white/50"
                    >
                      {milestone.condition}
                    </motion.p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}