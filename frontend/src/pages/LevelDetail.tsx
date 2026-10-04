import { useParams, Link } from "react-router-dom";
import { Icon } from "../components/ui/Icon";
import { Mascot } from "../components/ui/Mascot";
import { DayTaskCard } from "../components/ui/DayTaskCard";
import { useState } from "react";
import { mockLevelData } from "../data/mockSprints";

export function LevelDetail() {
  const { sprintId, levelId } = useParams();
  
  // In a real app, fetch based on sprintId and levelId
  const data = mockLevelData;
  const [days, setDays] = useState(data.days);

  const toggleTask = (dayId: string, taskId: string) => {
    setDays(days.map(d => {
      if (d.id === dayId) {
        return {
          ...d,
          tasks: d.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t)
        };
      }
      return d;
    }));
  };

  if (!data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-bg h-full">
        <Mascot variant="sad.png" size="xl" />
        <h2 className="text-2xl font-bold text-carbon-900">Level not found</h2>
        <Link to="/dashboard" className="text-navy-600 hover:underline">Go back home</Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <header className="bg-white border-b border-border px-6 md:px-12 py-5 shrink-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-carbon-500 hover:bg-surface-muted transition-colors">
            <Icon name="arrow-back" className="text-lg" />
          </Link>
          <div>
            <div className="text-xs font-bold text-carbon-400 uppercase tracking-wider">
              {sprintId} &middot; {levelId}
            </div>
            <h1 className="text-2xl font-extrabold text-carbon-900">
              {data.title}
            </h1>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <span className="text-sm font-bold text-carbon-500">{data.progress}% Complete</span>
          <div className="w-32 h-2 rounded-full bg-surface-muted overflow-hidden">
            <div className="h-full bg-navy-700 rounded-full" style={{ width: `${data.progress}%` }} />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 md:p-12 safe-area-bottom">
        <div className="max-w-3xl mx-auto space-y-10 pb-12">
          {days.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-4 opacity-70">
              <Mascot variant="Chilling.png" size="lg" />
              <p className="font-bold text-lg">No days found for this level.</p>
            </div>
          )}

          {days.map((day) => (
            <div key={day.id} className="space-y-4">
              <h3 className="text-lg font-bold text-carbon-800 border-b border-border pb-2">
                Day {day.number} : {day.date}
              </h3>
              
              <div className="space-y-3">
                {day.tasks.map(task => (
                  <DayTaskCard
                    key={task.id}
                    variant="full"
                    title={task.title}
                    completed={task.completed}
                    resources={task.resources}
                    onToggleComplete={() => toggleTask(day.id, task.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
