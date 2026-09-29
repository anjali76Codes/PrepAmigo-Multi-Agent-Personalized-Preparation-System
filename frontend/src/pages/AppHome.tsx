import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import { Mascot } from '../components/ui/Mascot';
import { Alert } from '../components/ui/Alert';
import { RevealStagger, RevealStaggerItem } from '../components/ui/Reveal';
import { useAppContext } from '../context/AppContext';

export function AppHome() {
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
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <div className="bg-bg shrink-0 z-10 sticky top-0 px-4 md:px-8 py-8 md:py-12 border-b border-border">
        <h1 className="text-4xl font-extrabold text-carbon-900 mb-2 tracking-tight">Welcome back!</h1>
        <p className="text-lg text-carbon-500">Here is your snapshot for today.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 relative safe-area-bottom">
        <RevealStagger className="max-w-6xl mx-auto space-y-8 pb-12">
          
          {missedTasks > 0 && (
            <RevealStaggerItem>
              <Alert variant="warning" icon="warning">
                <div className="flex items-center justify-between w-full">
                  <div>
                    <h4 className="font-bold text-amber-800">You have {missedTasks} missed task</h4>
                    <p className="text-sm opacity-80">PrepAmigo can reschedule this for you.</p>
                  </div>
                  <Link to="/app/chat">
                    <Button variant="primary" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white border-none shadow-none">
                      Reschedule
                    </Button>
                  </Link>
                </div>
              </Alert>
            </RevealStaggerItem>
          )}

          <RevealStaggerItem className="grid md:grid-cols-4 gap-4">
            <MetricCard title="Days Left" value={daysLeft.toString()} icon="calendar" tint="sky" />
            <MetricCard title="Readiness" value={`${readiness}%`} icon="bar-chart" tint="coral" />
            <MetricCard title="Day Streak" value={streak.toString()} icon="flame" tint="sunny" />
            <MetricCard title="Total XP" value={xp.toLocaleString()} icon="star" tint="forest" />
          </RevealStaggerItem>

          <div className="grid md:grid-cols-3 gap-8">
            <RevealStaggerItem className="md:col-span-2 space-y-6">
              <div className="flex justify-between items-end">
                <h2 className="text-2xl font-bold text-carbon-900">Today's Tasks</h2>
                <Link to="/app/preps/prep-1" className="text-sm text-chrome-accent font-medium hover:underline">View Roadmap</Link>
              </div>
              
              <div className="space-y-3">
                {todayTasks.map(task => (
                  <div key={task.dayNumber} className="bg-white rounded-2xl p-5 flex items-center justify-between group hover:shadow-pop transition-all border border-border">
                    <div className="flex items-center gap-4">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${task.status === 'done' ? 'bg-chrome-accent border-chrome-accent text-white' : 'border-carbon-500/30'}`}>
                        {task.status === 'done' && <Icon name="checkmark" className="text-sm" />}
                      </div>
                      <span className={`font-semibold text-lg ${task.status === 'done' ? 'text-carbon-500 line-through' : 'text-carbon-900'}`}>
                        {task.topic}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-carbon-500 bg-surface-muted px-3 py-1.5 rounded-full">{task.estimatedMinutes}m</span>
                  </div>
                ))}
              </div>
            </RevealStaggerItem>

            <RevealStaggerItem className="space-y-6">
              <h2 className="text-2xl font-bold text-carbon-900">Upcoming Due</h2>
              
              <div className="bg-navy-900 rounded-[2rem] p-6 flex flex-col gap-5 text-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)]">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 text-white flex items-center justify-center">
                    <Icon name="help-circle" className="text-2xl" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">System Design Quiz</h4>
                    <p className="text-sm text-chrome-accent font-medium">Due Tomorrow</p>
                  </div>
                </div>
                <Link to="/app/practice" className="w-full">
                  <Button variant="primary" className="w-full bg-chrome-accent hover:bg-chrome-accent/90 text-chrome border-none">Start Quiz</Button>
                </Link>
              </div>

              <div className="bg-white rounded-[2rem] p-6 flex flex-col gap-5 border border-border">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-surface-muted text-carbon-700 flex items-center justify-center">
                    <Icon name="albums" className="text-2xl" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-carbon-900">DSA Flashcards</h4>
                    <p className="text-sm text-carbon-500">12 cards to review</p>
                  </div>
                </div>
                <Link to="/app/practice" className="w-full">
                  <Button variant="outline" className="w-full rounded-xl">Review Now</Button>
                </Link>
              </div>

              <div className="bg-white rounded-[2rem] p-6 mt-8 flex flex-col shadow-pop border border-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-xl text-carbon-900">Ask PrepAmigo</h3>
                  <Mascot size="sm" mood="idle" className="bg-surface-muted text-carbon-900" />
                </div>
                <p className="text-sm text-carbon-500 mb-6">Need to change your plan or practice a specific topic?</p>
                <Link to="/app/chat" className="block w-full">
                  <div className="w-full bg-surface border border-border rounded-xl py-3 px-4 text-carbon-700 hover:bg-surface-muted transition-colors flex justify-between items-center cursor-pointer">
                    <span className="text-sm font-medium">Message PrepAmigo...</span>
                    <Icon name="arrow-up" />
                  </div>
                </Link>
              </div>
            </RevealStaggerItem>
          </div>
        </RevealStagger>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, tint }: { title: string, value: string, icon: string, tint: 'sky' | 'coral' | 'sunny' | 'forest' }) {
  const iconColor = {
    sky: 'text-sky-500',
    coral: 'text-coral-500',
    sunny: 'text-sunny-500',
    forest: 'text-forest-700',
  };

  return (
    <div className="bg-white border border-border rounded-[2rem] p-6 flex flex-col h-full hover:-translate-y-1 hover:shadow-pop transition-all">
      <div className="flex items-center gap-3 text-sm font-semibold text-carbon-500 mb-4 uppercase tracking-wider">
        <Icon name={icon} className={`text-lg ${iconColor[tint]}`} /> {title}
      </div>
      <div className="text-4xl font-extrabold text-carbon-900 mt-auto">{value}</div>
    </div>
  );
}
