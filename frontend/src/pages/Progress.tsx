import { motion, useReducedMotion } from 'framer-motion';
import { useAppContext } from '../context/AppContext';
import { ProgressStats } from '../components/preps/ProgressStats';
import { BadgeGrid } from '../components/preps/BadgeGrid';
import { StreakCalendar } from '../components/preps/StreakCalendar';
import { SkillLevelBars } from '../components/preps/SkillLevelBars';
import { MilestoneTrack } from '../components/preps/MilestoneTrack';
import { TitleCard } from '../components/preps/TitleCard';
import { Mascot } from '../components/ui/Mascot';

export function Progress() {
  const shouldReduceMotion = useReducedMotion();
  const { preps } = useAppContext();
  const prep = preps[0];
  const progress = prep.learningContext.progress;

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <div className="bg-bg shrink-0 z-10 sticky top-0 px-4 md:px-8 py-6 border-b border-border">
        <div className="bg-lavender-100 rounded-3xl p-6 md:p-8 flex items-center justify-between shadow-pop border border-chrome-accent/50 relative overflow-hidden max-w-6xl mx-auto">
          <div className="relative z-10">
            <h1 className="text-3xl md:text-4xl font-extrabold text-navy-900 mb-2 tracking-tight">Progress Dashboard</h1>
            <p className="text-base md:text-lg text-navy-800/80 font-medium">
              Track your learning velocity and skill levels.
              <span className="text-navy-900 font-bold ml-1 block mt-1 md:inline md:mt-0">
                XP is earned only from completed tasks.
              </span>
            </p>
          </div>
          <div className="relative z-10 hidden sm:block shrink-0">
            <Mascot size="lg" variant="Thinking.png" className="bg-white shadow-card rounded-full p-2" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 relative safe-area-bottom">
        <motion.div
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto space-y-8 pb-12"
        >
          <ProgressStats stats={progress} />
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-8">
              <SkillLevelBars skills={progress.skillLevels} velocity={progress.learningVelocity} />
              <StreakCalendar streak={progress.streak} />
            </div>
            
            <div className="space-y-8">
              <TitleCard titles={progress.titles} />
              <BadgeGrid badges={progress.badges} />
            </div>
          </div>
          
          <MilestoneTrack milestones={progress.milestones} />
        </motion.div>
      </div>
    </div>
  );
}
