export interface TrophyItem {
  id: string;
  name: string;
  tier: "bronze" | "silver" | "gold" | "platinum" | "diamond";
  icon: string;
  description: string;
  unlocked: boolean;
  earnedDate?: string;
  requirement: string;
}

export interface BadgeItem {
  id: string;
  name: string;
  icon: string;
  description: string;
  requirement: string;
  unlocked: boolean;
  earnedDate?: string;
}

export interface MilestoneItem {
  id: string;
  title: string;
  condition: string;
  unlocked: boolean;
}

export interface SkillItem {
  name: string;
  level: number;
}

export interface GamificationState {
  xp: number;
  aiCredits: number;
  level: number;
  nextLevelXp: number;
  streak: number;
  longestStreak: number;
  completedDayCount: number;
  totalDays: number;
  completedSprints: number;
  totalSprints: number;
  trophies: TrophyItem[];
  badges: BadgeItem[];
  milestones: MilestoneItem[];
  skillLevels: SkillItem[];
  learningVelocity: string;
  activityDays: boolean[]; // Last 7 days [Sun..Sat]
}

export function computeGamification(
  plan: any,
  globalProgress?: any,
  assessments: any[] = []
): GamificationState {
  const sprints = plan?.sprints || plan?.roadmap?.sprints || [];
  const allDays = sprints.flatMap((s: any) => s.days || s.sprint_days || []);
  const totalDays = allDays.length || plan?.total_days || plan?.durationDays || 30;
  const completedDays = allDays.filter((d: any) => d.status === "done" || d.status === "completed").length;

  const completedSprints = sprints.filter((s: any) => {
    const days = s.days || s.sprint_days || [];
    return days.length > 0 && days.every((d: any) => d.status === "done" || d.status === "completed");
  }).length;
  const totalSprints = sprints.length || 1;

  const completedAssessments = assessments.filter((a: any) => a.is_completed).length;

  // Base XP from progress or computed: 20 XP per day topic + 30 XP per assessment
  const calculatedXp = (completedDays * 20) + (completedAssessments * 30);
  const xp = Math.max(globalProgress?.xp_points || 0, calculatedXp);
  const aiCredits = Math.floor(xp / 10);
  const level = Math.floor(xp / 1000) + 1;
  const nextLevelXp = 1000 - (xp % 1000);

  const streak = globalProgress?.current_streak || globalProgress?.streak_count || (completedDays > 0 ? 1 : 0);
  const longestStreak = Math.max(globalProgress?.longest_streak || 0, streak);

  // Trophies configuration
  const awardedTrophyKeys = new Set(
    (globalProgress?.trophies || []).map((t: any) => t.key)
  );

  const trophies: TrophyItem[] = [
    {
      id: "bronze_sprint_1",
      name: "Bronze Sprint Master",
      tier: "bronze",
      icon: "trophy",
      description: "Successfully conquered all topics and tasks in Sprint 1.",
      requirement: "Complete Sprint 1",
      unlocked: completedSprints >= 1 || awardedTrophyKeys.has("first_sprint") || awardedTrophyKeys.has("bronze_sprint_1"),
    },
    {
      id: "silver_sprint_2",
      name: "Silver Sprint Master",
      tier: "silver",
      icon: "trophy",
      description: "Maintained momentum and completed Sprint 2.",
      requirement: "Complete Sprint 2",
      unlocked: completedSprints >= 2 || awardedTrophyKeys.has("second_sprint") || awardedTrophyKeys.has("silver_sprint_2"),
    },
    {
      id: "gold_sprint_3",
      name: "Gold Sprint Master",
      tier: "gold",
      icon: "trophy",
      description: "Advanced into deep concepts by completing Sprint 3.",
      requirement: "Complete Sprint 3",
      unlocked: completedSprints >= 3 || awardedTrophyKeys.has("third_sprint") || awardedTrophyKeys.has("gold_sprint_3"),
    },
    {
      id: "platinum_sprint_4",
      name: "Platinum Sprint Master",
      tier: "platinum",
      icon: "trophy",
      description: "Achieved mastery across 4 full preparation sprints.",
      requirement: "Complete Sprint 4",
      unlocked: completedSprints >= 4 || awardedTrophyKeys.has("fourth_sprint") || awardedTrophyKeys.has("platinum_sprint_4"),
    },
    {
      id: "diamond_master",
      name: "Diamond Grandmaster",
      tier: "diamond",
      icon: "ribbon",
      description: "Completed 100% of your interview preparation roadmap.",
      requirement: "Complete Entire Roadmap",
      unlocked: (totalDays > 0 && completedDays >= totalDays) || awardedTrophyKeys.has("plan_complete"),
    },
  ];

  // Badges configuration
  const badges: BadgeItem[] = [
    {
      id: "b-first-step",
      name: "First Step",
      icon: "flag-outline",
      description: "Completed your first study topic.",
      requirement: "Complete 1 topic",
      unlocked: completedDays >= 1,
    },
    {
      id: "b-knowledge-validator",
      name: "Knowledge Validator",
      icon: "school-outline",
      description: "Completed your first comprehensive quiz & flashcard assessment.",
      requirement: "Complete 1 assessment",
      unlocked: completedAssessments >= 1,
    },
    {
      id: "b-sprint-voyager",
      name: "Sprint Voyager",
      icon: "rocket-outline",
      description: "Completed 2 full preparation sprints.",
      requirement: "Complete 2 Sprints",
      unlocked: completedSprints >= 2,
    },
    {
      id: "b-fast-learner",
      name: "Fast Learner",
      icon: "flash-outline",
      description: "Accumulated 200+ XP in preparation points.",
      requirement: "Earn 200 XP",
      unlocked: xp >= 200,
    },
    {
      id: "b-streak-champion",
      name: "Consistent Learner",
      icon: "flame-outline",
      description: "Kept your learning streak active for 7 days.",
      requirement: "7-Day Streak",
      unlocked: longestStreak >= 7,
    },
    {
      id: "b-master-candidate",
      name: "Interview Ready",
      icon: "star-outline",
      description: "Completed the entire preparation roadmap.",
      requirement: "100% Roadmap Completion",
      unlocked: totalDays > 0 && completedDays >= totalDays,
    },
  ];

  // Milestones track
  const milestones: MilestoneItem[] = [
    {
      id: "m-1",
      title: "Preparation Initiated",
      condition: "Plan created and Day 1 topics scheduled",
      unlocked: true,
    },
    {
      id: "m-2",
      title: "First Assessment Cleared",
      condition: "Complete your first Sprint Assessment (Q1)",
      unlocked: completedAssessments >= 1,
    },
    {
      id: "m-3",
      title: "Sprint 1 Mastered",
      condition: "Complete all topics & assessments in Sprint 1",
      unlocked: completedSprints >= 1,
    },
    {
      id: "m-4",
      title: "Halfway Milestone",
      condition: "Complete 50% of the preparation roadmap",
      unlocked: totalDays > 0 && completedDays >= Math.ceil(totalDays / 2),
    },
    {
      id: "m-5",
      title: "Interview Mastery",
      condition: "Complete 100% of the preparation roadmap",
      unlocked: totalDays > 0 && completedDays >= totalDays,
    },
  ];

  // Skill levels computed from sprint domains
  const skillLevels: SkillItem[] = sprints.map((s: any, idx: number) => {
    const days = s.days || s.sprint_days || [];
    const done = days.filter((d: any) => d.status === "done" || d.status === "completed").length;
    const pct = days.length > 0 ? Math.round((done / days.length) * 100) : 0;
    return {
      name: s.title || s.sprint_name || `Sprint ${idx + 1}`,
      level: Math.max(pct, done > 0 ? 25 : 10),
    };
  });

  if (skillLevels.length === 0) {
    skillLevels.push(
      { name: "Core Fundamentals", level: completedDays > 0 ? 60 : 20 },
      { name: "System Architecture", level: completedDays > 3 ? 50 : 15 },
      { name: "Problem Solving", level: completedDays > 5 ? 70 : 25 }
    );
  }

  // Calculate past 7 days activity
  const completedDates = new Set(globalProgress?.completed_day_dates || []);
  const today = new Date();
  const activityDays: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    activityDays.push(completedDates.has(key) || (i === 0 && completedDays > 0));
  }

  const velocity = completedDays > 5 ? "1.4x" : completedDays > 2 ? "1.2x" : "1.0x";

  return {
    xp,
    aiCredits,
    level,
    nextLevelXp,
    streak,
    longestStreak,
    completedDayCount: completedDays,
    totalDays,
    completedSprints,
    totalSprints,
    trophies,
    badges,
    milestones,
    skillLevels,
    learningVelocity: velocity,
    activityDays,
  };
}
