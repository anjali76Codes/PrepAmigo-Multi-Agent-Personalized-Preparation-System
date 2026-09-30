import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAppContext } from '../context/AppContext';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

interface TaskItem {
  id: string;
  type: 'READ' | 'PRACTISE' | 'CODE' | 'REVIEW';
  title: string;
  completed: boolean;
  tag?: string;
}

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

  // Interactive task state
  const [todayTasks, setTodayTasks] = useState<TaskItem[]>([
    { id: 't1', type: 'READ', title: 'Learn about exception handling and try-catch blocks.', completed: false },
    { id: 't2', type: 'PRACTISE', title: 'Write a program that handles exceptions effectively.', completed: false },
    { id: 't3', type: 'READ', title: 'Familiarize with Java Streams and Lambda expressions.', completed: false },
  ]);

  const [backlogTasks, setBacklogTasks] = useState<TaskItem[]>([
    { id: 'b1', type: 'READ', title: 'Review Object Oriented Programming pillars in Java.', completed: false },
    { id: 'b2', type: 'CODE', title: 'Implement generic LinkedList and custom Queue.', completed: false },
    { id: 'b3', type: 'PRACTISE', title: 'Solve 3 Leetcode Easy problems on HashMap.', completed: false },
    { id: 'b4', type: 'READ', title: 'Spring Boot Dependency Injection & Autowiring deep dive.', completed: false },
    { id: 'b5', type: 'REVIEW', title: 'RESTful API error response standard formats.', completed: false },
  ]);

  const [upcomingTasks, setUpcomingTasks] = useState<TaskItem[]>([
    { id: 'u1', type: 'CODE', title: 'Build a Spring Boot CRUD API with PostgreSQL & JPA.', completed: false },
    { id: 'u2', type: 'READ', title: 'Docker containerization and multi-stage builds.', completed: false },
    { id: 'u3', type: 'PRACTISE', title: 'AWS ECS & Fargate deployment walkthrough.', completed: false },
  ]);

  const toggleTask = (id: string, listType: 'today' | 'backlog' | 'upcoming') => {
    if (listType === 'today') {
      setTodayTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    } else if (listType === 'backlog') {
      setBacklogTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    } else {
      setUpcomingTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    }
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const newTask: TaskItem = {
      id: `custom-${Date.now()}`,
      type: newTaskType,
      title: newTaskTitle.trim(),
      completed: false
    };
    if (activeTab === 'today') setTodayTasks(prev => [...prev, newTask]);
    else if (activeTab === 'backlog') setBacklogTasks(prev => [...prev, newTask]);
    else setUpcomingTasks(prev => [...prev, newTask]);

    setNewTaskTitle('');
    setIsAddingTask(false);
  };

  const completedToday = todayTasks.filter(t => t.completed).length;
  const totalToday = todayTasks.length;
  const remainingToday = totalToday - completedToday;
  const progressPercent = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  const getTagStyle = (type: string) => {
    switch (type) {
      case 'READ': return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'PRACTISE': return 'bg-forest-100 text-forest-800 border-forest-200';
      case 'CODE': return 'bg-amber-100 text-amber-800 border-amber-200';
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
                className="appearance-none pl-7 pr-8 py-1.5 bg-surface-muted hover:bg-forest-100/50 border border-border rounded-full text-xs font-bold text-carbon-900 cursor-pointer outline-none transition-colors"
              >
                {preps.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Icon name="chevron-down" className="text-xs text-carbon-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button className="px-3 py-1.5 rounded-full border border-border text-xs font-semibold text-carbon-700 hover:bg-surface-muted transition-colors flex items-center gap-1">
              <Icon name="add" className="text-sm" /> New plan
            </button>
            <button className="px-3 py-1.5 rounded-full border border-dashed border-border text-xs font-semibold text-carbon-500 hover:text-carbon-900 transition-colors">
              Join with a code
            </button>
          </div>

          {/* Quick Header Stats */}
          <div className="flex items-center gap-4 text-xs font-bold text-carbon-600 self-end md:self-auto">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-muted rounded-full border border-border">
              <span>3/18</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-muted rounded-full border border-border">
              <span>2%</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full border border-amber-200">
              <Icon name="flame" className="text-amber-600 text-sm" />
              <span>0</span>
            </div>
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
                    <h3 className="text-base font-bold text-carbon-900">You missed 2 days. No drama.</h3>
                    <p className="text-sm text-carbon-500 leading-relaxed">
                      5 tasks are waiting in your backlog. Nothing was rescheduled and nothing expires; the plan is still the one you were given.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button 
                      onClick={() => setActiveTab('backlog')}
                      className="px-4 py-2 bg-navy-900 hover:bg-navy-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                    >
                      See the backlog
                    </button>
                    <Link to="/app/chat">
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
                  <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-500/15 text-amber-700 font-extrabold">{backlogTasks.length}</span>
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

              <Link to="/app/practice" className="text-xs font-bold text-forest-700 hover:text-forest-800 flex items-center gap-1 group">
                <span>Whole plan</span>
                <Icon name="arrow-forward" className="text-xs group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            {/* Day Header & Progress */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold text-carbon-400 uppercase tracking-wider">
                    {activeTab === 'today' ? 'Today • Wednesday 30 Sept' : activeTab === 'backlog' ? 'Backlog items pending' : 'Upcoming Next Sprints'}
                  </span>
                  <h2 className="text-3xl md:text-4xl font-extrabold text-carbon-900 tracking-tight mt-1">
                    {activeTab === 'today' ? `${remainingToday} to go` : activeTab === 'backlog' ? `${backlogTasks.filter(t => !t.completed).length} pending tasks` : `${upcomingTasks.length} upcoming tasks`}
                  </h2>
                </div>

                {activeTab === 'today' && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-carbon-500">{completedToday} of {totalToday}</span>
                    <div className="w-24 h-2 rounded-full bg-surface-muted overflow-hidden">
                      <div 
                        className="h-full bg-forest-700 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Sub-label */}
              <div className="flex items-center gap-2 text-xs font-medium text-carbon-500">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span className="font-semibold text-carbon-800">{selectedPrep?.title || 'Java, Spring Boot, AWS, and Docker'}</span>
                <span>•</span>
                <span>Java Fundamentals - day 3</span>
              </div>
            </div>

            {/* Task Item List */}
            <div className="space-y-3 pt-2">
              {currentList.map((task) => (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task.id, activeTab)}
                  className={cn(
                    "group flex items-center gap-4 p-4 md:p-5 rounded-2xl bg-white border border-border shadow-xs hover:shadow-pop hover:border-chrome-accent/40 cursor-pointer transition-all",
                    task.completed && "bg-surface-muted/50 border-border/40"
                  )}
                >
                  <button
                    type="button"
                    aria-label="Toggle completed"
                    className={cn(
                      "w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors",
                      task.completed 
                        ? "bg-forest-700 border-forest-700 text-white" 
                        : "border-carbon-300 group-hover:border-forest-700 bg-white"
                    )}
                  >
                    {task.completed && <Icon name="checkmark" className="text-xs font-bold" />}
                  </button>

                  <span className={cn(
                    "px-2.5 py-0.5 text-[11px] font-bold uppercase rounded-md tracking-wider border shrink-0",
                    getTagStyle(task.type)
                  )}>
                    {task.type}
                  </span>

                  <span className={cn(
                    "text-sm md:text-base font-medium text-carbon-900 flex-1 leading-snug",
                    task.completed && "line-through text-carbon-400"
                  )}>
                    {task.title}
                  </span>
                </div>
              ))}

              {/* Add Custom Task */}
              {!isAddingTask ? (
                <button
                  onClick={() => setIsAddingTask(true)}
                  className="flex items-center gap-2 text-xs font-bold text-carbon-500 hover:text-carbon-900 py-3 px-4 rounded-xl border border-dashed border-border hover:bg-white transition-all w-full justify-center"
                >
                  <Icon name="add" className="text-base" /> Add my own task
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
                      className="flex-1 px-3 py-1.5 text-sm bg-transparent border border-border rounded-lg outline-none focus:border-forest-700"
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
            {/* 1. Mini Calendar Widget */}
            <div className="bg-white border border-border rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-carbon-900">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="truncate max-w-[170px]">{selectedPrep?.title || 'Java, Spring Boot'}</span>
                </div>
                <span className="text-xs font-bold text-carbon-500">0/18 days</span>
              </div>

              <div className="flex justify-between items-center text-xs font-semibold text-carbon-400">
                <span>Sept, Oct</span>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-carbon-400 pb-1">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <div key={i}>{d}</div>
                ))}
              </div>

              {/* Calendar Days Matrix */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {/* Week 1 */}
                <div className="py-2 text-carbon-400">28</div>
                <div className="py-2 text-carbon-400">29</div>
                <div className="py-2 font-bold text-amber-800 bg-amber-100 rounded-lg border border-amber-300">30</div>
                <div className="py-2 text-carbon-800 font-medium">1</div>
                <div className="py-2 text-carbon-800 font-medium">2</div>
                <div className="py-2 text-carbon-800 font-medium">3</div>
                <div className="py-2 text-carbon-800 font-medium">4</div>

                {/* Week 2 */}
                <div className="py-2 text-carbon-800 font-medium">5</div>
                <div className="py-2 text-carbon-800 font-medium">6</div>
                <div className="py-2 text-carbon-800 font-medium">7</div>
                <div className="py-2 text-carbon-800 font-medium">8</div>
                <div className="py-2 text-carbon-800 font-medium">9</div>
                <div className="py-2 text-carbon-800 font-medium">10</div>
                <div className="py-2 text-carbon-800 font-medium">11</div>

                {/* Week 3 */}
                <div className="py-2 text-carbon-800 font-medium">12</div>
                <div className="py-2 text-carbon-800 font-medium">13</div>
                <div className="py-2 text-carbon-800 font-medium">14</div>
                <div className="py-2 text-carbon-800 font-medium">15</div>
                <div className="py-2 text-carbon-300">16</div>
                <div className="py-2 text-carbon-300">17</div>
                <div className="py-2 text-carbon-300">18</div>
              </div>

              {/* Calendar Legend */}
              <div className="flex items-center justify-between text-[11px] font-semibold text-carbon-500 pt-3 border-t border-border">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> done
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-xs border border-amber-500 bg-amber-100" /> today
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-xs border border-dashed border-carbon-400" /> 2 missed
                </div>
              </div>
            </div>

            {/* 2. Progress & Backlog Stats Widget */}
            <div className="bg-white border border-border rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-4">
                {/* Radial Gauge */}
                <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                  <svg className="w-12 h-12 -rotate-90">
                    <circle cx="24" cy="24" r="18" className="stroke-surface-muted" strokeWidth="4" fill="transparent" />
                    <circle cx="24" cy="24" r="18" className="stroke-forest-700" strokeWidth="4" strokeDasharray={113} strokeDashoffset={110} fill="transparent" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-carbon-900">2% done</h4>
                  <p className="text-xs text-carbon-500 font-medium">1 of 53 tasks completed</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-surface-muted/60 rounded-xl p-3 border border-border/60">
                  <div className="text-xl font-extrabold text-carbon-900">15</div>
                  <div className="text-xs font-semibold text-carbon-500">days left</div>
                </div>
                <div className="bg-surface-muted/60 rounded-xl p-3 border border-border/60">
                  <div className="text-xl font-extrabold text-amber-700">{backlogTasks.length}</div>
                  <div className="text-xs font-semibold text-carbon-500">in backlog</div>
                </div>
              </div>
            </div>

            {/* 3. Live Community Activity Widget */}
            <div className="bg-white border border-border rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-carbon-900">
                <span className="w-2 h-2 rounded-full bg-forest-700 animate-pulse" />
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
