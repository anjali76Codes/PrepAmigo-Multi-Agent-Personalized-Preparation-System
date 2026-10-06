import { useParams, Link } from "react-router-dom";
import { Icon } from "../components/ui/Icon";
import { Mascot } from "../components/ui/Mascot";
import { DayTaskCard } from "../components/ui/DayTaskCard";
import type { ResourceItem } from "../components/ui/DayTaskCard";
import { useState, useMemo } from "react";
import { useAppContext } from "../context/AppContext";
import { plansApi } from "../lib/api/plans";

function formatReferenceType(type?: string): string {
  if (!type) return "Article";
  const lower = type.toLowerCase();
  if (lower.includes("video") || lower.includes("youtube")) return "Video";
  if (lower.includes("book") || lower.includes("paper")) return "Book";
  if (lower.includes("doc")) return "Documentation";
  if (lower.includes("problem") || lower.includes("code") || lower.includes("leetcode")) return "Problem";
  if (lower.includes("course") || lower.includes("tutorial")) return "Course";
  return "Article";
}

export function LevelDetail() {
  const { sprintId, levelId } = useParams();
  const { activePrep } = useAppContext();
  
  // Find sprint from activePrep
  const sprintList = activePrep?.roadmap?.sprints || [];
  const parsedSprintNum = sprintId?.replace('sprint-', '');
  const sprint = sprintList.find((s: any, idx: number) => 
    s.id === sprintId || (idx + 1).toString() === parsedSprintNum || s.title?.includes(parsedSprintNum || '')
  ) || sprintList[0];
  
  // Get days for this sprint
  const allDays = (sprint?.days || []).map((d: any) => ({
    _id: d.id || `${sprint?.id}-day-${d.dayNumber}`,
    sprint_id: sprint?.id,
    day_number: d.dayNumber,
    scheduled_date: d.date,
    topic_title: d.topic,
    topic_description: d.objective || '',
    objectives: (d.objectives && d.objectives.length > 0) ? d.objectives : [d.objective].filter(Boolean),
    estimated_minutes: d.estimatedMinutes || 60,
    references: (d.rawReferences || []).map((r: any) => ({
      title: r.title || r.url,
      url: r.url,
      type: r.type,
      description: r.description,
    })),
    status: d.status === 'done' ? 'completed' : 'pending',
  }));

  // Distribute into levels (e.g., 3 days per level => 5 levels for 15 days)
  const daysPerLevel = 3;
  const levels = useMemo(() => {
    if (!sprint) return [];
    const lvlCount = Math.ceil(allDays.length / daysPerLevel);
    const allLevels = Array.from({ length: lvlCount }).map((_, i) => {
      return {
        id: `level-${i + 1}`,
        title: `Level ${i + 1}`,
        days: allDays.slice(i * daysPerLevel, (i + 1) * daysPerLevel)
      };
    });
    
    if (levelId) {
      const found = allLevels.find(l => l.id === levelId);
      if (found) return [found];
      return [];
    }
    return allLevels;
  }, [allDays, sprint, levelId]);

  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(
    new Set(allDays.filter(d => d.status === 'completed').map(d => d._id))
  );

  const toggleTask = (taskId: string) => {
    setCompletedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
    if (taskId && !taskId.includes('day-')) {
      void plansApi.completeDay(taskId).catch(err => {
        console.warn('[LevelDetail] Could not complete day on backend:', err);
      });
    }
  };

  if (!activePrep || !sprint) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-bg h-full">
        <Mascot variant="sad.png" size="xl" />
        <h2 className="text-2xl font-bold text-carbon-900">Sprint not found</h2>
        <Link to="/roadmap" className="text-navy-600 hover:underline">Go to Roadmap</Link>
      </div>
    );
  }

  const overallProgress = Math.round((completedTaskIds.size / Math.max(1, allDays.length)) * 100);

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <header className="bg-white border-b border-border px-6 md:px-12 py-5 shrink-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-carbon-500 hover:bg-surface-muted transition-colors">
            <Icon name="arrow-back" className="text-lg" />
          </Link>
          <div>
            <div className="text-xs font-bold text-carbon-400 uppercase tracking-wider">
              Sprint {(sprint as any).sprint_number || sprintList.indexOf(sprint) + 1}
            </div>
            <h1 className="text-2xl font-extrabold text-carbon-900">
              {(sprint as any).sprint_name || sprint.title}
            </h1>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <span className="text-sm font-bold text-carbon-500">{overallProgress}% Complete</span>
          <div className="w-32 h-2 rounded-full bg-surface-muted overflow-hidden">
            <div className="h-full bg-navy-700 rounded-full" style={{ width: `${overallProgress}%` }} />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 md:p-12 safe-area-bottom">
        <div className="max-w-3xl mx-auto space-y-10 pb-12">
          {levels.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-4 opacity-70">
              <Mascot variant="Chilling.png" size="lg" />
              <p className="font-bold text-lg">No days found for this sprint.</p>
            </div>
          )}

          {levels.map((level) => (
            <div key={level.id} className="space-y-4">
              <h3 className="text-lg font-bold text-carbon-800 border-b border-border pb-2">
                {level.title}
              </h3>
              
              <div className="space-y-3">
                {level.days.map(day => {
                  // Map objectives and references to ResourceItem format for the DayTaskCard
                  const resources: ResourceItem[] = [
                    ...day.objectives.map((obj: string, idx: number) => ({
                      id: `obj-${day._id}-${idx}`,
                      type: "Note",
                      title: obj,
                      url: "#"
                    })),
                    ...day.references.map((ref: any, idx: number) => ({
                      id: `ref-${day._id}-${idx}`,
                      type: formatReferenceType(ref.type),
                      title: ref.title || ref.url,
                      url: ref.url
                    }))
                  ];

                  // Add a dummy video if it's empty to show the dropdown working
                  if (day.references.length === 0) {
                    resources.push({
                      id: 'dummy-vid',
                      type: 'Video',
                      title: 'Watch ' + day.topic_title + ' Tutorial',
                      url: 'https://youtube.com'
                    });
                  }

                  return (
                    <DayTaskCard
                      key={day._id}
                      variant="full"
                      title={`Day ${day.day_number}: ${day.topic_title}`}
                      completed={completedTaskIds.has(day._id)}
                      resources={resources}
                      onToggleComplete={() => toggleTask(day._id)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
