import type { RoadmapDay } from '../../data/mockData';
import { Icon } from '../ui/Icon';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { cn } from '../../lib/utils';

interface RoadmapDayCardProps {
  day: RoadmapDay;
}

export function RoadmapDayCard({ day }: RoadmapDayCardProps) {
  const getStatusVariant = (status: string) => {
    switch(status) {
      case 'done': return 'forest';
      case 'today': return 'chrome';
      case 'missed': 
      case 'rescheduled': return 'warning';
      default: return 'default';
    }
  };

  const isToday = day.status === 'today';
  return (
    <Card variant={isToday ? "carbon" : "default"} className={cn("flex items-start gap-4 p-4 transition-colors group", !isToday && "hover:border-chrome-border/30")}>
      <div className={cn("flex flex-col items-center justify-center rounded-control w-12 h-12 shrink-0", isToday ? "bg-white/10 text-white" : "bg-lavender-100 text-carbon-900")}>
        <span className={cn("text-xs", isToday ? "text-white/70" : "text-carbon-500")}>Day</span>
        <span className="font-bold">{day.dayNumber}</span>
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <h4 className={cn("font-semibold transition-colors", isToday ? "text-white" : "text-carbon-900 group-hover:text-chrome")}>{day.topic}</h4>
          <Badge variant={getStatusVariant(day.status) as any}>{day.status}</Badge>
        </div>
        <p className={cn("text-sm mt-1", isToday ? "text-white/80" : "text-carbon-500")}>{day.objective}</p>
        
        <div className="flex flex-wrap gap-2 mt-3">
          <div className={cn("text-xs flex items-center gap-1 px-2 py-1 rounded border", isToday ? "text-white bg-white/10 border-white/20" : "text-carbon-500 bg-surface border-border")}>
            <Icon name="time-outline" /> {day.estimatedMinutes}m
          </div>
          {day.references.map((ref, idx) => (
            <div key={idx} className={cn("text-xs flex items-center gap-1 px-2 py-1 rounded border", isToday ? "text-white bg-white/10 border-white/20" : "text-chrome bg-lavender-100 border-chrome-border/10")}>
              <Icon name="link-outline" /> {ref}
            </div>
          ))}
        </div>

        {day.practiceTask && (
          <div className={cn("mt-3 text-xs px-3 py-2 rounded-control border flex items-center justify-between", isToday ? "bg-white/10 text-white border-white/20" : "bg-surface text-carbon-900 border-border")}>
            <div className="flex items-center gap-2">
              <Icon name="code-working-outline" className={cn(isToday ? "text-white" : "text-chrome")} />
              <span className="font-medium">Task:</span> {day.practiceTask.title}
            </div>
            <span className={cn("capitalize", isToday ? "text-white/70" : "text-carbon-500")}>{day.practiceTask.status}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
