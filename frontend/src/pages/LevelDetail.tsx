import { useParams, Link, useNavigate, Navigate } from "react-router-dom";
import { useState, useMemo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Icon } from "../components/ui/Icon";
import { Mascot } from "../components/ui/Mascot";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { DayTaskCard } from "../components/ui/DayTaskCard";
import type { ResourceItem } from "../components/ui/DayTaskCard";
import { useAppContext } from "../context/AppContext";
import { plansApi } from "../lib/api/plans";
import { levelStates } from "../lib/levels";
import { cn } from "../utils/utils";
import { buildSprintLevelNodes } from "../lib/sprintLevels";

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

type Pop = null | { kind: "locked" } | { kind: "task" } | { kind: "level" };

export function LevelDetail() {
  const { sprintId, levelId } = useParams();
  const navigate = useNavigate();
  const { activePrep, refreshPreps } = useAppContext();

  const sprintList = activePrep?.roadmap?.sprints || [];
  const parsedSprintNum = sprintId?.replace("sprint-", "");
  const sprint =
    sprintList.find(
      (s: any, idx: number) =>
        s.id === sprintId || (idx + 1).toString() === parsedSprintNum || s.title?.includes(parsedSprintNum || "")
    ) || sprintList[0];

  const allDays = (sprint?.days || []).map((d: any) => ({
    _id: d.id || `${sprint?.id}-day-${d.dayNumber}`,
    sprint_id: sprint?.id,
    day_number: d.dayNumber,
    scheduled_date: d.date,
    topic_title: d.topic,
    topic_description: d.objective || "",
    objectives: d.objectives && d.objectives.length > 0 ? d.objectives : [d.objective].filter(Boolean),
    estimated_minutes: d.estimatedMinutes || 60,
    references: (d.rawReferences || []).map((r: any) => ({
      title: r.title || r.url,
      url: r.url,
      type: r.type,
      description: r.description,
    })),
    status: d.status === "done" ? "completed" : "pending",
  }));

  const allLevels = useMemo(() => {
    if (!sprint) return [];
    return buildSprintLevelNodes(allDays)
      .filter((node) => !node.isAssessment)
      .map(({ id, title, days }) => ({ id, title, days }));
  }, [allDays, sprint]);

  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(
    new Set(allDays.filter((d: any) => d.status === "completed").map((d: any) => d._id))
  );
  const [pop, setPop] = useState<Pop>(null);
  const completionSaveRef = useRef<Promise<void> | null>(null);

  // small "task done" popup closes itself
  useEffect(() => {
    if (pop?.kind !== "task") return;
    const t = setTimeout(() => setPop(null), 1600);
    return () => clearTimeout(t);
  }, [pop]);

  const states = levelStates(allLevels.map((l) => l.days.every((d: any) => completedTaskIds.has(d._id))));
  const levelIndex = allLevels.findIndex((l) => l.id === levelId);
  const level = allLevels[levelIndex];
  const locked = levelIndex >= 0 && states[levelIndex] === "locked";
  const currentIndex = Math.max(0, states.indexOf("current"));
  const nextLevel = allLevels[levelIndex + 1];

  const toggleTask = (taskId: string) => {
    if (!level) return;
    if (locked) {
      setPop({ kind: "locked" });
      return;
    }
    const wasDone = completedTaskIds.has(taskId);
    const next = new Set(completedTaskIds);
    if (wasDone) next.delete(taskId);
    else next.add(taskId);
    setCompletedTaskIds(next);

    if (taskId && !taskId.includes("day-")) {
      completionSaveRef.current = plansApi.completeDay(taskId).then(() => refreshPreps()).catch((err) => {
        console.warn("[LevelDetail] Could not complete day on backend:", err);
      });
    }
    if (!wasDone) {
      setPop({ kind: level.days.every((d: any) => next.has(d._id)) ? "level" : "task" });
    }
  };

  if (!activePrep || !sprint || !level) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-bg h-full">
        <Mascot variant="sad.png" size="xl" />
        <h2 className="text-2xl font-bold text-carbon-900">Level not found</h2>
        <Link to="/roadmap">
          <Button>Go to Roadmap</Button>
        </Link>
      </div>
    );
  }

  const sprintNumber = (sprint as any).sprint_number || sprintList.indexOf(sprint) + 1;
  const priorSprint = sprintList[sprintList.indexOf(sprint) - 1];
  if (priorSprint && (priorSprint.days || []).some((day: any) => day.status !== "done")) {
    const priorLevels = buildSprintLevelNodes(priorSprint.days || []).filter((node) => !node.isAssessment);
    const firstIncomplete = priorLevels.find((node) => node.days.some((day: any) => day.status !== "done"));
    return <Navigate to={`/dashboard/${priorSprint.id}/${firstIncomplete?.id || "level-1"}`} replace />;
  }
  const levelDoneCount = level.days.filter((d: any) => completedTaskIds.has(d._id)).length;
  const levelPct = Math.round((levelDoneCount / Math.max(1, level.days.length)) * 100);
  const sprintPct = Math.round((completedTaskIds.size / Math.max(1, allDays.length)) * 100);
  const levelComplete = levelDoneCount === level.days.length;
  const heroMascot = locked ? "Thinking.png" : levelComplete ? "Celebration.png" : "Motivated.png";
  const currentLevel = allLevels[currentIndex];
  const firstPendingId = level.days.find((d: any) => !completedTaskIds.has(d._id))?._id;

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <div className="flex-1 overflow-y-auto safe-area-bottom">
        <div className="w-full mx-auto px-6 md:px-12 py-6 md:py-8 space-y-8 pb-12">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card variant="default" className="bg-lavender-100 rounded-3xl p-6 md:p-8 flex items-center gap-6">
              <div className="flex-1 min-w-0 space-y-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 -ml-3 font-bold text-chrome"
                  onClick={() => navigate("/dashboard")}
                >
                  <Icon name="arrow-back" /> Dashboard
                </Button>
                <div>
                  <div className="text-xs font-bold text-carbon-500 uppercase tracking-wider">
                    Sprint {sprintNumber} · {(sprint as any).sprint_name || sprint.title}
                  </div>
                  <h1 className="text-2xl md:text-3xl font-extrabold text-carbon-900 flex items-center gap-2">
                    {level.title}
                    {locked && <Icon name="lock-closed-outline" className="text-xl text-carbon-500" />}
                  </h1>
                </div>

                <div className="max-w-sm space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-carbon-700">
                    <span>{levelDoneCount} / {level.days.length} tasks</span>
                    <span>{levelPct}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-surface overflow-hidden">
                    <motion.div
                      className="h-full bg-chrome rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${levelPct}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <div className="text-xs text-carbon-500">Sprint progress: {sprintPct}%</div>
                </div>
              </div>

              <div className="hidden sm:flex shrink-0 w-36 h-36 rounded-full bg-surface border border-border items-center justify-center">
                <motion.div
                  key={heroMascot}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <Mascot variant={heroMascot} size="lg" />
                </motion.div>
              </div>
            </Card>
          </motion.div>

          {/* Locked banner */}
          {locked && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex flex-wrap items-center gap-3 bg-beige-100/50 border border-chrome-accent rounded-2xl px-5 py-4"
            >
              <Icon name="lock-closed-outline" className="text-xl text-carbon-500" />
              <p className="flex-1 min-w-[200px] text-sm font-medium text-carbon-700">
                This level is locked. You can read everything here, but finish {currentLevel?.title} first to tick tasks off.
              </p>
              <Link to={`/dashboard/${sprintId}/${currentLevel?.id}`}>
                <Button size="sm">Go to {currentLevel?.title}</Button>
              </Link>
            </motion.div>
          )}

          {/* Task tree */}
          <div className="relative pl-10 max-w-7xl mx-auto">
            <motion.span
              className="absolute left-3 top-2 bottom-8 w-0.5 rounded-full bg-chrome-accent origin-top"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />

            <div className="space-y-4">
              {level.days.map((day: any, i: number) => {
                const done = completedTaskIds.has(day._id);

                const resources: ResourceItem[] = [
                  ...day.objectives.map((obj: string, idx: number) => ({
                    id: `obj-${day._id}-${idx}`,
                    type: "Note",
                    title: obj,
                    url: "#",
                  })),
                  ...day.references.map((ref: any, idx: number) => ({
                    id: `ref-${day._id}-${idx}`,
                    type: formatReferenceType(ref.type),
                    title: ref.title || ref.url,
                    url: ref.url,
                  })),
                ];
                if (day.references.length === 0) {
                  resources.push({
                    id: `dummy-vid-${day._id}`,
                    type: "Video",
                    title: "Watch " + day.topic_title + " Tutorial",
                    url: "https://youtube.com",
                  });
                }

                return (
                  <motion.div
                    key={day._id}
                    className="relative"
                    initial={{ opacity: 0, x: 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.12, duration: 0.3 }}
                  >
                    {/* branch line + dot */}
                    <motion.span
                      className={cn("absolute -left-7 top-7 h-0.5 w-7 origin-left", done ? "bg-chrome" : "bg-chrome-accent")}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: 0.3 + i * 0.12, duration: 0.3 }}
                    />
                    <motion.span
                      className={cn(
                        "absolute -left-8 top-6 w-2.5 h-2.5 rounded-full border-2 transition-colors",
                        done ? "bg-chrome border-chrome" : "bg-surface border-chrome-accent"
                      )}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.5 + i * 0.12, type: "spring", stiffness: 400, damping: 18 }}
                    />

                    <div className={cn(locked && "opacity-70")}>
                      <DayTaskCard
                        variant="full"
                        title={`Day ${day.day_number}: ${day.topic_title}`}
                        completed={done}
                        resources={resources}
                        onToggleComplete={() => toggleTask(day._id)}
                        defaultOpen={day._id === firstPendingId}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Prev / next level */}
          <div className="flex items-center justify-between gap-3">
            {levelIndex > 0 ? (
              <Link to={`/dashboard/${sprintId}/${allLevels[levelIndex - 1].id}`}>
                <Button variant="accent" className="border gap-2">
                  <Icon name="arrow-back" /> {allLevels[levelIndex - 1].title}
                </Button>
              </Link>
            ) : <span />}
            {nextLevel && (
              <Link to={`/dashboard/${sprintId}/${nextLevel.id}`}>
                <Button variant="accent" className="border gap-2">
                  {nextLevel.title} <Icon name="arrow-forward" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Popups */}
      <Modal
        open={pop?.kind === "locked"}
        onClose={() => setPop(null)}
        mascot="dissapointed.png"
        title="Finish the earlier levels first"
        description={`Complete the tasks in ${currentLevel?.title} before checking off tasks here. You can still read everything in this level.`}
      >
        <Button variant="outline" className="border" onClick={() => setPop(null)}>Got it</Button>
        <Button
          onClick={() => {
            setPop(null);
            navigate(`/dashboard/${sprintId}/${currentLevel?.id}`);
          }}
        >
          Go to {currentLevel?.title}
        </Button>
      </Modal>

      <Modal
        open={pop?.kind === "task"}
        onClose={() => setPop(null)}
        mascot="Motivated.png"
        title="Nice work!"
        description="Task completed. Keep the momentum going."
      />

      <Modal
        open={pop?.kind === "level"}
        onClose={() => setPop(null)}
        mascot="Celebration.png"
        title="Level complete!"
        description={`${level.title} is complete. Your progress is saved.`}
      >
        <Button
          onClick={async () => {
            setPop(null);
            await completionSaveRef.current;
            await refreshPreps();
            navigate("/dashboard");
          }}
        >
          Okay
        </Button>
      </Modal>
    </div>
  );
}