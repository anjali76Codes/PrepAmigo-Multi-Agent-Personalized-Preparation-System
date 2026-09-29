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
      <div className="border-b border-border bg-surface shrink-0 z-10 sticky top-0 px-4 md:px-8 py-6">
        <h1 className="text-3xl font-bold text-carbon-900 mb-2">Welcome back!</h1>
        <p className="text-carbon-500">Here is your snapshot for today.</p>
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
                <h2 className="text-xl font-bold text-carbon-900">Today's Tasks</h2>
                <Link to="/app/preps/prep-1" className="text-sm text-forest-700 font-medium hover:underline">View Roadmap</Link>
              </div>
              
              <div className="space-y-3">
                {todayTasks.map(task => (
                  <Card key={task.dayNumber} variant="default" className="p-4 flex items-center justify-between group hover:border-forest-700/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center ${task.status === 'done' ? 'bg-carbon-900 border-carbon-900 text-white' : 'border-carbon-500/30'}`}>
                        {task.status === 'done' && <Icon name="checkmark" className="text-xs" />}
                      </div>
                      <span className={`font-medium ${task.status === 'done' ? 'text-carbon-500 line-through' : 'text-carbon-900'}`}>
                        {task.topic}
                      </span>
                    </div>
                    <span className="text-xs text-carbon-500 bg-bg px-2 py-1 rounded-control">{task.estimatedMinutes}m</span>
                  </Card>
                ))}
              </div>
            </RevealStaggerItem>

            <RevealStaggerItem className="space-y-6">
              <h2 className="text-xl font-bold text-carbon-900">Upcoming Due</h2>
              
              <Card variant="default" className="p-4 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center">
                    <Icon name="help-circle" />
                  </div>
                  <div>
                    <h4 className="font-bold text-carbon-900">System Design Quiz</h4>
                    <p className="text-xs text-amber-600 font-medium">Due Tomorrow</p>
                  </div>
                </div>
                <Link to="/app/practice" className="w-full">
                  <Button variant="primary" className="w-full">Start Quiz</Button>
                </Link>
              </Card>

              <Card variant="default" className="p-4 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-navy-100 text-navy-700 flex items-center justify-center">
                    <Icon name="albums" />
                  </div>
                  <div>
                    <h4 className="font-bold text-carbon-900">DSA Flashcards</h4>
                    <p className="text-xs text-carbon-500">12 cards to review</p>
                  </div>
                </div>
                <Link to="/app/practice" className="w-full">
                  <Button variant="outline" className="w-full">Review Now</Button>
                </Link>
              </Card>

              <Card variant="default" className="p-6 mt-8 flex flex-col shadow-pop">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-carbon-900">Ask PrepAmigo</h3>
                  <Mascot size="sm" mood="idle" className="bg-surface-muted text-carbon-900" />
                </div>
                <p className="text-sm text-carbon-500 mb-6">Need to change your plan or practice a specific topic?</p>
                <Link to="/app/chat" className="block w-full">
                  <div className="w-full bg-surface-muted border border-border rounded-control py-3 px-4 text-carbon-700 hover:bg-border transition-colors flex justify-between items-center cursor-pointer">
                    <span className="text-sm">Message PrepAmigo...</span>
                    <Icon name="arrow-up" />
                  </div>
                </Link>
              </Card>
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
    <Card variant="default" className="p-5 flex flex-col h-full hover:-translate-y-1 transition-transform">
      <div className="flex items-center gap-2 text-sm text-carbon-500 mb-3">
        <Icon name={icon} className={iconColor[tint]} /> {title}
      </div>
      <div className="text-3xl font-bold text-carbon-900 mt-auto">{value}</div>
    </Card>
  );
}
