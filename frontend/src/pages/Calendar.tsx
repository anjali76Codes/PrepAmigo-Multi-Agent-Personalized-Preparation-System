import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAppContext } from '../context/AppContext';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import { Link } from 'react-router-dom';
import { cn } from '../utils/utils';

import { DayTaskCard, type ResourceItem } from '../components/ui/DayTaskCard';
import { MOCK_SPRINT_DAYS } from '../mocks/interviewPlan.mock';
import type { ISprintDay } from '../mocks/interviewPlan.mock';

export function Calendar() {
  const shouldReduceMotion = useReducedMotion();
  const { preps } = useAppContext();
  const [selectedPrepId, setSelectedPrepId] = useState<string>(preps[0]?.id || 'prep-1');
  const [activeTab, setActiveTab] = useState<'today' | 'backlog' | 'upcoming'>('today');
  const [showBanner, setShowBanner] = useState(true);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskType, setNewTaskType] = useState<'READ' | 'PRACTISE' | 'CODE' | 'REVIEW'>('PRACTISE');

  const selectedPrep = preps.find(p => p.id === selectedPrepId) || preps[0];

  // Interactive task state mapped from Mock Data
  const [tasks, setTasks] = useState<ISprintDay[]>(MOCK_SPRINT_DAYS);

  const todayTasks = tasks.filter(t => t.status === 'in_progress');
  const upcomingTasks = tasks.filter(t => t.status === 'pending');
  const backlogTasks: ISprintDay[] = []; 

  const toggleTask = (id: string, _listType: 'today' | 'backlog' | 'upcoming') => {
    setTasks(prev => prev.map(t => {
      if (t._id === id) {
        return { ...t, status: t.status === 'completed' ? 'pending' : 'completed' };
      }
      return t;
    }));
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const newTask: ISprintDay = {
      _id: `custom-${Date.now()}`,
      sprint_id: 'custom',
      day_number: 999,
      scheduled_date: new Date().toISOString(),
      topic_title: newTaskTitle.trim(),
      topic_description: newTaskType,
      objectives: [],
      estimated_minutes: 30,
      references: [],
      status: activeTab === 'today' ? 'in_progress' : 'pending',
      completed_at: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setTasks(prev => [...prev, newTask]);
    setNewTaskTitle('');
    setIsAddingTask(false);
  };

  const completedToday = todayTasks.filter(t => t.status === 'completed').length;
  const totalToday = todayTasks.length;
  const remainingToday = totalToday - completedToday;
  const progressPercent = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  const getTagStyle = (type: string) => {
    switch (type) {
      case 'READ': return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'PRACTISE': return 'bg-navy-100 text-navy-800 border-navy-200';
      case 'CODE': return 'bg-beige-100 text-beige-800 border-beige-200';
      case 'REVIEW': return 'bg-coral-100 text-coral-800 border-coral-200';
      default: return 'bg-surface-muted text-carbon-700 border-border';
    }
  };

  const currentList = activeTab === 'today' ? todayTasks : activeTab === 'backlog' ? backlogTasks : upcomingTasks;

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-border px-4 md:px-8 py-5 shrink-0 z-10 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl md:text-2xl font-extrabold text-carbon-900 tracking-tight">
              {selectedPrep?.title || 'Java, Spring Boot, AWS, and Docker'}
            </h1>
            
            {/* Track Selector Pill */}
            <div className="relative inline-block">
              <select
                value={selectedPrepId}
                onChange={(e) => setSelectedPrepId(e.target.value)}
                className="appearance-none pl-7 pr-8 py-1.5 bg-surface-muted hover:bg-navy-100/50 border border-border rounded-full text-xs font-bold text-carbon-900 cursor-pointer outline-none transition-colors"
              >
                {preps.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
              <span className="w-2.5 h-2.5 rounded-full bg-beige-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Icon name="chevron-down" className="text-xs text-carbon-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button className="px-3 py-1.5 rounded-full border border-border text-xs font-semibold text-carbon-700 hover:bg-surface-muted transition-colors flex items-center gap-1">
              <Icon name="add" className="text-sm" /> New plan
            </button>
            <button className="px-3 py-1.5 rounded-full border border-dashed border-border text-xs font-semibold text-carbon-500 hover:text-carbon-900 transition-colors">
              Join with a code
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 safe-area-bottom">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 pb-16">
          
          {/* LEFT / CENTER COLUMN */}
          <motion.div 
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-8 space-y-6"
          >
            {/* Banner: Missed days notice */}
            <AnimatePresence>
              {showBanner && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white border border-border rounded-2xl p-5 md:p-6 shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1 pr-6">
                    <h3 className="text-base font-bold text-carbon-900">It's okay to miss a day!</h3>
                    <p className="text-sm text-carbon-500 leading-relaxed">
                      You have 5 tasks waiting in your backlog. Nothing expires; we're just picking up right where you left off.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button 
                      onClick={() => setActiveTab('backlog')}
                      className="px-4 py-2 bg-navy-900 hover:bg-navy-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                    >
                      See the backlog
                    </button>
                    <Link to="/dashboard/chat">
                      <button className="px-3.5 py-2 border border-border hover:bg-surface-muted text-carbon-700 text-xs font-bold rounded-xl transition-all">
                        Adjust plan
                      </button>
                    </Link>
                    <button 
                      onClick={() => setShowBanner(false)}
                      className="p-1.5 text-carbon-400 hover:text-carbon-900 rounded-lg transition-colors"
                      title="Dismiss"
                    >
                      <Icon name="close" className="text-lg" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation Tabs */}
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <div className="flex items-center gap-2 bg-surface-muted/70 p-1 rounded-xl border border-border/60">
                <button
                  onClick={() => setActiveTab('today')}
                  className={cn(
                    "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                    activeTab === 'today'
                      ? "bg-white text-carbon-900 shadow-xs"
                      : "text-carbon-500 hover:text-carbon-900"
                  )}
                >
                  Today
                </button>
                <button
                  onClick={() => setActiveTab('backlog')}
                  className={cn(
                    "px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5",
                    activeTab === 'backlog'
                      ? "bg-white text-carbon-900 shadow-xs"
                      : "text-carbon-500 hover:text-carbon-900"
                  )}
                >
                  <span>Backlog</span>
                  <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-beige-500/15 text-beige-700 font-extrabold">{backlogTasks.length}</span>
                </button>
                <button
                  onClick={() => setActiveTab('upcoming')}
                  className={cn(
                    "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                    activeTab === 'upcoming'
                      ? "bg-white text-carbon-900 shadow-xs"
                      : "text-carbon-500 hover:text-carbon-900"
                  )}
                >
                  Upcoming
                </button>
              </div>

              <Link to="/dashboard/practice" className="text-xs font-bold text-navy-700 hover:text-navy-800 flex items-center gap-1 group">
                <span>Whole plan</span>
                <Icon name="arrow-forward" className="text-xs group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            {/* Day Header & Progress */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold text-carbon-400 uppercase tracking-wider">
                    {activeTab === 'today' ? "Today's Plan (Wed, 30 Sept)" : activeTab === 'backlog' ? 'Waiting for you' : 'Coming up next'}
                  </span>
                  <h2 className="text-3xl md:text-4xl font-extrabold text-carbon-900 tracking-tight mt-1">
                    {activeTab === 'today' ? `Just ${remainingToday} more to go` : activeTab === 'backlog' ? `${backlogTasks.filter(t => t.status !== 'completed').length} tasks waiting` : `${upcomingTasks.length} tasks lined up`}
                  </h2>
                </div>

                {activeTab === 'today' && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-carbon-500">{completedToday} of {totalToday}</span>
                    <div className="w-24 h-2 rounded-full bg-surface-muted overflow-hidden">
                      <div 
                        className="h-full bg-navy-700 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Sub-label */}
              <div className="flex items-center gap-2 text-xs font-medium text-carbon-500">
                <span className="w-2 h-2 rounded-full bg-beige-500 shrink-0" />
                <span className="font-semibold text-carbon-800">{selectedPrep?.title || 'Java, Spring Boot, AWS, and Docker'}</span>
                <span>•</span>
                <span>Java Fundamentals - day 3</span>
              </div>
            </div>

            {/* Task Item List */}
            <div className="space-y-3 pt-2">
              {currentList.map((task) => {
                const resources: ResourceItem[] = [
                  ...task.objectives.map((obj, idx) => ({
                    id: `obj-${idx}`,
                    type: "Note" as const,
                    title: obj,
                    url: "#"
                  })),
                  ...task.references.map((ref, idx) => ({
                    id: `ref-${idx}`,
                    type: "Article" as const,
                    title: ref.title,
                    url: ref.url
                  }))
                ];

                if (task.references.length === 0) {
                  resources.push({
                    id: 'dummy-vid',
                    type: 'Video',
                    title: 'Watch ' + task.topic_title + ' Tutorial',
                    url: 'https://youtube.com'
                  });
                }

                let typeStr = 'READ';
                if (task.topic_description.toLowerCase().includes('solve')) typeStr = 'CODE';
                else if (task.topic_description.toLowerCase().includes('practise')) typeStr = 'PRACTISE';

                return (
                  <div key={task._id} className="relative">
                    <DayTaskCard
                      variant="compact"
                      title={`Day ${task.day_number}: ${task.topic_title}`}
                      completed={task.status === 'completed'}
                      resources={resources}
                      onToggleComplete={() => toggleTask(task._id, activeTab)}
                    />
                    <span className={cn(
                      "absolute top-4 right-4 md:right-12 px-2 py-0.5 text-[10px] font-bold uppercase rounded-md tracking-wider border pointer-events-none z-10 bg-opacity-90",
                      getTagStyle(typeStr)
                    )}>
                      {typeStr}
                    </span>
                  </div>
                );
              })}

              {/* Add Custom Task */}
              {!isAddingTask ? (
                <button
                  onClick={() => setIsAddingTask(true)}
                  className="flex items-center gap-2 text-xs font-bold text-carbon-500 hover:text-carbon-900 py-3 px-4 rounded-xl border border-dashed border-border hover:bg-white transition-all w-full justify-center"
                >
                  <Icon name="add" className="text-base" /> Add something else to do
                </button>
              ) : (
                <form onSubmit={handleAddTask} className="bg-white p-4 rounded-2xl border border-border space-y-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <select
                      value={newTaskType}
                      onChange={(e) => setNewTaskType(e.target.value as any)}
                      className="px-2.5 py-1.5 text-xs font-bold bg-surface-muted rounded-lg border border-border outline-none"
                    >
                      <option value="READ">READ</option>
                      <option value="PRACTISE">PRACTISE</option>
                      <option value="CODE">CODE</option>
                      <option value="REVIEW">REVIEW</option>
                    </select>
                    <input
                      type="text"
                      autoFocus
                      placeholder="Task description..."
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-sm bg-transparent border border-border rounded-lg outline-none focus:border-navy-700"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingTask(false)}
                      className="px-3 py-1 text-xs font-semibold text-carbon-500 hover:text-carbon-900"
                    >
                      Cancel
                    </button>
                    <Button type="submit" size="sm" variant="primary">
                      Save Task
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>

          {/* RIGHT SIDEBAR COLUMN */}
          <motion.div 
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-4 space-y-6"
          >
            {/* Mascot Widget */}
            <div className="bg-chrome-accent text-navy-900 rounded-2xl p-5 shadow-xs flex items-center gap-4 relative overflow-hidden">
              <div className="flex-1 z-10">
                <h4 className="font-bold text-lg leading-tight mb-1">Keep it up!</h4>
                <p className="text-xs text-navy-900/70 font-medium leading-relaxed">
                  You're making steady progress. Your mascot is cheering for you!
                </p>
              </div>
              <div className="w-14 h-14 shrink-0 bg-white rounded-full flex items-center justify-center shadow-sm relative z-10">
                <span className="text-2xl animate-bounce"></span>
              </div>
            </div>

            {/* 1. Mini Calendar Widget */}
            <div className="bg-lavender-100 text-navy-900 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-navy-900" />
                  <span className="truncate max-w-[170px]">{selectedPrep?.title || 'Java, Spring Boot'}</span>
                </div>
                <span className="text-xs font-bold text-navy-500">0 of 18 days done</span>
              </div>

              <div className="flex justify-between items-center text-xs font-semibold text-navy-500">
                <span>Sept, Oct</span>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-navy-500 pb-1">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <div key={i}>{d}</div>
                ))}
              </div>

              {/* Calendar Days Matrix */}
              <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
                {Array.from({ length: 31 }).map((_, i) => {
                  const isToday = i === 15;
                  const isDone = i < 15;
                  
                  let bgStyle = 'bg-white';
                  if (isToday) bgStyle = 'border border-beige-600 bg-beige-100 text-beige-900 font-bold';
                  else if (isDone) bgStyle = 'bg-navy-100 text-navy-900';
                  else bgStyle = 'bg-white text-navy-900';

                  return (
                    <div
                      key={i}
                      className={`h-7 flex items-center justify-center rounded-lg ${bgStyle}`}
                    >
                      {i + 1}
                    </div>
                  );
                })}
              </div>

              {/* Calendar Legend */}
              <div className="flex items-center justify-between text-[11px] font-semibold text-navy-500 pt-3 border-t border-navy-500/20">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-lg bg-navy-100" /> done
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-lg border border-beige-600 bg-beige-100" /> today
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-lg border border-dashed border-navy-500/40" /> 2 missed
                </div>
              </div>
            </div>

            {/* 2. Progress & Backlog Stats Widget */}
            <div className="bg-navy-900 text-white rounded-2xl p-5 shadow-pop space-y-4">
              <div className="flex items-center gap-4">
                {/* Radial Gauge */}
                <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                  <svg className="w-12 h-12 -rotate-90">
                    <circle cx="24" cy="24" r="18" className="stroke-white/10" strokeWidth="4" fill="transparent" />
                    <circle cx="24" cy="24" r="18" className="stroke-chrome-accent" strokeWidth="4" strokeDasharray={113} strokeDashoffset={110} fill="transparent" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-white">2% done</h4>
                  <p className="text-xs text-on-chrome-muted font-medium">1 of 53 tasks completed</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <div className="text-xl font-extrabold text-white">15</div>
                  <div className="text-xs font-semibold text-on-chrome-muted">days left</div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <div className="text-xl font-extrabold text-chrome-accent">{backlogTasks.length}</div>
                  <div className="text-xs font-semibold text-on-chrome-muted">in backlog</div>
                </div>
              </div>
            </div>

            {/* 3. Live Community Activity Widget */}
            <div className="bg-white border border-border rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-carbon-900">
                <span className="w-2 h-2 rounded-full bg-navy-700 animate-pulse" />
                <span>In the last 3 hours</span>
              </div>

              <div className="space-y-1.5 text-xs text-carbon-600 font-medium">
                <div className="flex items-center gap-2"><strong className="text-carbon-900">6</strong> problems solved</div>
                <div className="flex items-center gap-2"><strong className="text-carbon-900">10</strong> answers checked</div>
                <div className="flex items-center gap-2"><strong className="text-carbon-900">5</strong> learners joined</div>
                <div className="flex items-center gap-2"><strong className="text-carbon-900">9</strong> roadmaps started</div>
              </div>

              <p className="text-[11px] text-carbon-400 italic">across everyone learning here</p>

              <div className="pt-2 border-t border-border text-[11px] text-carbon-400">
                Counted at 11:32 am • Next update 12:32 pm - in 10 minutes
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
