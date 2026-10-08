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
import { Card } from '../components/ui/Card';

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
          <motion.div
            initial={{
              opacity: 0,
              y: shouldReduceMotion ? 0 : 12,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{ duration: 0.3 }}
          >
            <Card
              variant="default"
              className="bg-lavender-100 rounded-3xl p-6 md:p-8 flex items-center gap-6"
            >
              {/* Content */}
              <div className="flex-1 min-w-0 space-y-4">

                {/* Back to Dashboard */}
                <Link to="/dashboard">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 -ml-3 font-bold text-chrome hover:bg-surface/50 mb-4"
                  >
                    <Icon name="arrow-back" />
                    Dashboard
                  </Button>
                </Link>

                {/* Title */}
                <div>
                  <h1 className="text-2xl md:text-3xl font-extrabold text-carbon-900">
                    Progress & Gamification
                  </h1>

                  <p className="text-sm md:text-base text-carbon-500 mt-1">
                    Track your learning progress, XP, streaks, and achievements.
                  </p>
                </div>
              </div>

              {/* Mascot */}
              <div className="hidden sm:flex shrink-0 w-32 h-32 md:w-36 md:h-36 rounded-full bg-surface overflow-hidden items-center justify-center">
                <Mascot variant="OK.png" size="lg" />
              </div>
            </Card>
          </motion.div>

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
              {/* <TitleCard titles={titles} /> */}
            </div>
          </div>

          {/* Milestone Track */}
          <MilestoneTrack milestones={gamification.milestones} />
        </motion.div>
      </div>
    </div>
  );
}
