import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';
import { useAppContext } from '../context/AppContext';
import { plansApi } from '../lib/api/plans';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Mascot } from '../components/ui/Mascot';
import { DayTaskCard } from '../components/ui/DayTaskCard';
import type { ResourceItem } from '../components/ui/DayTaskCard';
import { cn } from '../utils/utils';
import { buildSprintLevelNodes } from '../lib/sprintLevels';

type StatusFilter = 'All' | 'Pending' | 'Done';

function formatReferenceType(type?: string): string {
  if (!type) return 'Article';
  const lower = type.toLowerCase();
  if (lower.includes('video') || lower.includes('youtube')) return 'Video';
  if (lower.includes('book') || lower.includes('paper')) return 'Book';
  if (lower.includes('doc')) return 'Documentation';
  if (lower.includes('problem') || lower.includes('code') || lower.includes('leetcode')) return 'Problem';
  if (lower.includes('course') || lower.includes('tutorial')) return 'Course';
  return 'Article';
}

function buildResources(day: any): ResourceItem[] {
  const res: ResourceItem[] = [
    ...day.objectives.map((obj: string, i: number) => ({ id: `obj-${day._id}-${i}`, type: 'Note', title: obj, url: '#' })),
    ...day.references.map((r: any, i: number) => ({
      id: `ref-${day._id}-${i}`,
      type: formatReferenceType(r.type),
      title: r.title || r.url,
      url: r.url,
    })),
  ];
  if (day.references.length === 0) {
    res.push({ id: `vid-${day._id}`, type: 'Video', title: `Watch ${day.topic_title} Tutorial`, url: 'https://youtube.com' });
  }
  return res;
}

/** One row of the line hierarchy. `top` = y of the branch (px), i.e. the midpoint of the row's header. */
function TreeItem({ last, top, delay = 0, done = false, children }: {
  last: boolean; top: number; delay?: number; done?: boolean; children: React.ReactNode;
}) {
  return (
    <li className={cn('relative pl-8', !last && 'pb-3')}>
      <motion.span
        aria-hidden
        className="absolute left-0 top-0 w-0.5 rounded-full bg-chrome-accent origin-top"
        style={{ height: last ? top : '100%' }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay, duration: 0.25, ease: 'easeOut' }}
      />
      <motion.span
        aria-hidden
        className="absolute left-0 w-6 h-0.5 rounded-full bg-chrome-accent origin-left"
        style={{ top: top - 1 }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: delay + 0.12, duration: 0.2, ease: 'easeOut' }}
      />
      {/* dot at the end of the branch */}
      <span aria-hidden className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: 24, top }}>
        <motion.span
          className={cn(
            'block w-2.5 h-2.5 rounded-full border-2 transition-colors',
            done ? 'bg-chrome border-chrome' : 'bg-surface border-chrome-accent'
          )}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: delay + 0.3, type: 'spring', stiffness: 400, damping: 18 }}
        />
      </span>
      <motion.div
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: delay + 0.15, duration: 0.25 }}
      >
        {children}
      </motion.div>
    </li>
  );
}

export function Roadmap() {
  const navigate = useNavigate();
  const { preps, activePrep, setActivePrepId, loadingPreps } = useAppContext();

  const mappedData = useMemo(() => {
    if (!activePrep) return { sprints: [], sprintDays: [] };
    const sprints = (activePrep.roadmap?.sprints || []).map((s, idx) => ({
      _id: s.id,
      sprint_number: idx + 1,
      sprint_name: s.title || `Sprint ${idx + 1}`,
    }));

    const sprintDays = (activePrep.roadmap?.sprints || []).flatMap((s) =>
      (s.days || []).map((d: any) => ({
        _id: d.id || `${s.id}-day-${d.dayNumber}`,
        sprint_id: s.id,
        day_number: d.dayNumber,
        scheduled_date: d.date,
        topic_title: d.topic,
        topic_description: d.objective || '',
        objectives: d.objectives && d.objectives.length > 0 ? d.objectives : [d.objective].filter(Boolean),
        estimated_minutes: d.estimatedMinutes || 60,
        references: (d.rawReferences || []).map((r: any) => ({
          title: r.title || r.url,
          url: r.url,
          type: r.type,
          description: r.description,
        })),
        status: (d.status === 'done' ? 'completed' : d.status === 'today' ? 'in_progress' : 'pending') as
          | 'completed'
          | 'in_progress'
          | 'pending',
      }))
    );
    return { sprints, sprintDays };
  }, [activePrep]);

  const [localSprintDays, setLocalSprintDays] = useState<any[]>([]);
  useEffect(() => setLocalSprintDays(mappedData.sprintDays), [mappedData.sprintDays]);

  const sprints = mappedData.sprints;
  const sprintDays = localSprintDays;

  const [openSprints, setOpenSprints] = useState<Record<string, boolean>>({});
  const [openLevels, setOpenLevels] = useState<Record<string, boolean>>({}); // key: `${sprintId}:${levelId}`
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [assessmentError, setAssessmentError] = useState<string | null>(null);

  useEffect(() => {
    if (sprints.length > 0 && Object.keys(openSprints).length === 0) {
      setOpenSprints({ [sprints[0]._id]: true });
    }
  }, [sprints]);

  const toggleProblemSolved = (dayId: string) => {
    const targetDay = localSprintDays.find((day) => day._id === dayId);
    if (targetDay && targetDay.status !== 'completed') {
      const sprintIndex = sprints.findIndex((sprint) => sprint._id === targetDay.sprint_id);
      const earlierSprintIncomplete = sprints.slice(0, sprintIndex).some((sprint) =>
        localSprintDays.some((day) => day.sprint_id === sprint._id && day.status !== 'completed')
      );
      const daysInSprint = localSprintDays.filter((day) => day.sprint_id === targetDay.sprint_id);
      const nodes = buildSprintLevelNodes(daysInSprint);
      const targetLevelIndex = nodes.findIndex((node) => node.days.some((day: any) => day._id === dayId));
      const earlierLevelIncomplete = nodes
        .slice(0, targetLevelIndex)
        .filter((node) => !node.isAssessment)
        .some((node) => node.days.some((day: any) => day.status !== 'completed'));
      if (earlierSprintIncomplete || earlierLevelIncomplete) {
        setAssessmentError(
          earlierSprintIncomplete
            ? 'Complete every level in the previous sprint before starting this one.'
            : 'Complete the earlier level topics in this sprint first.',
        );
        return;
      }
      setAssessmentError(null);
    }

    setLocalSprintDays((prev) =>
      prev.map((d) => (d._id === dayId ? { ...d, status: d.status === 'completed' ? 'pending' : 'completed' } : d))
    );
    if (dayId && !dayId.includes('day-')) {
      void plansApi.completeDay(dayId).catch((err) => console.warn('[Roadmap] Could not mark day complete on backend:', err));
    }
  };

  // Levels are built from ALL days first, then filtered, so "Level 2" stays Level 2 while searching
  // (and matches the level ids used by /dashboard/:sprintId/:levelId).
  const filteredRoadmap = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return sprints
      .map((sprint) => {
        const days = sprintDays.filter((d) => d.sprint_id === sprint._id);
        const allLevels = buildSprintLevelNodes(days).map((node) => ({
          ...node,
          number: node.assessmentNumber ?? Number(node.id.replace('level-', '')),
          allDays: node.days,
          id: node.id,
          isAssessment: node.isAssessment,
          title: node.title,
        }));
        const firstOpenId = allLevels.find((l) => l.allDays.some((d: any) => d.status !== 'completed'))?.id;

        const levels = allLevels
          .map((l) => ({
            ...l,
            days: l.allDays.filter((p: any) => {
              const matchesSearch =
                p.topic_title.toLowerCase().includes(q) || p.topic_description.toLowerCase().includes(q);
              const matchesStatus =
                statusFilter === 'All' ? true : statusFilter === 'Done' ? p.status === 'completed' : p.status !== 'completed';
              return matchesSearch && matchesStatus;
            }),
          }))
          .filter((l) => l.isAssessment || l.days.length > 0);

        return { ...sprint, levels, firstOpenId, total: days.length, done: days.filter((d) => d.status === 'completed').length };
      })
      .filter((s) => s.levels.length > 0);
  }, [sprints, sprintDays, searchQuery, statusFilter]);

  const isLevelOpen = (sprintId: string, levelId: string, firstOpenId?: string) =>
    openLevels[`${sprintId}:${levelId}`] ?? levelId === firstOpenId;

  const toggleLevel = (sprintId: string, levelId: string, firstOpenId?: string) =>
    setOpenLevels((p) => ({ ...p, [`${sprintId}:${levelId}`]: !isLevelOpen(sprintId, levelId, firstOpenId) }));

  const anySprintOpen = Object.values(openSprints).some(Boolean);
  const handleToggleExpandAll = () => {
    const open = !anySprintOpen;
    const s: Record<string, boolean> = {};
    const l: Record<string, boolean> = {};
    sprints.forEach((sp) => (s[sp._id] = open));
    filteredRoadmap.forEach((sp) => sp.levels.forEach((lv) => (l[`${sp._id}:${lv.id}`] = open)));
    setOpenSprints(s);
    setOpenLevels(l);
  };

  const totalCount = sprintDays.length;
  const solvedCount = sprintDays.filter((p) => p.status === 'completed').length;
  const overallPercentage = totalCount > 0 ? Math.round((solvedCount / totalCount) * 100) : 0;
  const nextUnsolved = sprintDays.find((p) => p.status !== 'completed');

  // open the sprint + level that holds the next day, then scroll to it
  const goToNext = () => {
    if (!nextUnsolved) return;
    const inSprint = sprintDays.filter((d) => d.sprint_id === nextUnsolved.sprint_id);
    const level = buildSprintLevelNodes(inSprint).find((node) => node.days.some((d: any) => d._id === nextUnsolved._id));
    const levelId = level?.id || 'level-1';
    setOpenSprints((p) => ({ ...p, [nextUnsolved.sprint_id]: true }));
    setOpenLevels((p) => ({ ...p, [`${nextUnsolved.sprint_id}:${levelId}`]: true }));
    setTimeout(() => {
      document.getElementById(`prob-${nextUnsolved._id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 350);
  };

  const handleAssessmentOpen = async (sprint: any, level: any, levelIndex: number) => {
    const previousLevels = sprint.levels
      .slice(0, levelIndex)
      .filter((node: any) => !node.isAssessment);
    if (previousLevels.some((node: any) => node.allDays.some((day: any) => day.status !== 'completed'))) {
      setAssessmentError(`Complete the earlier levels in ${sprint.sprint_name} before starting ${level.title}.`);
      return;
    }

    const dayId = level.assessmentDay?.id || level.assessmentDay?._id;
    if (!dayId) {
      setAssessmentError('This sprint does not have enough scheduled days to create that assessment.');
      return;
    }

    setAssessmentError(null);
    navigate(
      `/assessment?sprintDayId=${encodeURIComponent(dayId)}&sprintId=${encodeURIComponent(sprint._id)}&level=${encodeURIComponent(level.title)}`
    );
  };

  if (loadingPreps) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-bg gap-3">
        <Mascot variant="working.gif" size="lg" style={{ width: 120, height: 120 }} />
        <p className="text-sm font-semibold text-carbon-500">Loading your roadmap...</p>
      </div>
    );
  }

  if (!activePrep || sprints.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-bg text-center">
        <Mascot variant="dissapointed.png" size="xl" style={{ width: 160, height: 160 }} />
        <h2 className="text-2xl font-bold text-carbon-900 mt-4 mb-2">No Active Roadmap</h2>
        <p className="text-sm text-carbon-500 max-w-md mb-6">
          You don't have an active roadmap yet. Create your personalized preparation plan by chatting with our agent.
        </p>
        <Link to="/dashboard/chat">
          <Button className="gap-2">
            Start Prep in Chat <Icon name="arrow-forward-outline" />
          </Button>
        </Link>
      </div>
    );
  }

  const planTitle = activePrep.title || 'Preparation Roadmap';
  const roleName = activePrep.learningContext?.targetRole || 'Target Role';
  const companyName = activePrep.learningContext?.companyInfo?.name || 'Target Company';

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <div className="flex-1 overflow-y-auto safe-area-bottom">
        <div className="w-full px-6 md:px-12 py-6 md:py-8 space-y-6 pb-16">

          {/* Header */}

          <Card variant="default" className="bg-lavender-100 rounded-3xl p-6 md:p-8 flex items-center gap-6">
            <div className="flex-1 min-w-0 space-y-4">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 -ml-3 font-bold text-chrome"
                onClick={() => navigate('/dashboard')}
              >
                <Icon name="arrow-back" /> Dashboard
              </Button>

              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-carbon-900 tracking-tight">{planTitle}</h1>
                <p className="text-sm md:text-base text-carbon-700 font-medium mt-1">
                  {roleName} at {companyName}
                </p>
              </div>

              <div className="max-w-sm space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-carbon-700">
                  <span>{solvedCount} / {totalCount} days</span>
                  <span>{overallPercentage}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-surface overflow-hidden">
                  <motion.div
                    className="h-full bg-chrome rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${overallPercentage}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {nextUnsolved && (
                <Button size="sm" onClick={goToNext} className="gap-2">
                  Up next: Day {nextUnsolved.day_number} <Icon name="arrow-down" className="text-xs" />
                </Button>
              )}
            </div>

            <div className="hidden sm:flex shrink-0 w-36 h-36 rounded-full bg-surface border border-border items-center justify-center">
              <Mascot variant="Motivated.png" size="lg" />
            </div>
          </Card>

          <div className='max-w-7xl mx-auto space-y-4'>
            {/* Multi-prep switcher */}
            {preps.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {preps.map((p) => (
                  <Button
                    key={p.id}
                    size="sm"
                    variant={p.id === activePrep.id ? 'primary' : 'outline'}
                    onClick={() => setActivePrepId(p.id)}
                    className="shrink-0 border"
                  >
                    {p.title || p.learningContext?.companyInfo?.name || 'Prep'}
                  </Button>
                ))}
              </div>
            )}

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-carbon-500 text-sm z-10" />
                <Input
                  type="text"
                  placeholder="Search topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 rounded-full"
                />
              </div>

              <div className="flex items-center gap-1 bg-surface border border-border rounded-full p-1">
                {(['All', 'Pending', 'Done'] as StatusFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={cn(
                      'px-4 h-8 rounded-full text-xs font-bold transition-colors',
                      statusFilter === f ? 'bg-chrome text-on-chrome' : 'text-carbon-500 hover:text-carbon-900'
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <Button
                variant="outline"
                onClick={handleToggleExpandAll}
                title={anySprintOpen ? 'Collapse all' : 'Expand all'}
                aria-label={anySprintOpen ? 'Collapse all' : 'Expand all'}
                className="w-10 px-0 border shrink-0"
              >
                <Icon name={anySprintOpen ? 'contract-outline' : 'expand-outline'} />
              </Button>
            </div>

            {/* Sprints */}
            <div className="space-y-4">
              {assessmentError && <p role="alert" className="rounded-xl border border-danger-600/20 bg-danger-100 px-4 py-3 text-sm font-medium text-danger-600">{assessmentError}</p>}
              {filteredRoadmap.map((sprint) => {
                const isOpen = openSprints[sprint._id] ?? false;
                const sprintDone = sprint.total > 0 && sprint.done === sprint.total;
                const pct = sprint.total ? (sprint.done / sprint.total) * 100 : 0;

                return (
                  <Card key={sprint._id} variant="default" className="rounded-3xl">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenSprints((p) => ({ ...p, [sprint._id]: !isOpen }))}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 md:p-5 text-left transition-colors",
                        "sticky top-0 z-10 bg-surface/95 backdrop-blur-md",
                        isOpen ? "rounded-t-3xl border-b border-border shadow-2xs hover:bg-lavender-50/80" : "rounded-3xl hover:bg-lavender-50"
                      )}
                    >
                      <span
                        className={cn(
                          'w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 font-extrabold',
                          sprintDone ? 'bg-chrome text-on-chrome' : 'bg-lavender-100 text-chrome'
                        )}
                      >
                        {sprintDone ? <Icon name="checkmark" /> : sprint.sprint_number}
                      </span>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base md:text-lg text-carbon-900 truncate">{sprint.sprint_name}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <div className="w-24 md:w-40 h-1.5 rounded-full bg-lavender-100 overflow-hidden">
                            <div className="h-full bg-chrome rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-carbon-500">{sprint.done} / {sprint.total}</span>
                        </div>
                      </div>

                      <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.25 }} className="text-xl text-carbon-500 flex">
                        <Icon name="chevron-down" />
                      </motion.span>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          key="sprint-body"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                          className="overflow-hidden border-t border-border bg-lavender-50 rounded-b-3xl"
                        >
                          {/* sprint → levels */}
                          <ul className="p-4 md:p-6 ml-1">
                            {sprint.levels.map((level, li) => {
                              const open = isLevelOpen(sprint._id, level.id, sprint.firstOpenId);
                              const doneCount = level.allDays.filter((d: any) => d.status === 'completed').length;
                              const levelComplete = !level.isAssessment && doneCount === level.allDays.length;

                              return (
                                <TreeItem key={level.id} top={20} done={levelComplete} last={li === sprint.levels.length - 1} delay={li * 0.08}>
                                  <button
                                    type="button"
                                    aria-expanded={open}
                                    onClick={() => {
                                      if (level.isAssessment) {
                                        void handleAssessmentOpen(sprint, level, li);
                                      } else {
                                        toggleLevel(sprint._id, level.id, sprint.firstOpenId);
                                      }
                                    }}
                                    className="w-full h-10 flex items-center gap-3 rounded-xl px-2 -mx-2 text-left hover:bg-lavender-100 transition-colors"
                                  >
                                    <span
                                      className={cn(
                                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0',
                                        levelComplete ? 'bg-chrome text-on-chrome' : 'bg-surface border border-border text-chrome'
                                      )}
                                    >
                                      {levelComplete ? <Icon name="checkmark" className="text-xs" /> : level.isAssessment ? <Icon name="help-circle" className="text-xs" /> : level.number}
                                    </span>
                                    <span className="font-bold text-sm text-carbon-900">{level.title}</span>
                                    {level.isAssessment ? (
                                      <span className="ml-auto text-xs font-semibold text-chrome">Start assessment <Icon name="arrow-forward" /></span>
                                    ) : (
                                      <>
                                        <span className="text-xs font-semibold text-carbon-500">{doneCount} / {level.allDays.length}</span>
                                        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }} className="ml-auto text-lg text-carbon-500 flex">
                                          <Icon name="chevron-down" />
                                        </motion.span>
                                      </>
                                    )}
                                  </button>

                                  {/* level → days */}
                                  {!level.isAssessment && <AnimatePresence initial={false}>
                                    {open && (
                                      <motion.div
                                        key="level-body"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                                        className="overflow-hidden"
                                      >
                                        <ul className="pt-3">
                                          {level.days.map((day: any, di: number) => (
                                            <TreeItem key={day._id} top={28} done={day.status === 'completed'} last={di === level.days.length - 1} delay={0.05 + di * 0.08}>
                                              <div id={`prob-${day._id}`}>
                                                <DayTaskCard
                                                  variant="compact"
                                                  title={`Day ${day.day_number}: ${day.topic_title}`}
                                                  completed={day.status === 'completed'}
                                                  resources={buildResources(day)}
                                                  onToggleComplete={() => toggleProblemSolved(day._id)}
                                                />
                                              </div>
                                            </TreeItem>
                                          ))}
                                        </ul>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>}
                                </TreeItem>
                              );
                            })}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                );
              })}

              {filteredRoadmap.length === 0 && (
                <Card variant="default" className="p-10 text-center flex flex-col items-center gap-3">
                  <Mascot variant="nosy.png" size="lg" style={{ width: 110, height: 110 }} />
                  <p className="font-bold text-carbon-900">No days match your filters</p>
                  <p className="text-sm text-carbon-500">Try a different search or status.</p>
                </Card>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}