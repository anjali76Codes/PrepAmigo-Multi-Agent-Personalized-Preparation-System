import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { ProgressStats } from '../components/preps/ProgressStats';
import { TrophyGrid } from '../components/preps/TrophyGrid';
import { BadgeGrid } from '../components/preps/BadgeGrid';
import { StreakCalendar } from '../components/preps/StreakCalendar';
import { SkillLevelBars } from '../components/preps/SkillLevelBars';
import { MilestoneTrack } from '../components/preps/MilestoneTrack';
import { TitleCard } from '../components/preps/TitleCard';
import { Mascot } from '../components/ui/Mascot';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { computeGamification } from '../lib/gamification';

export function Progress() {
  const shouldReduceMotion = useReducedMotion();
  const { preps, activePrep } = useAppContext();
  const prep = activePrep || preps[0];

  const gamification = useMemo(() => {
    return computeGamification(prep, prep?.learningContext?.progress, []);
  }, [prep]);

  if (!prep) {
    return (
      <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-lavender-100 rounded-2xl flex items-center justify-center text-chrome mb-4">
            <Icon name="analytics-outline" className="text-3xl" />
          </div>
          <h2 className="text-2xl font-bold text-carbon-900 mb-2">No Active Roadmap</h2>
          <p className="text-carbon-500 text-sm mb-6">
            Track your learning velocity, skill level progress, earned XP, and sprint trophies once you have generated a preparation plan.
          </p>
          <Link to="/dashboard/chat">
            <Button variant="primary">Start a New Prep</Button>
          </Link>
        </div>
      </div>
    );
  }

  const titles = [
    {
      id: "t-1",
      name: gamification.completedSprints >= 4
        ? "Lead Architect"
        : gamification.completedSprints >= 2
        ? "Senior Candidate"
        : "Candidate",
    },
  ];

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <div className="flex-1 overflow-y-auto safe-area-bottom">
        <motion.div
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full px-6 md:px-12 py-6 md:py-8 space-y-8 pb-12"
        >
          {/* Header Card */}
          <div className="bg-lavender-100 rounded-3xl p-6 md:p-8 flex items-center justify-between shadow-pop border border-chrome-accent/50 relative overflow-hidden">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-chrome text-white text-xs font-bold mb-2 shadow-2xs">
                <Icon name="sparkles" /> {gamification.aiCredits} AI Credits Available
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-navy-900 mb-2 tracking-tight">
                Progress & Gamification
              </h1>
              <p className="text-base md:text-lg text-navy-800/80 font-medium max-w-xl">
                Earn <span className="font-bold text-navy-900">20 XP</span> per level topic and{" "}
                <span className="font-bold text-navy-900">30 XP</span> per assessment.
                <span className="text-navy-900 font-bold ml-1 block mt-1 md:inline md:mt-0">
                  XP can be used as AI Credits in Resource Assistant.
                </span>
              </p>
            </div>
            <div className="relative z-10 hidden sm:flex shrink-0">
              <Mascot size="lg" variant="Thinking.png" className="bg-white shadow-card rounded-full p-2" />
            </div>
          </div>

          {/* Stats Breakdown */}
          <ProgressStats stats={gamification} />

          {/* Sprint Trophies */}
          <TrophyGrid trophies={gamification.trophies} />

          {/* Badges and Activity */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-8">
              <BadgeGrid badges={gamification.badges} />
              <StreakCalendar streak={gamification.streak} activityDays={gamification.activityDays} />
            </div>

            <div className="space-y-8">
              <SkillLevelBars skills={gamification.skillLevels} velocity={gamification.learningVelocity} />
              <TitleCard titles={titles} />
            </div>
          </div>

          {/* Milestone Track */}
          <MilestoneTrack milestones={gamification.milestones} />
        </motion.div>
      </div>
    </div>
  );
}
