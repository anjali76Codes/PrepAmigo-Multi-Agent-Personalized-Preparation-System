import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/utils';
import { DayTaskCard, type ResourceItem } from '../ui/DayTaskCard';
import type { ISprintDay } from '../../mocks/interviewPlan.mock';

export interface KanbanColumn {
  key: string;
  label: string;
  dot: string;
  tasks: ISprintDay[];
}

interface KanbanBoardProps {
  columns: KanbanColumn[];
  buildResources: (task: ISprintDay) => ResourceItem[];
  onToggleComplete: (id: string) => void;
  /** Only a drag into/out of the "done" column does anything; other moves are schedule-derived and fixed. */
  onDropTask: (taskId: string, fromColumn: string, toColumn: string) => void;
}

const dragTitle = (task: ISprintDay) =>
  task.day_number === 999 ? task.topic_title : `Day ${task.day_number}: ${task.topic_title}`;

export function KanbanBoard({ columns, buildResources, onToggleComplete, onDropTask }: KanbanBoardProps) {
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
      {columns.map((col) => (
        <div
          key={col.key}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverKey(col.key);
          }}
          onDragLeave={() => setDragOverKey((k) => (k === col.key ? null : k))}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverKey(null);
            const raw = e.dataTransfer.getData('application/json');
            if (!raw) return;
            try {
              const { taskId, fromColumn } = JSON.parse(raw) as { taskId: string; fromColumn: string };
              if (taskId && fromColumn) onDropTask(taskId, fromColumn, col.key);
            } catch {
              /* ignore malformed drag payloads */
            }
          }}
          className={cn(
            'shrink-0 w-70 sm:w-75 snap-start rounded-2xl border bg-surface/60 p-3 flex flex-col gap-2 transition-colors',
            dragOverKey === col.key ? 'border-chrome bg-lavender-50' : 'border-border'
          )}
        >
          <div className="flex items-center gap-2 px-1 pb-1">
            <span className={cn('w-2.5 h-2.5 rounded-full', col.dot)} />
            <h3 className="text-sm font-bold text-carbon-900">{col.label}</h3>
            <span className="text-xs font-bold text-carbon-500 ml-auto">{col.tasks.length}</span>
          </div>

          <div className="flex flex-col gap-2 min-h-15">
            <AnimatePresence mode="popLayout" initial={false}>
              {col.tasks.map((task) => (
                <motion.div
                  key={task._id}
                  layout="position"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: draggingId === task._id ? 0.4 : 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <div
                    draggable
                    onDragStart={(e: React.DragEvent) => {
                      setDraggingId(task._id);
                      e.dataTransfer.setData('application/json', JSON.stringify({ taskId: task._id, fromColumn: col.key }));
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    className="cursor-grab"
                  >
                    <DayTaskCard
                      variant="compact"
                      title={dragTitle(task)}
                      completed={task.status === 'completed'}
                      resources={buildResources(task)}
                      onToggleComplete={() => onToggleComplete(task._id)}
                    />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {col.tasks.length === 0 && (
              <div className="flex-1 rounded-xl border-2 border-dashed border-border/70 py-6 text-center text-xs font-semibold text-carbon-500">
                Nothing here
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
