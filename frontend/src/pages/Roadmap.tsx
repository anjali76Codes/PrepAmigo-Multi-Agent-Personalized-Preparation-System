import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '../components/ui/Icon';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { plansApi } from '../lib/api/plans';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Mascot } from '../components/ui/Mascot';
import { DayTaskCard } from '../components/ui/DayTaskCard';
import type { ResourceItem } from '../components/ui/DayTaskCard';

function formatReferenceType(type?: string): string {
  if (!type) return "Article";
  const lower = type.toLowerCase();
  if (lower.includes("video") || lower.includes("youtube")) return "Video";
  if (lower.includes("book") || lower.includes("paper")) return "Book";
  if (lower.includes("doc")) return "Documentation";
  if (lower.includes("problem") || lower.includes("code") || lower.includes("leetcode")) return "Problem";
  if (lower.includes("course") || lower.includes("tutorial")) return "Course";
  return "Article";
}

export function Roadmap() {
  const { preps, activePrep, setActivePrepId, loadingPreps } = useAppContext();

  // Map sprints and sprintDays from real activePrep
  const mappedData = useMemo(() => {
    if (!activePrep) return { sprints: [], sprintDays: [] };
    const sprints = (activePrep.roadmap?.sprints || []).map((s, idx) => ({
      _id: s.id,
      sprint_number: idx + 1,
      sprint_name: s.title || `Sprint ${idx + 1}`,
      total_days: s.days?.length || 0,
      status: s.days?.every((d: any) => d.status === 'done') ? ('completed' as const) : ('in_progress' as const),
    }));

    const sprintDays = (activePrep.roadmap?.sprints || []).flatMap((s) =>
      (s.days || []).map((d: any) => ({
        _id: d.id || `${s.id}-day-${d.dayNumber}`,
        sprint_id: s.id,
        day_number: d.dayNumber,
        scheduled_date: d.date,
        topic_title: d.topic,
        topic_description: d.objective || '',
        objectives: (d.objectives && d.objectives.length > 0) ? d.objectives : [d.objective].filter(Boolean),
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

  useEffect(() => {
    setLocalSprintDays(mappedData.sprintDays);
  }, [mappedData.sprintDays]);

  const sprints = mappedData.sprints;
  const sprintDays = localSprintDays;

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (sprints.length > 0 && Object.keys(openCategories).length === 0) {
      setOpenCategories({ [sprints[0]._id]: true });
    }
  }, [sprints]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Solved' | 'Unsolved'>('All');

  // Toggle Category Accordion
  const toggleCategory = (catId: string) => {
    setOpenCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  // Toggle Problem Solved
  const toggleProblemSolved = (dayId: string) => {
    setLocalSprintDays((prev) =>
      prev.map((d) =>
        d._id === dayId ? { ...d, status: d.status === 'completed' ? 'pending' : 'completed' } : d
      )
    );
    if (dayId && !dayId.includes('day-')) {
      void plansApi.completeDay(dayId).catch((err) => {
        console.warn('[Roadmap] Could not mark day complete on backend:', err);
      });
    }
  };

  // Expand / Collapse All
  const handleToggleExpandAll = () => {
    const allOpen = Object.values(openCategories).every(Boolean);
    const newCatState: Record<string, boolean> = {};
    sprints.forEach((cat) => {
      newCatState[cat._id] = !allOpen;
    });
    setOpenCategories(newCatState);
  };

  // Flattened problem statistics calculation
  const totalCount = sprintDays.length;
  const solvedCount = sprintDays.filter((p) => p.status === 'completed').length;
  const overallPercentage = totalCount > 0 ? Math.round((solvedCount / totalCount) * 100) : 0;

  // Next unsolved problem
  const nextUnsolved = sprintDays.find((p) => p.status !== 'completed');

  // Filtered categories
  const filteredRoadmap = useMemo(() => {
    return sprints
      .map((sprint) => {
        const days = sprintDays.filter((d) => d.sprint_id === sprint._id);

        const filteredDays = days.filter((p) => {
          const matchesSearch =
            p.topic_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.topic_description.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesStatus =
            statusFilter === 'All'
              ? true
              : statusFilter === 'Solved'
                ? p.status === 'completed'
                : statusFilter === 'Unsolved'
                  ? p.status !== 'completed'
                  : true;

          return matchesSearch && matchesStatus;
        });

        // Distribute into levels (3 days per level)
        const daysPerLevel = 3;
        const lvlCount = Math.ceil(filteredDays.length / daysPerLevel);
        const levels = Array.from({ length: lvlCount }).map((_, i) => {
          return {
            id: `level-${i + 1}`,
            title: `Level ${i + 1}`,
            days: filteredDays.slice(i * daysPerLevel, (i + 1) * daysPerLevel),
          };
        });

        return { ...sprint, filteredDays, levels };
      })
      .filter((sprint) => sprint.filteredDays.length > 0);
  }, [sprints, sprintDays, searchQuery, statusFilter]);

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
      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 safe-area-bottom">
        <div className="max-w-6xl mx-auto space-y-6 pb-16">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs font-semibold text-carbon-500">
            <Link to="/dashboard" className="hover:text-carbon-900 transition-colors">Prep Hub</Link>
            <span>/</span>
            <span className="text-carbon-900">{planTitle}</span>
          </div>

          {/* Multi-prep Selector if multiple preps exist */}
          {preps.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-xs font-bold text-carbon-500 uppercase tracking-wider shrink-0 mr-1">
                Your Preps:
              </span>
              {preps.map((p) => {
                const isSelected = p.id === activePrep.id;
                return (
                  <Button
                    key={p.id}
                    size="sm"
                    variant={isSelected ? 'primary' : 'outline'}
                    onClick={() => setActivePrepId(p.id)}
                    className="shrink-0 border"
                  >
                    {p.title || `${p.learningContext?.companyInfo?.name || 'Prep'}`}
                  </Button>
                );
              })}
            </div>
          )}

          {/* Header Card */}
          <Card variant="default" className="bg-lavender-100 rounded-3xl p-6 md:p-8 flex flex-col lg:flex-row justify-between items-center gap-8">

            {/* Left: mascot + description */}
            <div className="flex items-center gap-6 max-w-2xl">
              <div className="hidden sm:flex shrink-0 w-32 h-32 rounded-full bg-surface border border-border items-center justify-center">
                <Mascot variant="Motivated.png" size="xl" style={{ width: 110, height: 110 }} />
              </div>

              <div className="space-y-3">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-carbon-900 tracking-tight">
                  {planTitle}
                </h1>
                <p className="text-sm md:text-base text-carbon-700 leading-relaxed">
                  Role: {roleName} at {companyName}. A comprehensive preparation plan organized into sprints to tackle coding, system design, and behavioral questions.
                </p>

                <div className="flex items-center gap-3 text-xs font-semibold text-carbon-500">
                  <span className="flex items-center gap-1.5 text-chrome">
                    <span className="w-2 h-2 rounded-full bg-chrome inline-block animate-pulse" />
                    Total {activePrep.durationDays} Days
                  </span>
                  <span>•</span>
                  <span>{sprints.length} Sprints</span>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {nextUnsolved && (
                    <Button
                      size="sm"
                      onClick={() => {
                        const el = document.getElementById(`prob-${nextUnsolved._id}`);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                      className="gap-2"
                    >
                      Up next : Day {nextUnsolved.day_number}
                      <Icon name="arrow-down" className="text-xs" />
                    </Button>
                  )}

                  <Link to="/dashboard/chat">
                    <Button size="sm" variant="outline" className="gap-2 border">
                      <Icon name="sparkles" className="text-xs" />
                      Plan with PrepAmigo →
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Right: overall progress */}
            <div className="bg-surface border border-border rounded-2xl p-5 md:p-6 w-full lg:w-96 shrink-0 space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-carbon-500">
                <span>Overall Progress</span>
                <Icon name="ribbon" className="text-lg text-beige-500" />
              </div>

              <div className="flex items-baseline gap-3">
                <span className="text-3xl md:text-4xl font-extrabold text-carbon-900">{overallPercentage} %</span>
                <span className="text-xs font-bold text-carbon-500">{solvedCount} / {totalCount} days completed</span>
              </div>

              <div className="w-full h-2.5 rounded-full bg-lavender-100 overflow-hidden">
                <motion.div
                  className="h-full bg-chrome rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${overallPercentage}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          </Card>

          {/* Filter & Search Toolbar */}
          <Card variant="default" className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-carbon-500 text-sm z-10" />
              <Input
                type="text"
                placeholder="Search topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-full"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="h-10 px-4 bg-surface border border-border rounded-full text-xs font-bold text-carbon-700 outline-none cursor-pointer hover:bg-lavender-100 focus-visible:ring-2 focus-visible:ring-navy-700"
              >
                <option value="All">All Status</option>
                <option value="Solved">Completed Only</option>
                <option value="Unsolved">Pending Only</option>
              </select>

              <Button
                variant="outline"
                size="md"
                onClick={handleToggleExpandAll}
                title="Expand / Collapse All"
                aria-label="Expand or collapse all sprints"
                className="w-10 px-0 border"
              >
                <Icon name="layers" className="text-sm" />
              </Button>
            </div>
          </Card>

          {/* Hierarchical Roadmap Tree Accordion */}
          <div className="space-y-4">
            {filteredRoadmap.map((sprint) => {
              const catSolved = sprint.filteredDays.filter(p => p.status === 'completed').length;
              const catTotal = sprint.filteredDays.length;
              const isOpen = openCategories[sprint._id] ?? false;

              return (
                <Card key={sprint._id} variant="default" className="rounded-3xl overflow-hidden">
                  {/* Sprint Header */}
                  <div
                    onClick={() => toggleCategory(sprint._id)}
                    className="flex items-center justify-between p-4 md:p-5 cursor-pointer hover:bg-lavender-50 transition-colors select-none"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-lavender-100 border border-border text-chrome flex items-center justify-center shrink-0">
                        <Icon name={isOpen ? "chevron-down" : "chevron-forward"} className="text-sm" />
                      </span>
                      <h3 className="text-base md:text-lg font-bold text-carbon-900">Sprint {sprint.sprint_number}: {sprint.sprint_name}</h3>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-carbon-500">{catSolved} / {catTotal}</span>
                      <div className="w-16 md:w-24 h-2 rounded-full bg-lavender-100 overflow-hidden">
                        <div
                          className="h-full bg-chrome rounded-full transition-all"
                          style={{ width: `${catTotal ? (catSolved / catTotal) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sprint Content */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-border bg-lavender-50"
                      >
                        <div className="p-3 md:p-5 space-y-6">

                          {sprint.levels.map(level => (
                            <div key={level.id} className="space-y-3">
                              <h4 className="text-sm font-bold text-carbon-900 pl-3 border-l-4 border-chrome">
                                {level.title}
                              </h4>
                              <div className="space-y-3 pl-4">
                                {level.days.map((problem) => {
                                  const resources: ResourceItem[] = [
                                    ...problem.objectives.map((obj: string, idx: number) => ({
                                      id: `obj-${problem._id}-${idx}`,
                                      type: "Note",
                                      title: obj,
                                      url: "#"
                                    })),
                                    ...problem.references.map((ref: any, idx: number) => ({
                                      id: `ref-${problem._id}-${idx}`,
                                      type: formatReferenceType(ref.type),
                                      title: ref.title || ref.url,
                                      url: ref.url
                                    }))
                                  ];

                                  if (problem.references.length === 0) {
                                    resources.push({
                                      id: 'dummy-vid',
                                      type: 'Video',
                                      title: 'Watch ' + problem.topic_title + ' Tutorial',
                                      url: 'https://youtube.com'
                                    });
                                  }

                                  return (
                                    <div id={`prob-${problem._id}`} key={problem._id}>
                                      <DayTaskCard
                                        variant="compact"
                                        title={`Day ${problem.day_number}: ${problem.topic_title} - ${problem.topic_description}`}
                                        completed={problem.status === 'completed'}
                                        resources={resources}
                                        onToggleComplete={() => toggleProblemSolved(problem._id)}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}

                        </div>
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
  );
}