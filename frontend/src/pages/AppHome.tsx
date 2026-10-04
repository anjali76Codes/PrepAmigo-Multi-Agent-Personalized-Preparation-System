import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import { Mascot } from '../components/ui/Mascot';
import { Alert } from '../components/ui/Alert';
import { RevealStagger, RevealStaggerItem } from '../components/ui/Reveal';
import { SprintMap } from '../components/chat/AgentJourney';
import { unifiedGoal } from '../data/newMockData';
import { getGoalProgressPct, getGoalTotalXP, getDaysLeft, getSprintNodeStates } from '../data/selectors';

export function AppHome() {
  const navigate = useNavigate();
  
  // Create a mock completed tasks set. Ideally this comes from AppContext.
  const completedTasks = new Set<string>();

  const missedTasks = 1;
  const daysLeft = getDaysLeft(unifiedGoal);
  const progressPct = getGoalProgressPct(unifiedGoal, completedTasks);
  const xp = getGoalTotalXP(unifiedGoal, completedTasks);

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <div className="bg-bg shrink-0 z-10 sticky top-0 px-6 md:px-12 py-6 border-b border-border space-y-6">

        <div className="bg-lavender-100 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6 shadow-pop border border-chrome-accent/50 relative overflow-hidden">
          {/* LEFT: text */}
          <div className="relative z-10 flex-1 min-w-0">
            <h3 className="text-2xl md:text-3xl font-extrabold text-navy-900 mb-2">Welcome home!</h3>
            <p className="text-base md:text-lg text-navy-800/80 font-medium max-w-xl">
              Ready to pick up where you left off? PrepAmigo has everything lined up for you today.
            </p>
          </div>

          {/* MIDDLE: stats */}
          <div className="relative z-10 shrink-0 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-white/60 backdrop-blur-sm border border-navy-900/10 rounded-xl px-4 py-2 flex flex-col gap-1 min-w-[110px]">
                <span className="text-xs font-bold text-navy-700/80 uppercase">Progress</span>
                <span className="font-bold text-navy-900">{progressPct}%</span>
              </div>
              <div className="bg-white/60 backdrop-blur-sm border border-navy-900/10 rounded-xl px-4 py-2 flex flex-col gap-1 min-w-[110px]">
                <span className="text-xs font-bold text-navy-700/80 uppercase">Total XP</span>
                <span className="font-bold text-navy-900">{xp.toLocaleString()}</span>
              </div>
            </div>

            <div className="bg-white/60 backdrop-blur-sm border border-navy-900/10 rounded-xl px-4 py-2 flex items-center gap-2">
              <Icon name="calendar" className="text-navy-500" />
              <span className="font-bold text-navy-900">{daysLeft} days left</span>
              <span className="text-sm font-medium text-navy-700/80">until your interview</span>
            </div>
          </div>

          {/* RIGHT: mascot */}
          <div className="relative z-10 hidden sm:flex shrink-0 items-center justify-center">
            <Mascot size="lg" variant="Celebration.png" className="bg-white shadow-card rounded-full p-2" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-12 relative safe-area-bottom">
        <RevealStagger className="w-full space-y-8 pb-12">


          <div className="grid lg:grid-cols-6 gap-8">
            {/* Center Column - Sprints */}
            <RevealStaggerItem className="space-y-6 lg:col-span-4">
              <div className="flex justify-between items-end">
                <h2 className="text-xl font-bold text-carbon-900">Sprints</h2>
                <Link to="/roadmap" className="text-sm text-navy-700 font-bold hover:underline flex items-center gap-1">View Full Roadmap <Icon name="arrow-forward" /></Link>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {unifiedGoal.sprints.map((sprint) => {
                  const nodeStates = getSprintNodeStates(sprint, completedTasks);
                  return (
                  <div key={sprint.id} className="bg-white rounded-2xl p-5 border border-border shadow-sm flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-lg text-carbon-900">{sprint.title}</h3>
                        <p className="text-sm text-carbon-500">{sprint.goal}</p>
                      </div>
                      <span className="text-xs font-bold bg-lavender-100 text-navy-700 px-2 py-1 rounded-md">{sprint.levels.length} Levels</span>
                    </div>

                    {/* AgentJourney Map */}
                    <div className="relative w-full mt-2 bg-surface-muted/30 rounded-xl overflow-hidden flex items-center">
                      <SprintMap
                        sprintId={sprint.id}
                        nodeStates={nodeStates}
                        levelIds={sprint.levels.map(l => l.id)}
                        onNodeClick={(levelId) => navigate(`/dashboard/${sprint.id}/${levelId}`)}
                        className="border-none shadow-none bg-transparent"
                      />
                    </div>
                  </div>
                )})}
              </div>
            </RevealStaggerItem>

            {/* Right Column - Quick Links */}
            <RevealStaggerItem className="space-y-6 lg:col-span-2">

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
              <h2 className="text-xl font-bold text-carbon-900">Quick Links</h2>

              <Link to="/dashboard/interview-prep" className="block">
                <div className="bg-navy-900 rounded-[2rem] p-6 flex flex-row gap-4 text-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] hover:scale-[1.02] transition-transform">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 text-white flex items-center justify-center mb-2">
                    <Icon name="briefcase-outline" className="text-2xl" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Interview Prep</h4>
                    <p className="text-sm text-white/70">Practice mocks and questions</p>
                  </div>
                </div>
              </Link>

              <Link to="/dashboard/preps" className="block">
                <div className="bg-white rounded-[2rem] p-6 flex flex-row gap-4 border border-border shadow-sm hover:scale-[1.02] transition-transform">
                  <div className="w-12 h-12 rounded-2xl bg-surface-muted text-carbon-700 flex items-center justify-center mb-2">
                    <Icon name="map-outline" className="text-2xl" />
                  </div>

                  <div>
                    <h4 className="font-bold text-lg text-carbon-900">Preps</h4>
                    <p className="text-sm text-carbon-500">Manage your active preparations</p>
                  </div>
                </div>
              </Link>

              <Link to="/dashboard/progress" className="block">
                <div className="bg-white rounded-[2rem] p-6 flex flex-row gap-4 border border-border shadow-sm hover:scale-[1.02] transition-transform">
                  <div className="w-12 h-12 rounded-2xl bg-surface-muted text-carbon-700 flex items-center justify-center mb-2">
                    <Icon name="bar-chart-outline" className="text-2xl" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-carbon-900">Progress</h4>
                    <p className="text-sm text-carbon-500">View your stats and XP</p>
                  </div>
                </div>
              </Link>

              <div className="bg-lavender-100 rounded-[2rem] p-6 mt-8 flex flex-col shadow-pop border border-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-xl text-carbon-900">Ask PrepAmigo</h3>
                  <Mascot size="sm" variant="Chilling.png" className="bg-surface-muted text-carbon-900 rounded-full p-1" />
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

