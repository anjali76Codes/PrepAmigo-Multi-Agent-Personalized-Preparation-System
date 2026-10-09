import { Link, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Mascot } from '../components/ui/Mascot';
import { Alert } from '../components/ui/Alert';
import { RevealStagger, RevealStaggerItem } from '../components/ui/Reveal';
import { SprintMap } from '../components/chat/AgentJourney';
import { useAppContext } from '../context/AppContext';
import { levelStates } from '../lib/levels';
import { buildSprintLevelNodes } from '../lib/sprintLevels';
import { getAssessments, type Assessment } from '../mocks/assessment.mock';
import { computeGamification } from '../lib/gamification';
import GemRewardAnimation, {
  type GemRewardData,
} from '../components/gamification/GemRewardAnimation';

const QUICK_LINKS = [
  {
    to: '/roadmap',
    icon: 'git-network-outline',
    title: 'Roadmap & Sprints',
    sub: 'View your active preparation sprints',
  },
  // {
  //   to: '/assessment',
  //   icon: 'help-circle',
  //   title: 'Quizzes & Flashcards',
  //   sub: 'Test what you have learned'
  // },
  {
    to: '/dashboard/progress',
    icon: 'bar-chart-outline',
    title: 'Progress',
    sub: 'View your stats and XP',
  },
];

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl px-4 py-3 min-w-[110px]">
      <div className="flex items-center gap-2">
        {icon && (
          <div className="shrink-0">
            {icon}
          </div>
        )}

        <div className="text-xs font-semibold text-carbon-500 uppercase tracking-wide">
          {label}
        </div>
      </div>

      <div className="text-xl font-extrabold text-carbon-900 mt-0.5">
        {value}
      </div>
    </div>
  );
}

export function AppHome() {
  const navigate = useNavigate();
  const { activePrep, refreshPreps } = useAppContext();

  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);

  const [gemReward, setGemReward] = useState<GemRewardData | null>(null);

  // XP that has been earned but whose gems haven't landed yet.
  // It is subtracted from the displayed total, then drained as each gem arrives.
  const [pendingXp, setPendingXp] = useState(0);

  // Completed sprints can be collapsed.
  const [collapsedSprints, setCollapsedSprints] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const rawReward = sessionStorage.getItem('prep-amigo:xp-reward');

    if (!rawReward) return;

    try {
      const reward = JSON.parse(rawReward) as GemRewardData;

      sessionStorage.removeItem('prep-amigo:xp-reward');

      // Uncollapse sprint if collapsed so the reward node is in the DOM
      const [sprintId] = (reward.sourceKey || '').split(':');
      if (sprintId) {
        setCollapsedSprints((prev) => ({ ...prev, [sprintId]: false }));
      }

      // Start the header at the old XP total while the reward animation plays.
      setPendingXp(reward.xp);
      setGemReward(reward);
    } catch {
      sessionStorage.removeItem('prep-amigo:xp-reward');
    }
  }, []);


  useEffect(() => {
    getAssessments().then(setAssessments);
    refreshPreps().catch(console.error);
  }, [refreshPreps]);

  // Stable callback passed to the reward animation.
  const handleGemLand = useCallback((amount: number) => {
    setPendingXp((prev) => Math.max(0, prev - amount));
  }, []);

  const handleRewardComplete = useCallback(() => {
    setPendingXp(0);
    setGemReward(null);
  }, []);

  const toggleSprint = useCallback((sprintId: string) => {
    setCollapsedSprints((prev) => ({
      ...prev,
      [sprintId]: !prev[sprintId],
    }));
  }, []);

  const handleNodeClick = async (
    sprint: any,
    node: any,
    index: number,
    nodeStates: string[]
  ) => {
    if (nodeStates[index] === 'locked') return;

    if (!node?.isAssessment) {
      navigate(`/dashboard/${sprint.id}/${node.id}`);
      return;
    }

    const previousLevels = (sprint.levels || [])
      .slice(0, index)
      .filter((n: any) => !n.isAssessment);

    if (
      previousLevels.some((n: any) =>
        (n.days || []).some((day: any) => day.status !== 'done')
      )
    ) {
      setAssessmentError(
        `Complete the earlier levels in ${sprint.title} before starting ${node.title}.`
      );
      return;
    }

    const dayId = node.assessmentDay?.id || node.assessmentDay?._id;

    if (!dayId) {
      setAssessmentError(
        'This sprint does not have enough scheduled days to create that assessment.'
      );
      return;
    }

    setAssessmentError(null);

    navigate(
      `/assessment?sprintDayId=${encodeURIComponent(dayId)}&sprintId=${encodeURIComponent(
        sprint.id
      )}&level=${encodeURIComponent(node.title)}`
    );
  };

  const gamification = computeGamification(
    activePrep,
    activePrep?.learningContext?.progress,
    assessments
  );

  // Total shown in the header while gems are still flying.
  const displayedXp = Math.max(
    0,
    Math.round(gamification.xp - pendingXp)
  );

  const allDays = (activePrep?.roadmap?.sprints || []).flatMap(
    (s: any) => s.days || []
  );

  const totalDays =
    allDays.length || activePrep?.durationDays || 30;

  const completedCount = allDays.filter(
    (d: any) => d.status === 'done'
  ).length;

  const progressPct =
    totalDays > 0
      ? Math.round((completedCount / totalDays) * 100)
      : 0;

  const daysLeft = Math.max(0, totalDays - completedCount);
  const missedTasks = 0;

  const sprints = (activePrep?.roadmap?.sprints || []).map(
    (s: any, idx: number) => {
      const days = s.days || [];

      const levels = buildSprintLevelNodes(days).map((node) => {
        const dayId =
          (node.assessmentDay as any)?.id ||
          (node.assessmentDay as any)?._id;

        const assessment = node.isAssessment
          ? assessments.find((item: any) => {
            const matchesSprint =
              String(item.sprint_id) === String(s.id);

            const matchesNum =
              node.assessmentNumber &&
              item.assessment_number === node.assessmentNumber;

            if (matchesSprint && matchesNum) return true;

            if (dayId && item.covered_sprint_days) {
              return item.covered_sprint_days.some(
                (cd: any) =>
                  String(cd) === String(dayId) ||
                  String(cd?._id) === String(dayId)
              );
            }

            return false;
          })
          : undefined;

        return {
          ...node,
          status: node.isAssessment
            ? assessment?.is_completed
              ? 'completed'
              : 'unlocked'
            : node.days.every(
              (d: any) => d.status === 'done'
            )
              ? 'completed'
              : 'unlocked',
        };
      });

      return {
        id: s.id || `sprint-${idx + 1}`,
        title: s.title || `Sprint ${idx + 1}`,
        goal: s.focus || `Sprint ${idx + 1} preparation`,
        levels,
        days,
      };
    }
  );

  let globalNodeIndex = 0;

  const globalNodeStates = levelStates(
    sprints.flatMap((sprint: any) =>
      sprint.levels.map(
        (level: any) => level.status === 'completed'
      )
    )
  );

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      {/* Main scroll container */}
      <div className="flex-1 overflow-y-auto safe-area-bottom">
        <RevealStagger className="w-full px-6 md:px-12 py-6 md:py-8 space-y-8 pb-12">

          {assessmentError && (
            <Alert variant="warning" icon="warning">
              {assessmentError}
            </Alert>
          )}

          {/* Welcome */}
          <RevealStaggerItem>
            <Card
              variant="default"
              className="bg-lavender-100 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6"
            >
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-extrabold text-carbon-900 mb-2">
                  Welcome home!
                </h1>

                <p className="text-base md:text-lg text-carbon-700 font-medium max-w-xl">
                  {activePrep
                    ? `You're preparing for ${activePrep.learningContext?.targetRole ||
                    'your target role'
                    } at ${activePrep.learningContext?.companyInfo?.name ||
                    'your target company'
                    }.`
                    : 'Ready to kick off your preparation? PrepAmigo is ready to build your custom roadmap.'}
                </p>
              </div>

              <div className="shrink-0 flex flex-col gap-3">
                <div className="flex items-center gap-3">

                  {/* Progress */}
                  <Stat
                    label="Progress"
                    value={`${progressPct}%`}
                  />

                  {/* Total XP */}
                  <div data-xp-target>
                    <Stat
                      label="Total XP"
                      value={displayedXp.toLocaleString()}
                      icon={
                        <div
                          data-xp-icon
                          className="relative flex items-center justify-center w-8 h-8"
                        >
                          <div
                            data-xp-icon-glow
                            className="
                              absolute inset-0
                              rounded-full
                              bg-[#C3955B]/60
                              blur-md
                              opacity-0
                              pointer-events-none
                            "
                          />

                          <img
                            src="/assets/icons/star.png"
                            alt=""
                            className="
                              relative z-10
                              w-7 h-7
                              object-contain
                              drop-shadow-[0_0_6px_rgba(195,149,91,0.4)]
                            "
                          />
                        </div>
                      }
                    />
                  </div>

                  {/* AI Credits */}
                  <Stat
                    label="AI Credits"
                    value={gamification.aiCredits.toLocaleString()}
                    icon={
                      <div className="flex items-center justify-center w-8 h-8">
                        <img
                          src="/assets/icons/creds.png"
                          alt=""
                          className="w-7 h-7 object-contain"
                        />
                      </div>
                    }
                  />
                </div>

                <div className="bg-surface border border-border rounded-2xl px-4 py-3 flex items-center gap-2">
                  <Icon name="calendar" className="text-chrome" />
                  <span className="font-bold text-carbon-900">
                    {daysLeft} days left
                  </span>
                  <span className="text-sm text-carbon-500">
                    in your roadmap
                  </span>
                </div>
              </div>

              <div className="hidden sm:flex shrink-0 items-center justify-center">
                <Mascot
                  size="lg"
                  variant="working.png"
                  className="bg-surface border border-border rounded-full p-2"
                />
              </div>
            </Card>
          </RevealStaggerItem>

          <div className="grid lg:grid-cols-5 gap-8">

            {/* Sprints */}
            <RevealStaggerItem className="space-y-5 lg:col-span-4">
              <div className="flex justify-between items-end">
                <h2 className="text-xl font-bold text-carbon-900">
                  Sprints
                </h2>

                <Link
                  to="/roadmap"
                  className="text-sm text-chrome font-bold hover:underline flex items-center gap-1"
                >
                  View Full Roadmap
                  <Icon name="arrow-forward" />
                </Link>
              </div>

              {sprints.length === 0 ? (
                <Card
                  variant="default"
                  className="p-8 text-center flex flex-col items-center gap-3"
                >
                  <Mascot size="lg" variant="working.png" />

                  <h3 className="text-lg font-bold text-carbon-900">
                    No active sprints
                  </h3>

                  <p className="text-sm text-carbon-500">
                    Start your preparation in chat to generate your study plan.
                  </p>

                  <Link to="/dashboard/chat">
                    <Button>Create Plan in Chat</Button>
                  </Link>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {sprints.map((sprint: any) => {
                    const nodeStates = globalNodeStates.slice(
                      globalNodeIndex,
                      globalNodeIndex + sprint.levels.length
                    );

                    globalNodeIndex += sprint.levels.length;

                    const isSprintComplete =
                      sprint.levels.length > 0 &&
                      sprint.levels.every(
                        (level: any) =>
                          level.status === 'completed'
                      );

                    const isCollapsed =
                      isSprintComplete &&
                      collapsedSprints[sprint.id] === true;

                    return (
                      <Card
                        key={sprint.id}
                        variant="default"
                        className="p-5 flex flex-col gap-4"
                      >
                        {/* Sprint Header */}
                        <button
                          type="button"
                          onClick={() => {
                            if (isSprintComplete) {
                              toggleSprint(sprint.id);
                            }
                          }}
                          className={`
                            w-full flex justify-between items-center gap-3
                            text-left
                            ${isSprintComplete
                              ? 'cursor-pointer hover:bg-surface-muted/40 rounded-xl -m-2 p-2 transition-colors'
                              : 'cursor-default'
                            }
                          `}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-lg text-carbon-900">
                                {sprint.title}
                              </h3>

                              {isSprintComplete && (
                                <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                  Complete
                                </span>
                              )}
                            </div>

                            <p className="text-sm text-carbon-500">
                              {sprint.goal}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs font-bold bg-lavender-100 border border-border text-chrome px-3 py-1 rounded-full">
                              {sprint.levels.length} Levels
                            </span>

                            {isSprintComplete && (
                              <Icon
                                name={
                                  isCollapsed
                                    ? 'chevron-down'
                                    : 'chevron-up'
                                }
                                className="text-carbon-500 text-xl"
                              />
                            )}
                          </div>
                        </button>

                        {/* Sprint Map */}
                        {!isCollapsed && (
                          <div className="relative w-full bg-lavender-50 rounded-2xl overflow-hidden flex items-center">
                            <SprintMap
                              sprintId={sprint.id}
                              nodeStates={nodeStates}
                              levelIds={sprint.levels.map(
                                (l: any) => l.id
                              )}
                              levelTitles={sprint.levels.map(
                                (l: any) => l.title
                              )}
                              onNodeClick={(
                                _levelId,
                                index
                              ) =>
                                void handleNodeClick(
                                  sprint,
                                  sprint.levels[index],
                                  index,
                                  nodeStates
                                )
                              }
                              className="border-none shadow-none bg-transparent"
                            />
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </RevealStaggerItem>

            {/* Quick links */}
            <RevealStaggerItem className="space-y-4 lg:col-span-1">

              {missedTasks > 0 && (
                <Alert variant="warning" icon="warning">
                  <div className="flex items-center justify-between gap-3 w-full">
                    <div>
                      <h4 className="font-bold text-beige-600">
                        You have {missedTasks} missed task
                      </h4>

                      <p className="text-sm opacity-80">
                        PrepAmigo can reschedule this for you.
                      </p>
                    </div>

                    <Link to="/dashboard/chat">
                      <Button size="sm">
                        Reschedule
                      </Button>
                    </Link>
                  </div>
                </Alert>
              )}

              <h2 className="text-xl font-bold text-carbon-900">
                Quick Links
              </h2>

              {QUICK_LINKS.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="block"
                >
                  <Card
                    variant="default"
                    className="rounded-3xl p-5 flex flex-row gap-4 hover:scale-[1.02] transition-transform"
                  >
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-lavender-100 text-chrome">
                      <Icon
                        name={l.icon}
                        className="text-2xl"
                      />
                    </div>

                    <div>
                      <h4 className="font-bold text-lg text-carbon-900">
                        {l.title}
                      </h4>

                      <p className="text-sm text-carbon-500">
                        {l.sub}
                      </p>
                    </div>
                  </Card>
                </Link>
              ))}

              {!activePrep && (
                <Card
                  variant="default"
                  className="bg-lavender-100 rounded-3xl p-6 mt-4 flex flex-col"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-xl text-carbon-900">
                      Ask PrepAmigo
                    </h3>

                    <Mascot
                      size="md"
                      variant="nosy.png"
                      className="bg-chrome border border-border rounded-full"
                    />
                  </div>

                  <p className="text-sm text-carbon-500 mb-5">
                    Need to change your plan or practice a specific topic?
                  </p>

                  <Link
                    to="/dashboard/chat"
                    className="block w-full"
                  >
                    <div className="w-full bg-surface border border-border rounded-full py-3 px-4 text-carbon-700 hover:bg-surface-muted transition-colors flex justify-between items-center">
                      <span className="text-sm font-medium">
                        Message PrepAmigo...
                      </span>

                      <Icon name="arrow-up" />
                    </div>
                  </Link>
                </Card>
              )}
            </RevealStaggerItem>
          </div>

          {/* XP reward animation */}
          <GemRewardAnimation
            reward={gemReward}
            onGemLand={handleGemLand}
            onComplete={handleRewardComplete}
          />
        </RevealStagger>
      </div>
    </div>
  );
}