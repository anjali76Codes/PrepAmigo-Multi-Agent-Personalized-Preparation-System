import { motion } from 'framer-motion';
import type { Skill } from '../../data/mockData';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

export function SkillLevelBars({
  skills,
  velocity,
}: {
  skills: Skill[];
  velocity: string;
}) {
  return (
    <Card
      variant="default"
      className="
        relative overflow-hidden
        rounded-3xl
        bg-chrome-accent
        border-border
        p-6 md:p-7
      "
    >
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-7">
        <div>
          <div className="flex items-center gap-2">
            <div
              className="
                flex h-9 w-9 items-center justify-center
                rounded-xl
                bg-expresso
                text-chrome-accent
              "
            >
              <Icon name="analytics-outline" />
            </div>

            <div>
              <h3 className="text-lg md:text-xl font-extrabold text-deep-emerald">
                Skill Levels
              </h3>

              <p className="text-[11px] font-medium text-cocoa mt-0.5">
                Current strength across your roadmap
              </p>
            </div>
          </div>
        </div>

        {/* Velocity */}
        <div className="text-right">
          <div className="text-[9px] font-bold uppercase tracking-wider text-cocoa">
            Velocity
          </div>

          <div className="mt-0.5 text-sm font-extrabold text-expresso">
            {velocity}
          </div>
        </div>
      </div>

      {/* Skills */}
      <div className="space-y-3">
        {skills.map((skill, index) => {
          const level = Math.max(0, Math.min(100, skill.level));

          return (
            <motion.div
              key={skill.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.35,
                delay: index * 0.05,
              }}
              className="
                rounded-2xl
                bg-lavender-50
                border border-border/60
                px-4 py-3.5
              "
            >
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-sm font-bold text-deep-emerald">
                  {skill.name}
                </span>

                <span className="text-xs font-extrabold text-cocoa">
                  {level}
                </span>
              </div>

              <div className="relative h-2 rounded-full bg-soft-rose overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-expresso"
                  initial={{ width: 0 }}
                  animate={{ width: `${level}%` }}
                  transition={{
                    duration: 0.9,
                    delay: index * 0.05,
                    ease: 'easeOut',
                  }}
                />
              </div>

              <div className="mt-2 flex justify-between text-[9px] font-semibold text-cocoa/60">
                <span>Developing</span>
                <span>Strong</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}