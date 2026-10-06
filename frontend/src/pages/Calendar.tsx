import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Mascot } from '../components/ui/Mascot';
import { cn } from '../utils/utils';
import { DayTaskCard, type ResourceItem } from '../components/ui/DayTaskCard';
import type { ISprintDay } from '../mocks/interviewPlan.mock';

type Tab = 'today' | 'backlog' | 'upcoming';

const dateKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const isBeforeToday = (value: string) => {
  const d = new Date(value);
  return !isNaN(d.getTime()) && d < startOfToday();
};

const companyOf = (p: any) => p?.learningContext?.companyInfo?.name || p?.title || 'Prep';

/** Company / prep dropdown */
function PrepSwitcher({ preps, selectedId, onSelect }: { preps: any[]; selectedId: string; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = preps.find((p) => p.id === selectedId) || preps[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="h-9 pl-3 pr-3 bg-surface border border-border rounded-full flex items-center gap-2 text-xs font-bold text-carbon-900 hover:bg-lavender-50 transition-colors"
      >
        <span className="w-5 h-5 rounded-full bg-lavender-100 text-chrome flex items-center justify-center">
          <Icon name="briefcase-outline" className="text-xs" />
        </span>
        <span className="max-w-[180px] truncate">{companyOf(current)}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-carbon-500 flex">
          <Icon name="chevron-down" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-2 w-72 max-w-[85vw] z-30 bg-surface border border-border rounded-2xl shadow-pop p-1.5"
          >
            {preps.map((p) => {
              const selected = p.id === current?.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onSelect(p.id);
                      setOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors',
                      selected ? 'bg-lavender-100' : 'hover:bg-lavender-50'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-carbon-900 truncate">{companyOf(p)}</div>
                      {p.title && <div className="text-xs text-carbon-500 truncate">{p.title}</div>}
                    </div>
                    {selected && <Icon name="checkmark" className="text-chrome shrink-0" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Calendar() {
  const shouldReduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const { preps } = useAppContext();

  const [selectedPrepId, setSelectedPrepId] = useState<string>(preps[0]?.id || '');
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [showBanner, setShowBanner] = useState(true);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [monthOffset, setMonthOffset] = useState(0);

  const selectedPrep = preps.find((p) => p.id === selectedPrepId) || preps[0];

  const mappedPrepTasks: ISprintDay[] = useMemo(() => {
    if (!selectedPrep?.roadmap?.sprints) return [];
    return selectedPrep.roadmap.sprints.flatMap((s) =>
      (s.days || []).map((d: any) => ({
        _id: d.id || `${s.id}-day-${d.dayNumber}`,
        sprint_id: s.id,
        day_number: d.dayNumber,
        scheduled_date: d.date,
        topic_title: d.topic,
        topic_description: d.objective || '',
        objectives: d.objectives && d.objectives.length > 0 ? d.objectives : [d.objective].filter(Boolean),
        estimated_minutes: d.estimatedMinutes || 60,
        references: (d.rawReferences || []).map((r: any) => ({ title: r.title || r.url, url: r.url })),
        status: (d.status === 'done' ? 'completed' : d.status === 'today' ? 'in_progress' : 'pending') as
          | 'completed'
          | 'in_progress'
          | 'pending',
        completed_at: d.status === 'done' ? new Date().toISOString() : null,
        createdAt: d.date,
        updatedAt: d.date,
      }))
    );
  }, [selectedPrep]);

  const [tasks, setTasks] = useState<ISprintDay[]>([]);
  // Membership is fixed when the plan loads, so ticking a task never moves it between tabs.
  const [todayIds, setTodayIds] = useState<Set<string>>(new Set());
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [backlogIds, setBacklogIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const today = new Set<string>();
    const done = new Set<string>();
    const backlog = new Set<string>();
    mappedPrepTasks.forEach((t) => {
      if (t.status === 'in_progress') today.add(t._id);
      else if (t.status === 'completed') done.add(t._id);
      else if (isBeforeToday(t.scheduled_date)) backlog.add(t._id);
    });
    setTasks(mappedPrepTasks);
    setTodayIds(today);
    setDoneIds(done);
    setBacklogIds(backlog);
    setShowBanner(true);
  }, [mappedPrepTasks]);

  const todayTasks = tasks.filter((t) => todayIds.has(t._id));
  const backlogTasks = tasks.filter((t) => backlogIds.has(t._id));
  const upcomingTasks = tasks.filter((t) => !todayIds.has(t._id) && !backlogIds.has(t._id) && !doneIds.has(t._id));
  const currentList = activeTab === 'today' ? todayTasks : activeTab === 'backlog' ? backlogTasks : upcomingTasks;

  const missedCount = backlogTasks.filter((t) => t.status !== 'completed').length;

  const toggleTask = (id: string) =>
    setTasks((prev) => prev.map((t) => (t._id === id ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' } : t)));

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const id = `custom-${Date.now()}`;
    const now = new Date().toISOString();
    setTasks((prev) => [
      ...prev,
      {
        _id: id,
        sprint_id: 'custom',
        day_number: 999,
        scheduled_date: now,
        topic_title: newTaskTitle.trim(),
        topic_description: '',
        objectives: [],
        estimated_minutes: 30,
        references: [],
        status: 'pending',
        completed_at: null,
        createdAt: now,
        updatedAt: now,
      } as ISprintDay,
    ]);
    if (activeTab === 'today') setTodayIds((prev) => new Set(prev).add(id));
    setNewTaskTitle('');
    setIsAddingTask(false);
  };

  const completedToday = todayTasks.filter((t) => t.status === 'completed').length;
  const totalToday = todayTasks.length;
  const remainingToday = totalToday - completedToday;
  const progressPercent = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  const totalAll = tasks.length;
  const doneAll = tasks.filter((t) => t.status === 'completed').length;
  const overallPct = totalAll > 0 ? Math.round((doneAll / totalAll) * 100) : 0;

  // ---- month grid from real scheduled dates ----
  const view = useMemo(() => {
    const base = new Date();
    return new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  }, [monthOffset]);

  const byDay = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>();
    tasks.forEach((t) => {
      const d = new Date(t.scheduled_date);
      if (isNaN(d.getTime())) return;
      const k = dateKey(d);
      const cur = map.get(k) || { total: 0, done: 0 };
      cur.total += 1;
      if (t.status === 'completed') cur.done += 1;
      map.set(k, cur);
    });
    return map;
  }, [tasks]);

  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const leadingBlanks = (view.getDay() + 6) % 7; // Monday first
  const todayKey = dateKey(new Date());
  const todayStart = startOfToday();

  const buildResources = (task: ISprintDay): ResourceItem[] => {
    const res: ResourceItem[] = [
      ...task.objectives.map((obj, idx) => ({ id: `obj-${task._id}-${idx}`, type: 'Note', title: obj, url: '#' })),
      ...task.references.map((ref, idx) => ({ id: `ref-${task._id}-${idx}`, type: 'Article', title: ref.title, url: ref.url })),
    ];
    if (task.references.length === 0 && task.sprint_id !== 'custom') {
      res.push({ id: `vid-${task._id}`, type: 'Video', title: `Watch ${task.topic_title} Tutorial`, url: 'https://youtube.com' });
    }
    return res;
  };

  if (preps.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-bg text-center h-full">
        <Mascot variant="dissapointed.png" size="xl" style={{ width: 160, height: 160 }} />
        <h2 className="text-2xl font-bold text-carbon-900 mt-4 mb-2">No Scheduled Tasks</h2>
        <p className="text-sm text-carbon-500 max-w-md mb-6">
          You don't have an active study schedule yet. Create your preparation plan to populate your daily timeline.
        </p>
        <Link to="/dashboard/chat">
          <Button className="gap-2">
            Create Schedule in Chat <Icon name="arrow-forward-outline" />
          </Button>
        </Link>
      </div>
    );
  }

  const heroMascot = activeTab === 'today' && totalToday > 0 && remainingToday === 0 ? 'Celebration.png' : 'Motivated.png';
  const motionY = shouldReduceMotion ? 0 : 12;

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <div className="flex-1 overflow-y-auto safe-area-bottom">
        <div className="w-full px-6 md:px-12 py-6 md:py-8 space-y-6 pb-16">

          {/* Hero: full width */}
          <motion.div initial={{ opacity: 0, y: motionY }} animate={{ opacity: 1, y: 0 }}>
            <Card variant="default" className="bg-lavender-100 rounded-3xl p-6 md:p-8 flex items-center gap-6">
              <div className="flex-1 min-w-0 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="ghost" size="sm" className="gap-1.5 -ml-3 font-bold text-chrome" onClick={() => navigate('/dashboard')}>
                    <Icon name="arrow-back" /> Dashboard
                  </Button>
                  <PrepSwitcher preps={preps} selectedId={selectedPrep?.id} onSelect={setSelectedPrepId} />
                </div>

                <div>
                  <div className="text-xs font-bold text-carbon-500 uppercase tracking-wider">
                    {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                  <h1 className="text-2xl md:text-3xl font-extrabold text-carbon-900 tracking-tight mt-1">
                    {totalToday === 0
                      ? 'Nothing planned today'
                      : remainingToday === 0
                        ? 'All done for today!'
                        : `Just ${remainingToday} more to go`}
                  </h1>
                  <p className="text-sm text-carbon-700 font-medium mt-1 truncate">{selectedPrep?.title}</p>
                </div>

                {totalToday > 0 && (
                  <div className="max-w-sm space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-carbon-700">
                      <span>{completedToday} of {totalToday} done</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-surface overflow-hidden">
                      <motion.div className="h-full bg-chrome rounded-full" animate={{ width: `${progressPercent}%` }} transition={{ duration: 0.4 }} />
                    </div>
                  </div>
                )}
              </div>

              <div className="hidden sm:flex shrink-0 w-36 h-36 rounded-full bg-surface border border-border items-center justify-center">
                <motion.div key={heroMascot} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                  <Mascot variant={heroMascot} size="lg" />
                </motion.div>
              </div>
            </Card>
          </motion.div>

          {/* Content: 7xl */}
          <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Main column */}
            <motion.div initial={{ opacity: 0, y: motionY }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="lg:col-span-8 space-y-4">

              {/* Missed-day card: only when something was actually missed */}
              <AnimatePresence initial={false}>
                {showBanner && missedCount > 0 && activeTab !== 'backlog' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-beige-100 border border-border rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4">
                      <Mascot variant="Chilling.png" size="md" className="hidden sm:block shrink-0" />
                      <div className="flex-1 space-y-1">
                        <h3 className="text-base font-bold text-carbon-900">It's okay to miss a day!</h3>
                        <p className="text-sm text-carbon-700 leading-relaxed">
                          You have {missedCount} {missedCount === 1 ? 'task' : 'tasks'} waiting in your backlog. Nothing expires; we're just picking up right where you left off.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" onClick={() => setActiveTab('backlog')}>See the backlog</Button>
                        <Button size="sm" variant="outline" className="border" onClick={() => navigate('/dashboard/chat')}>Adjust plan</Button>
                        <button
                          onClick={() => setShowBanner(false)}
                          aria-label="Dismiss"
                          className="w-8 h-8 rounded-full text-carbon-500 hover:bg-beige-500/20 flex items-center justify-center"
                        >
                          <Icon name="close" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Tabs */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1 bg-surface border border-border rounded-full p-1">
                  {([
                    ['today', 'Today', todayTasks.length],
                    ['backlog', 'Backlog', missedCount],
                    ['upcoming', 'Upcoming', upcomingTasks.length],
                  ] as [Tab, string, number][]).map(([key, label, count]) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={cn(
                        'px-4 h-8 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5',
                        activeTab === key ? 'bg-chrome text-on-chrome' : 'text-carbon-500 hover:text-carbon-900'
                      )}
                    >
                      {label}
                      <span className={cn('text-[10px]', activeTab === key ? 'text-on-chrome-muted' : 'text-carbon-500')}>{count}</span>
                    </button>
                  ))}
                </div>

                <Link to="/dashboard/practice" className="text-xs font-bold text-chrome hover:underline flex items-center gap-1">
                  Whole plan <Icon name="arrow-forward" className="text-xs" />
                </Link>
              </div>

              {/* List */}
              <div className="space-y-3">
                <AnimatePresence mode="popLayout" initial={false}>
                  {currentList.map((task, i) => (
                    <motion.div
                      key={task._id}
                      layout="position"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: Math.min(i, 6) * 0.04, duration: 0.2 }}
                    >
                      <DayTaskCard
                        variant="compact"
                        title={task.day_number === 999 ? task.topic_title : `Day ${task.day_number}: ${task.topic_title}`}
                        completed={task.status === 'completed'}
                        resources={buildResources(task)}
                        onToggleComplete={() => toggleTask(task._id)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>

                {currentList.length === 0 && (
                  <Card variant="default" className="p-10 text-center flex flex-col items-center gap-3">
                    <Mascot variant="Chilling.png" size="lg" style={{ width: 110, height: 110 }} />
                    <p className="font-bold text-carbon-900">
                      {activeTab === 'backlog' ? 'Backlog is empty' : activeTab === 'today' ? 'Nothing scheduled today' : 'Nothing coming up'}
                    </p>
                    <p className="text-sm text-carbon-500">
                      {activeTab === 'backlog' ? "You're all caught up." : 'Add something below or adjust your plan in chat.'}
                    </p>
                  </Card>
                )}

                {!isAddingTask ? (
                  <button
                    onClick={() => setIsAddingTask(true)}
                    className="w-full flex items-center justify-center gap-2 text-xs font-bold text-carbon-500 hover:text-carbon-900 py-3 rounded-2xl border-2 border-dashed border-border hover:bg-surface transition-colors"
                  >
                    <Icon name="add" className="text-base" /> Add something else to do
                  </button>
                ) : (
                  <form onSubmit={handleAddTask} className="bg-surface border border-border rounded-2xl p-3 flex items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      placeholder="What do you want to do?"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className="flex-1 h-10 px-3 text-sm bg-transparent outline-none text-carbon-900"
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddingTask(false)}>Cancel</Button>
                    <Button type="submit" size="sm">Add</Button>
                  </form>
                )}
              </div>
            </motion.div>

            {/* Sidebar */}
            <motion.div initial={{ opacity: 0, y: motionY }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-4 space-y-4">

              {/* Keep it up */}
              <div className="bg-chrome-accent text-navy-900 rounded-card p-5 flex items-center gap-4">
                <div className="flex-1">
                  <h4 className="font-bold text-lg leading-tight mb-1">Keep it up!</h4>
                  <p className="text-xs text-navy-900/70 font-medium leading-relaxed">
                    {overallPct > 0
                      ? `You're ${overallPct}% through your plan. Your mascot is cheering for you!`
                      : 'Every plan starts with one tick. Your mascot is cheering for you!'}
                  </p>
                </div>
                <div className="w-16 h-16 shrink-0 bg-surface rounded-full flex items-center justify-center">
                  <Mascot variant="hi.png" size="md" />
                </div>
              </div>

              {/* Month: lavender */}
              <Card variant="default" className="bg-lavender-100 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-carbon-900">
                    {view.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  </h3>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setMonthOffset((m) => m - 1)} aria-label="Previous month" className="w-8 h-8 rounded-full hover:bg-surface text-carbon-700 flex items-center justify-center transition-colors">
                      <Icon name="chevron-back" />
                    </button>
                    <button onClick={() => setMonthOffset((m) => m + 1)} aria-label="Next month" className="w-8 h-8 rounded-full hover:bg-surface text-carbon-700 flex items-center justify-center transition-colors">
                      <Icon name="chevron-forward" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-carbon-500">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i}>{d}</div>)}
                </div>

                <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
                  {Array.from({ length: leadingBlanks }).map((_, i) => <div key={`b${i}`} />)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const date = new Date(view.getFullYear(), view.getMonth(), i + 1);
                    const k = dateKey(date);
                    const info = byDay.get(k);
                    const isToday = k === todayKey;
                    const allDone = !!info && info.done === info.total;
                    const missed = !!info && !allDone && date < todayStart;

                    return (
                      <div
                        key={i}
                        className={cn(
                          "relative h-11 rounded-xl flex flex-col items-center justify-center transition-all",
                          "font-semibold border",
                          isToday
                            ? "bg-chrome text-on-chrome border-chrome shadow-sm"
                            : missed
                              ? "bg-coral-500/10 text-coral-700 border-coral-500/30"
                              : allDone
                                ? "bg-chrome-accent text-navy-900 border-chrome-accent"
                                : info
                                  ? "bg-lavender-50 text-carbon-900 border-chrome-accent/50"
                                  : "bg-surface text-carbon-500 border-transparent"
                        )}
                      >
                        <span className="text-xs font-bold">
                          {i + 1}
                        </span>

                        {info && (
                          <span
                            className={cn(
                              "text-[9px] leading-none mt-0.5 font-bold",
                              isToday
                                ? "text-on-chrome-muted"
                                : missed
                                  ? "text-coral-700"
                                  : allDone
                                    ? "text-navy-900/70"
                                    : "text-carbon-500"
                            )}
                          >
                            {info.done}/{info.total}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-carbon-500 pt-3 border-t border-chrome-accent/60">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-chrome" />
                    today
                  </span>

                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-chrome-accent" />
                    done
                  </span>

                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-lavender-50 border border-chrome-accent/50" />
                    planned
                  </span>

                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-coral-500/10 border border-coral-500/30" />
                    missed
                  </span>
                </div>
              </Card>

              {/* Progress */}
              <Card variant="chrome" className="p-5 space-y-4">
                <div>
                  <div className="text-3xl font-extrabold">{overallPct}%</div>
                  <div className="text-xs font-semibold text-on-chrome-muted">{doneAll} of {totalAll} tasks completed</div>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <motion.div className="h-full bg-chrome-accent rounded-full" animate={{ width: `${overallPct}%` }} transition={{ duration: 0.5 }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                    <div className="text-xl font-extrabold">{totalAll - doneAll}</div>
                    <div className="text-xs font-semibold text-on-chrome-muted">tasks left</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                    <div className="text-xl font-extrabold text-chrome-accent">{missedCount}</div>
                    <div className="text-xs font-semibold text-on-chrome-muted">in backlog</div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}