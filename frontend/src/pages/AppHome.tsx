import { Link } from 'react-router-dom';
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
  const progressPct = 65;
  const xp = prep.learningContext.progress.xp;

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <div className="bg-bg shrink-0 z-10 sticky top-0 px-6 md:px-12 py-6 border-b border-border space-y-6">

        <div className="bg-lavender-100 rounded-3xl p-6 md:p-8 flex items-center justify-between shadow-pop border border-chrome-accent/50 relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-2xl md:text-3xl font-extrabold text-navy-900 mb-2">Welcome home!</h3>
            <p className="text-base md:text-lg text-navy-800/80 font-medium max-w-4xl">Ready to pick up where you left off? PrepAmigo has everything lined up for you today.</p>

            <div className="mt-4 bg-white/60 backdrop-blur-sm border border-navy-900/10 rounded-xl px-4 py-2 inline-flex items-center gap-2">
              <Icon name="calendar" className="text-navy-500" />
              <span className="font-bold text-navy-900">{daysLeft} days left</span>
              <span className="text-sm font-medium text-navy-700/80">until your interview</span>
            </div>
          </div>
          <div className="relative z-10 hidden sm:block shrink-0">
            <Mascot size="lg" mood="cheer" className="bg-white shadow-card rounded-full p-2" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-12 relative safe-area-bottom">
        <RevealStagger className="w-full space-y-8 pb-12">

          {missedTasks > 0 && (
            <RevealStaggerItem>
              <Alert variant="warning" icon="warning">
                <div className="flex items-center justify-between w-full">
                  <div>
                    <h4 className="font-bold text-beige-800">You have {missedTasks} missed task</h4>
                    <p className="text-sm opacity-80">PrepAmigo can reschedule this for you.</p>
                  </div>
                  <Link to="/dashboard/chat">
                    <Button variant="primary" size="sm" className="bg-beige-600 hover:bg-beige-700 text-white border-none shadow-none">
                      Reschedule
                    </Button>
                  </Link>
                </div>
              </Alert>
            </RevealStaggerItem>
          )}

          <div className="grid lg:grid-cols-6 gap-8">
            {/* Left Column - Metrics */}
            <RevealStaggerItem className="space-y-4 lg:col-span-1">
              <h2 className="text-xl font-bold text-carbon-900 mb-2">Overview</h2>
              <MetricCard title="Progress" value={`${progressPct}%`} icon="bar-chart" tint="coral" />
              <MetricCard title="Total XP" value={xp.toLocaleString()} icon="star" tint="forest" />
            </RevealStaggerItem>

            {/* Center Column - Tasks */}
            <RevealStaggerItem className="space-y-6 lg:col-span-3">
              <div className="flex justify-between items-end">
                <h2 className="text-xl font-bold text-carbon-900">Today's Tasks</h2>
                <Link to="/dashboard/calendar" className="text-sm text-navy-700 font-bold hover:underline flex items-center gap-1">Open Calendar <Icon name="arrow-forward" /></Link>
              </div>

              <div className="space-y-3">
                {todayTasks.map(task => (
                  <Link to="/dashboard/calendar" key={task.dayNumber} className="block">
                    <div className="bg-lavender-100 rounded-2xl p-5 flex items-center justify-between group hover:shadow-pop transition-all border border-border">
                      <div className="flex items-center gap-4">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${task.status === 'done' ? 'bg-chrome-accent border-chrome-accent text-white' : 'border-carbon-500/30 group-hover:border-navy-500'}`}>
                          {task.status === 'done' && <Icon name="checkmark" className="text-sm" />}
                        </div>
                        <span className={`font-semibold text-lg transition-colors ${task.status === 'done' ? 'text-carbon-400 line-through' : 'text-carbon-900 group-hover:text-navy-700'}`}>
                          {task.topic}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-carbon-500 bg-surface-muted px-3 py-1.5 rounded-full">{task.estimatedMinutes}m</span>
                    </div>
                  </Link>
                ))}
              </div>
            </RevealStaggerItem>

            {/* Right Column - Upcoming */}
            <RevealStaggerItem className="space-y-6 lg:col-span-2">
              <h2 className="text-xl font-bold text-carbon-900">Upcoming Due</h2>

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
                <Link to="/dashboard/roadmap" className="w-full">
                  <Button variant="primary" className="w-full bg-chrome-accent hover:bg-chrome-accent/90 text-chrome border-none rounded-full">Start Quiz</Button>
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
                <Link to="/dashboard/roadmap" className="w-full">
                  <Button variant="outline" className="w-full rounded-full">Review Now</Button>
                </Link>
              </div>

              <div className="bg-lavender-100 rounded-[2rem] p-6 mt-8 flex flex-col shadow-pop border border-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-xl text-carbon-900">Ask PrepAmigo</h3>
                  <Mascot size="sm" mood="idle" className="bg-surface-muted text-carbon-900" />
                </div>
                <p className="text-sm text-carbon-500 mb-6">Need to change your plan or practice a specific topic?</p>
                <Link to="/dashboard/chat" className="block w-full">
                  <div className="w-full bg-surface border border-border rounded-full py-3 px-4 text-carbon-700 hover:bg-surface-muted transition-colors flex justify-between items-center cursor-pointer">
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
    sunny: 'text-beige-500',
    forest: 'text-navy-700',
  };

  return (
    <div className="bg-white border border-border rounded-3xl p-5 flex flex-col justify-between hover:-translate-y-1 shadow-card transition-all text-carbon-900 min-h-[140px]">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-surface-muted ${iconColor[tint]}`}>
          <Icon name={icon} className="text-xl" />
        </div>
        <div className="text-sm font-bold text-carbon-500">{title}</div>
      </div>
      <div className="text-2xl font-extrabold text-carbon-900 mt-4 tracking-tight">{value}</div>
    </div>
  );
}
