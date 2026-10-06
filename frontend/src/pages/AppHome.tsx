import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Mascot } from '../components/ui/Mascot';
import { Alert } from '../components/ui/Alert';
import { RevealStagger, RevealStaggerItem } from '../components/ui/Reveal';
import { SprintMap } from '../components/chat/AgentJourney';
import { useAppContext } from '../context/AppContext';
import { levelStates } from '../lib/levels';

const QUICK_LINKS = [
  { to: '/dashboard/interview-prep', icon: 'briefcase-outline', title: 'Interview Prep', sub: 'Practice mocks and questions', dark: true },
  { to: '/roadmap', icon: 'git-network-outline', title: 'Roadmap & Sprints', sub: 'View your active preparation sprints' },
  // { to: '/assessment', icon: 'help-circle', title: 'Quizzes & Flashcards', sub: 'Test what you have learned' },
  { to: '/dashboard/progress', icon: 'bar-chart-outline', title: 'Progress', sub: 'View your stats and XP' },
];

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface border border-border rounded-2xl px-4 py-3 min-w-[110px]">
      <div className="text-xs font-semibold text-carbon-500 uppercase tracking-wide">{label}</div>
      <div className="text-xl font-extrabold text-carbon-900 mt-0.5">{value}</div>
    </div>
  );
}

export function AppHome() {
  const navigate = useNavigate();
  const { activePrep } = useAppContext();

  const allDays = (activePrep?.roadmap?.sprints || []).flatMap((s: any) => s.days || []);
  const totalDays = allDays.length || activePrep?.durationDays || 30;
  const completedCount = allDays.filter((d: any) => d.status === 'done').length;
  const progressPct = totalDays > 0 ? Math.round((completedCount / totalDays) * 100) : 0;
  const xp = (activePrep?.learningContext?.progress?.xp || 0) + completedCount * 50;
  const daysLeft = Math.max(0, totalDays - completedCount);
  const missedTasks = 0;

  const sprints = (activePrep?.roadmap?.sprints || []).map((s: any, idx: number) => {
    const days = s.days || [];
    const levels: any[] = [];
    let levelIdx = 1;
    let assessIdx = 1;
    for (let i = 0; i < days.length; i += 7) {
      const chunk = days.slice(i, i + 7);
      if (chunk.length > 0) {
        levels.push({
          id: `level-${levelIdx}`,
          title: `Level ${levelIdx}`,
          status: chunk.slice(0, 1).every((d: any) => d.status === 'done') ? 'completed' : 'unlocked',
        });
        levelIdx++;
      }
      if (chunk.length > 1) {
        levels.push({
          id: `level-${levelIdx}`,
          title: `Level ${levelIdx}`,
          status: chunk.slice(1, 3).every((d: any) => d.status === 'done') ? 'completed' : 'unlocked',
        });
        levelIdx++;
      }
      if (chunk.length > 0) {
        levels.push({
          id: `assessment-${assessIdx}`,
          title: `Assessment ${assessIdx}`,
          status: chunk.slice(0, 3).every((d: any) => d.status === 'done') ? 'completed' : 'unlocked',
        });
        assessIdx++;
      }
      if (chunk.length > 3) {
        levels.push({
          id: `level-${levelIdx}`,
          title: `Level ${levelIdx}`,
          status: chunk.slice(3, 5).every((d: any) => d.status === 'done') ? 'completed' : 'unlocked',
        });
        levelIdx++;
      }
      if (chunk.length > 5) {
        levels.push({
          id: `level-${levelIdx}`,
          title: `Level ${levelIdx}`,
          status: chunk.slice(5, 7).every((d: any) => d.status === 'done') ? 'completed' : 'unlocked',
        });
        levelIdx++;
      }
      if (chunk.length > 3) {
        levels.push({
          id: `assessment-${assessIdx}`,
          title: `Assessment ${assessIdx}`,
          status: chunk.slice(3, 7).every((d: any) => d.status === 'done') ? 'completed' : 'unlocked',
        });
        assessIdx++;
      }
    }
    return {
      id: s.id || `sprint-${idx + 1}`,
      title: s.title || `Sprint ${idx + 1}`,
      goal: s.focus || `Sprint ${idx + 1} preparation`,
      levels,
      days,
    };
  });

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      {/* One scroll container: the welcome card is inside it, so it scrolls with the page */}
      <div className="flex-1 overflow-y-auto safe-area-bottom">
        <RevealStagger className="w-full px-6 md:px-12 py-6 md:py-8 space-y-8 pb-12">

          {/* Welcome */}
          <RevealStaggerItem>
            <Card variant="default" className="bg-lavender-100 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-extrabold text-carbon-900 mb-2">Welcome home!</h1>
                <p className="text-base md:text-lg text-carbon-700 font-medium max-w-xl">
                  {activePrep
                    ? `You're preparing for ${activePrep.learningContext?.targetRole || 'your target role'} at ${activePrep.learningContext?.companyInfo?.name || 'your target company'}.`
                    : 'Ready to kick off your preparation? PrepAmigo is ready to build your custom roadmap.'}
                </p>
              </div>

              <div className="shrink-0 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Stat label="Progress" value={`${progressPct}%`} />
                  <Stat label="Total XP" value={xp.toLocaleString()} />
                </div>
                <div className="bg-surface border border-border rounded-2xl px-4 py-3 flex items-center gap-2">
                  <Icon name="calendar" className="text-chrome" />
                  <span className="font-bold text-carbon-900">{daysLeft} days left</span>
                  <span className="text-sm text-carbon-500">in your roadmap</span>
                </div>
              </div>

              <div className="hidden sm:flex shrink-0 items-center justify-center">
                <Mascot size="lg" variant="working.png" className="bg-surface border border-border rounded-full p-2" />
              </div>
            </Card>
          </RevealStaggerItem>

          <div className="grid lg:grid-cols-5 gap-8">
            {/* Sprints */}
            <RevealStaggerItem className="space-y-5 lg:col-span-4">
              <div className="flex justify-between items-end">
                <h2 className="text-xl font-bold text-carbon-900">Sprints</h2>
                <Link to="/roadmap" className="text-sm text-chrome font-bold hover:underline flex items-center gap-1">
                  View Full Roadmap <Icon name="arrow-forward" />
                </Link>
              </div>

              {sprints.length === 0 ? (
                <Card variant="default" className="p-8 text-center flex flex-col items-center gap-3">
                  <Mascot size="lg" variant="working.png" />
                  <h3 className="text-lg font-bold text-carbon-900">No active sprints</h3>
                  <p className="text-sm text-carbon-500">Start your preparation in chat to generate your study plan.</p>
                  <Link to="/dashboard/chat">
                    <Button>Create Plan in Chat</Button>
                  </Link>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {sprints.map((sprint: any) => {
                    const nodeStates = levelStates(sprint.levels.map((l: any) => l.status === 'completed'));
                    return (
                      <Card key={sprint.id} variant="default" className="p-5 flex flex-col gap-4">
                        <div className="flex justify-between items-start gap-3">
                          <div>
                            <h3 className="font-bold text-lg text-carbon-900">{sprint.title}</h3>
                            <p className="text-sm text-carbon-500">{sprint.goal}</p>
                          </div>
                          <span className="text-xs font-bold bg-lavender-100 border border-border text-chrome px-3 py-1 rounded-full shrink-0">
                            {sprint.levels.length} Levels
                          </span>
                        </div>

                        <div className="relative w-full bg-lavender-50 rounded-2xl overflow-hidden flex items-center">
                          <SprintMap
                            sprintId={sprint.id}
                            nodeStates={nodeStates}
                            levelIds={sprint.levels.map((l: any) => l.id)}
                            onNodeClick={(levelId) => navigate(`/dashboard/${sprint.id}/${levelId}`)}
                            className="border-none shadow-none bg-transparent"
                          />
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </RevealStaggerItem>

            {/* Quick links */}
            <RevealStaggerItem className="space-y-4 lg:col-span-1">
              {missedTasks > 0 && (
                <Alert variant="warning" icon="warning">
                  <div className="flex items-center justify-between gap-3 w-full">
                    <div>
                      <h4 className="font-bold text-beige-600">You have {missedTasks} missed task</h4>
                      <p className="text-sm opacity-80">PrepAmigo can reschedule this for you.</p>
                    </div>
                    <Link to="/dashboard/chat">
                      <Button size="sm">Reschedule</Button>
                    </Link>
                  </div>
                </Alert>
              )}

              <h2 className="text-xl font-bold text-carbon-900">Quick Links</h2>

              {QUICK_LINKS.map((l) => (
                <Link key={l.to} to={l.to} className="block">
                  <Card
                    variant={l.dark ? 'chrome' : 'default'}
                    className="rounded-3xl p-5 flex flex-row gap-4 hover:scale-[1.02] transition-transform"
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${l.dark ? 'bg-chrome-hover text-on-chrome' : 'bg-lavender-100 text-chrome'}`}>
                      <Icon name={l.icon} className="text-2xl" />
                    </div>
                    <div>
                      <h4 className={`font-bold text-lg ${l.dark ? 'text-white' : 'text-carbon-900'}`}>{l.title}</h4>
                      <p className={`text-sm ${l.dark ? 'text-on-chrome-muted' : 'text-carbon-500'}`}>{l.sub}</p>
                    </div>
                  </Card>
                </Link>
              ))}

              <Card variant="default" className="bg-lavender-100 rounded-3xl p-6 mt-4 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-xl text-carbon-900">Ask PrepAmigo</h3>
                  <Mascot size="md" variant="nosy.png" className="bg-chrome border border-border rounded-full" />
                </div>
                <p className="text-sm text-carbon-500 mb-5">Need to change your plan or practice a specific topic?</p>
                <Link to="/dashboard/chat" className="block w-full">
                  <div className="w-full bg-surface border border-border rounded-full py-3 px-4 text-carbon-700 hover:bg-surface-muted transition-colors flex justify-between items-center">
                    <span className="text-sm font-medium">Message PrepAmigo...</span>
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