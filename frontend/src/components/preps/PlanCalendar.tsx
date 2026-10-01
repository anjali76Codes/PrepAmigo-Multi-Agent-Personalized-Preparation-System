import { useState } from 'react';
import type { CalendarEntry } from '../../data/mockData';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { MissedTaskBanner } from './MissedTaskBanner';
import { RescheduleDialog } from './RescheduleDialog';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface PlanCalendarProps {
  entries: CalendarEntry[];
}

export function PlanCalendar({ entries: initialEntries }: PlanCalendarProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [view, setView] = useState<'day' | 'week'>('week');
  const [selectedTaskToReschedule, setSelectedTaskToReschedule] = useState<string | null>(null);

  const missedTasks = entries.filter(e => e.type === 'missed');

  const handleReschedule = (taskId: string, newDate: string) => {
    setEntries(prev => prev.map(e => {
      if (e.id === taskId) {
        return { ...e, type: 'rescheduled', date: newDate, reason: 'Rescheduled by user' };
      }
      return e;
    }));
    setSelectedTaskToReschedule(null);
  };

  const getBadgeVariant = (type: string) => {
    switch(type) {
      case 'due': return 'navy';
      case 'missed': return 'warning';
      case 'rescheduled': return 'forest';
      default: return 'default';
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {missedTasks.length > 0 && (
        <MissedTaskBanner count={missedTasks.length} />
      )}
      
      <Card variant="default" className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-carbon-900 flex items-center gap-2">
            <Icon name="calendar-outline" className="text-navy-700" />
            Schedule
          </h3>
          <div className="flex bg-bg border border-border rounded-control overflow-hidden">
            <button 
              className={`px-4 py-1.5 text-sm ${view === 'day' ? 'bg-navy-100 text-navy-700 font-medium' : 'text-carbon-500'}`}
              onClick={() => setView('day')}
            >Day</button>
            <button 
              className={`px-4 py-1.5 text-sm ${view === 'week' ? 'bg-navy-100 text-navy-700 font-medium' : 'text-carbon-500'}`}
              onClick={() => setView('week')}
            >Week</button>
          </div>
        </div>

        <div className="space-y-4">
          {entries.map(entry => (
            <div key={entry.id} className="flex items-center gap-4 p-4 rounded-card border border-border bg-bg">
              <div className="shrink-0 w-12 text-center text-carbon-500">
                <div className="text-xs uppercase">{new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                <div className="font-bold text-carbon-900">{new Date(entry.date).getDate()}</div>
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h4 className="font-medium text-carbon-900">{entry.title}</h4>
                  <Badge variant={getBadgeVariant(entry.type) as any}>{entry.type}</Badge>
                </div>
                {entry.reason && <p className="text-xs text-carbon-500 mt-1">Reason: {entry.reason}</p>}
                {entry.originalDate && <p className="text-xs text-carbon-500">Originally: {new Date(entry.originalDate).toLocaleDateString()}</p>}
              </div>
              {entry.type === 'missed' && (
                <Button variant="outline" size="sm" onClick={() => setSelectedTaskToReschedule(entry.id)}>
                  Reschedule
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {selectedTaskToReschedule && (
        <RescheduleDialog 
          taskId={selectedTaskToReschedule}
          onClose={() => setSelectedTaskToReschedule(null)}
          onConfirm={(newDate) => handleReschedule(selectedTaskToReschedule, newDate)}
        />
      )}
    </div>
  );
}
