import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { useAppContext } from '../context/AppContext';

export function AppHome() {
  const shouldReduceMotion = useReducedMotion();
  const { preps: mockPreps } = useAppContext();
  const prep = mockPreps[0]; // Primary active prep
  
  // Dashboard mock metrics
  const todayTasks = prep.roadmap.sprints[0].days.filter(d => d.status === 'today' || d.status === 'done');
  const missedTasks = 1;
  const daysLeft = 45;
  const readiness = 65;
  const streak = prep.learningContext.progress.streak;
  const xp = prep.learningContext.progress.xp;
  
  return (
    <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
      <div className="border-b border-border bg-surface shrink-0 z-10 sticky top-0 px-4 md:px-8 py-6">
        <h1 className="text-3xl font-bold text-primary-text mb-2">Welcome back!</h1>
        <p className="text-secondary-text">Here is your snapshot for today.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 relative safe-area-bottom">
        <motion.div
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto space-y-8 pb-12"
        >
          {missedTasks > 0 && (
            <div className="bg-warning/10 border border-warning/20 p-4 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Icon name="warning" className="text-warning text-2xl" />
                <div>
                  <h4 className="font-bold text-warning">You have {missedTasks} missed task</h4>
                  <p className="text-sm text-warning/80">PrepAmigo can reschedule this for you.</p>
                </div>
              </div>
              <Link to="/app/chat" className="bg-warning text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-warning/90">
                Reschedule
              </Link>
            </div>
          )}

          <div className="grid md:grid-cols-4 gap-4">
            <MetricCard title="Days Left" value={daysLeft.toString()} icon="calendar" color="primary" />
            <MetricCard title="Readiness" value={`${readiness}%`} icon="bar-chart" color="accent" />
            <MetricCard title="Day Streak" value={streak.toString()} icon="flame" color="warning" />
            <MetricCard title="Total XP" value={xp.toLocaleString()} icon="star" color="primary" />
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
              <div className="flex justify-between items-end">
                <h2 className="text-xl font-bold text-primary-text">Today's Tasks</h2>
                <Link to="/app/preps/prep-1" className="text-sm text-primary font-medium hover:underline">View Roadmap</Link>
              </div>
              
              <div className="space-y-3">
                {todayTasks.map(task => (
                  <Card key={task.dayNumber} className="p-4 bg-surface flex items-center justify-between border-border group hover:border-primary/30">
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center ${task.status === 'done' ? 'bg-primary border-primary text-white' : 'border-secondary-text/30'}`}>
                        {task.status === 'done' && <Icon name="checkmark" className="text-xs" />}
                      </div>
                      <span className={`font-medium ${task.status === 'done' ? 'text-secondary-text line-through' : 'text-primary-text'}`}>
                        {task.topic}
                      </span>
                    </div>
                    <span className="text-xs text-secondary-text bg-background px-2 py-1 rounded">{task.estimatedMinutes}m</span>
                  </Card>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <h2 className="text-xl font-bold text-primary-text">Upcoming Due</h2>
              
              <Card className="p-4 bg-surface border-border">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-accent/10 text-accent flex items-center justify-center">
                    <Icon name="help-circle" />
                  </div>
                  <div>
                    <h4 className="font-bold text-primary-text">System Design Quiz</h4>
                    <p className="text-xs text-warning font-medium">Due Tomorrow</p>
                  </div>
                </div>
                <Link to="/app/practice" className="block text-center text-sm text-primary font-medium bg-background py-2 rounded-lg hover:bg-primary/5 transition-colors">Start Quiz</Link>
              </Card>

              <Card className="p-4 bg-surface border-border">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <Icon name="albums" />
                  </div>
                  <div>
                    <h4 className="font-bold text-primary-text">DSA Flashcards</h4>
                    <p className="text-xs text-secondary-text">12 cards to review</p>
                  </div>
                </div>
                <Link to="/app/practice" className="block text-center text-sm text-primary font-medium bg-background py-2 rounded-lg hover:bg-primary/5 transition-colors">Review Now</Link>
              </Card>

              <div className="p-6 bg-primary text-white rounded-2xl shadow-lg mt-8">
                <h3 className="font-bold mb-2">Ask PrepAmigo</h3>
                <p className="text-sm text-white/80 mb-4">Need to change your plan or practice a specific topic?</p>
                <Link to="/app/chat" className="block relative group">
                  <div className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white/70 group-hover:bg-white/20 transition-colors flex justify-between items-center">
                    <span>Message PrepAmigo...</span>
                    <div className="w-8 h-8 flex items-center justify-center bg-white text-primary rounded-lg opacity-80 group-hover:opacity-100 transition-opacity">
                      <Icon name="arrow-up" />
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, color }: { title: string, value: string, icon: string, color: string }) {
  const colorMap: Record<string, string> = {
    primary: 'text-primary bg-primary/10',
    accent: 'text-accent bg-accent/10',
    warning: 'text-warning bg-warning/10'
  };

  return (
    <Card className="p-5 bg-surface border-border flex flex-col">
      <div className="flex items-center gap-2 text-sm text-secondary-text mb-2">
        <Icon name={icon} className={colorMap[color].split(' ')[0]} /> {title}
      </div>
      <div className="text-3xl font-bold text-primary-text">{value}</div>
    </Card>
  );
}
