import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '../components/ui/Icon';
import { Link } from 'react-router-dom';
import { MOCK_PLAN, MOCK_SPRINTS, MOCK_SPRINT_DAYS } from '../mocks/interviewPlan.mock';
import type { ISprint, ISprintDay } from '../mocks/interviewPlan.mock';
import { DayTaskCard } from '../components/ui/DayTaskCard';
import type { ResourceItem } from '../components/ui/DayTaskCard';

export function Roadmap() {
  const [sprints] = useState<ISprint[]>(MOCK_SPRINTS);
  const [sprintDays, setSprintDays] = useState<ISprintDay[]>(MOCK_SPRINT_DAYS);

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    [MOCK_SPRINTS[0]?._id]: true,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Solved' | 'Unsolved'>('All');

  // Toggle Category Accordion
  const toggleCategory = (catId: string) => {
    setOpenCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  // Toggle Problem Solved
  const toggleProblemSolved = (dayId: string) => {
    setSprintDays(prev => prev.map(d => 
      d._id === dayId 
        ? { ...d, status: d.status === 'completed' ? 'pending' : 'completed' } 
        : d
    ));
  };

  // Expand / Collapse All
  const handleToggleExpandAll = () => {
    const allOpen = Object.values(openCategories).every(Boolean);
    const newCatState: Record<string, boolean> = {};
    sprints.forEach(cat => {
      newCatState[cat._id] = !allOpen;
    });
    setOpenCategories(newCatState);
  };

  // Flattened problem statistics calculation
  const totalCount = sprintDays.length;
  const solvedCount = sprintDays.filter(p => p.status === 'completed').length;
  const overallPercentage = totalCount > 0 ? Math.round((solvedCount / totalCount) * 100) : 0;

  // Next unsolved problem
  const nextUnsolved = sprintDays.find(p => p.status !== 'completed');

  // Filtered categories
  const filteredRoadmap = useMemo(() => {
    return sprints.map(sprint => {
      const days = sprintDays.filter(d => d.sprint_id === sprint._id);
      
      const filteredDays = days.filter(p => {
        const matchesSearch = p.topic_title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              p.topic_description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = 
          statusFilter === 'All' ? true :
          statusFilter === 'Solved' ? p.status === 'completed' :
          statusFilter === 'Unsolved' ? p.status !== 'completed' : true;

        return matchesSearch && matchesStatus;
      });

      // Distribute into levels (3 days per level)
      const daysPerLevel = 3;
      const lvlCount = Math.ceil(filteredDays.length / daysPerLevel);
      const levels = Array.from({ length: lvlCount }).map((_, i) => {
        return {
          id: `level-${i + 1}`,
          title: `Level ${i + 1}`,
          days: filteredDays.slice(i * daysPerLevel, (i + 1) * daysPerLevel)
        };
      });

      return { ...sprint, filteredDays, levels };
    }).filter(sprint => sprint.filteredDays.length > 0);
  }, [sprints, sprintDays, searchQuery, statusFilter]);

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 safe-area-bottom">
        <div className="max-w-6xl mx-auto space-y-6 pb-16">
          
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs font-semibold text-carbon-400">
            <Link to="/dashboard" className="hover:text-carbon-900 transition-colors">Prep Hub</Link>
            <span>/</span>
            <span className="text-carbon-800">{MOCK_PLAN.plan_name}</span>
          </div>

          {/* Top Header Card following Screenshot 2 */}
          <div className="bg-white border border-border rounded-3xl p-6 md:p-8 shadow-sm flex flex-col lg:flex-row justify-between items-start gap-8">
            
            {/* Left Header Description */}
            <div className="space-y-4 max-w-2xl">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-carbon-900 tracking-tight">
                {MOCK_PLAN.plan_name}
              </h1>
              <p className="text-sm md:text-base text-carbon-500 leading-relaxed">
                Role: {MOCK_PLAN.role} at {MOCK_PLAN.company}. A comprehensive preparation plan organized into sprints to tackle coding, system design, and behavioral questions.
              </p>

              <div className="flex items-center gap-4 text-xs font-semibold text-carbon-400">
                <span className="flex items-center gap-1.5 text-navy-700">
                  <span className="w-2 h-2 rounded-full bg-navy-700 inline-block animate-pulse" />
                  Total {MOCK_PLAN.total_days} Days
                </span>
                <span>•</span>
                <span>{sprints.length} Sprints</span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {nextUnsolved && (
                  <button 
                    onClick={() => {
                      const el = document.getElementById(`prob-${nextUnsolved._id}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className="px-4 py-2 bg-navy-900 hover:bg-navy-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
                  >
                    <span>Up next : Day {nextUnsolved.day_number}</span>
                    <Icon name="arrow-down" className="text-xs" />
                  </button>
                )}

                <Link to="/dashboard/chat">
                  <button className="px-4 py-2 bg-navy-100 hover:bg-navy-100/80 text-navy-800 border border-navy-700/30 rounded-xl text-xs font-bold transition-all flex items-center gap-2">
                    <Icon name="sparkles" className="text-xs text-navy-700" />
                    <span>Plan with PrepAmigo →</span>
                  </button>
                </Link>
              </div>
            </div>

            {/* Right Overall Progress Card */}
            <div className="bg-bg/80 border border-border rounded-2xl p-5 md:p-6 w-full lg:w-96 shrink-0 space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-carbon-500">
                <span>Overall Progress</span>
                <Icon name="ribbon" className="text-lg text-beige-500" />
              </div>

              <div className="flex items-baseline gap-3">
                <span className="text-3xl md:text-4xl font-extrabold text-carbon-900">{overallPercentage} %</span>
                <span className="text-xs font-bold text-carbon-400">{solvedCount} / {totalCount} days completed</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2.5 rounded-full bg-surface-muted overflow-hidden">
                <motion.div 
                  className="h-full bg-navy-900 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${overallPercentage}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>

          </div>

          {/* Filter & Search Toolbar */}
          <div className="bg-white border border-border rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-carbon-400 text-sm" />
              <input
                type="text"
                placeholder="Search topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-bg border border-border rounded-xl text-xs text-carbon-900 placeholder:text-carbon-400 outline-none focus:border-navy-900 transition-colors"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-surface-muted/60 border border-border/60 rounded-xl text-xs font-bold text-carbon-700 outline-none cursor-pointer"
              >
                <option value="All">All Status</option>
                <option value="Solved">Completed Only</option>
                <option value="Unsolved">Pending Only</option>
              </select>

              {/* Expand / Collapse All */}
              <button
                onClick={handleToggleExpandAll}
                className="p-2 border border-border rounded-xl text-carbon-600 hover:text-carbon-900 hover:bg-surface-muted transition-colors text-xs font-semibold flex items-center gap-1"
                title="Expand / Collapse All"
              >
                <Icon name="layers" className="text-sm" />
              </button>
            </div>
          </div>

          {/* Hierarchical Roadmap Tree Accordion */}
          <div className="space-y-4">
            {filteredRoadmap.map((sprint) => {
              const catSolved = sprint.filteredDays.filter(p => p.status === 'completed').length;
              const catTotal = sprint.filteredDays.length;
              const isOpen = openCategories[sprint._id] ?? false;

              return (
                <div key={sprint._id} className="bg-white border border-border rounded-2xl overflow-hidden shadow-xs">
                  {/* Category Header */}
                  <div
                    onClick={() => toggleCategory(sprint._id)}
                    className="flex items-center justify-between p-4 md:p-5 cursor-pointer hover:bg-bg/50 transition-colors select-none"
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        name={isOpen ? "chevron-down" : "chevron-forward"}
                        className="text-base text-carbon-500 transition-transform"
                      />
                      <h3 className="text-base md:text-lg font-bold text-carbon-900">Sprint {sprint.sprint_number}: {sprint.sprint_name}</h3>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-carbon-400">{catSolved} / {catTotal}</span>
                      <div className="w-16 md:w-24 h-1.5 rounded-full bg-surface-muted overflow-hidden">
                        <div
                          className="h-full bg-navy-900 rounded-full transition-all"
                          style={{ width: `${catTotal ? (catSolved / catTotal) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Category Content */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-border/60 bg-bg/20"
                      >
                        <div className="p-3 md:p-4 border-b border-border/40 last:border-b-0 space-y-6">
                            
                            {sprint.levels.map(level => (
                              <div key={level.id} className="space-y-3">
                                <h4 className="text-sm font-bold text-carbon-600 pl-2 border-l-2 border-navy-300">
                                  {level.title}
                                </h4>
                                <div className="space-y-3 pl-4">
                                  {level.days.map((problem) => {
                                    const resources: ResourceItem[] = [
                                      ...problem.objectives.map((obj, idx) => ({
                                        id: `obj-${idx}`,
                                        type: "Note" as const,
                                        title: obj,
                                        url: "#"
                                      })),
                                      ...problem.references.map((ref, idx) => ({
                                        id: `ref-${idx}`,
                                        type: "Article" as const,
                                        title: ref.title,
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
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
