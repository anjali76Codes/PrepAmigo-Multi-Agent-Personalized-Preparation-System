import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

export function StreakCalendar({
  streak,
  activityDays,
}: {
  streak: number;
  activityDays?: boolean[];
}) {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const activeDays =
    activityDays && activityDays.length === 7
      ? activityDays
      : [false, false, false, false, false, streak > 1, streak > 0];

  return (
    <Card
      variant="default"
      className="
        relative overflow-hidden
        rounded-3xl
        bg-cocoa
        text-white
        border-none
        p-6 md:p-7
      "
    >
      {/* Header */}
      <div className="relative z-10 flex items-start justify-between gap-4 mb-7">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl md:text-2xl font-extrabold text-white">
              Learning Activity
            </h3>

            <Icon
              name="calendar-outline"
              className="text-chrome-accent text-lg"
            />
          </div>

          <p className="text-sm text-white/60 mt-1">
            {streak} day{streak === 1 ? '' : 's'} active
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <motion.div
            animate={{
              scale: [1, 1.08, 1],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="
              w-9 h-9
              rounded-xl
              bg-chrome-accent
              text-cocoa
              flex items-center justify-center
              shadow-pop
            "
          >
            <Icon name="flame" className="text-lg" />
          </motion.div>

          <div className="hidden sm:block">
            <div className="text-lg font-extrabold text-white leading-none">
              {streak}
            </div>

            <div className="text-[10px] font-semibold text-white/55 mt-1">
              DAY STREAK
            </div>
          </div>
        </div>
      </div>

      {/* Activity */}
      <div
        className="
          relative z-10
          rounded-2xl
          bg-expresso/40
          border border-white/10
          p-4
        "
      >
        <div className="grid grid-cols-7 gap-2">
          {days.map((day, idx) => {
            const active = activeDays[idx];

            return (
              <div
                key={idx}
                className="flex flex-col items-center gap-2"
              >
                <span className="text-[10px] font-bold text-white/55">
                  {day}
                </span>

                <motion.div
                  whileHover={{ y: -2 }}
                  className={`
                    relative
                    w-full aspect-square max-w-10
                    rounded-xl
                    flex items-center justify-center
                    transition-all duration-200
                    ${active
                      ? 'bg-chrome-accent text-cocoa shadow-pop'
                      : 'bg-white/5 border border-white/10 text-white/20'
                    }
                  `}
                >
                  {active ? (
                    <Icon
                      name="checkmark"
                      className="text-sm font-bold"
                    />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                  )}
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress */}
      <div className="relative z-10 mt-5 flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-chrome-accent"
            initial={{ width: 0 }}
            animate={{
              width: `${(Math.min(streak, 7) / 7) * 100}%`,
            }}
            transition={{
              duration: 0.8,
              ease: 'easeOut',
            }}
          />
        </div>

        <span className="text-[10px] font-bold text-white/55 whitespace-nowrap">
          {Math.min(streak, 7)} / 7
        </span>
      </div>
    </Card>
  );
}