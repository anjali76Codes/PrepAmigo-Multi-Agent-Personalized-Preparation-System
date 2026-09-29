import { useState } from 'react';
import type { CalendarEntry } from '../../data/mockData';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { MissedTaskBanner } from './MissedTaskBanner';
import { RescheduleDialog } from './RescheduleDialog';
import { Button } from '../ui/Button';

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

  return (
    <div className="space-y-6 max-w-4xl">
      {missedTasks.length > 0 && (
        <MissedTaskBanner count={missedTasks.length} />
      )}
      
      <Card className="p-6 bg-surface border-border">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-primary-text flex items-center gap-2">
            <Icon name="calendar-outline" className="text-primary" />
            Schedule
          </h3>
          <div className="flex bg-background border border-border rounded-lg overflow-hidden">
            <button 
              className={`px-4 py-1.5 text-sm ${view === 'day' ? 'bg-primary/10 text-primary font-medium' : 'text-secondary-text'}`}
              onClick={() => setView('day')}
            >Day</button>
            <button 
              className={`px-4 py-1.5 text-sm ${view === 'week' ? 'bg-primary/10 text-primary font-medium' : 'text-secondary-text'}`}
              onClick={() => setView('week')}
            >Week</button>
          </div>
        </div>

        <div className="space-y-4">
          {entries.map(entry => (
            <div key={entry.id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-background">
              <div className="shrink-0 w-12 text-center text-secondary-text">
                <div className="text-xs uppercase">{new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                <div className="font-bold text-primary-text">{new Date(entry.date).getDate()}</div>
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h4 className="font-medium text-primary-text">{entry.title}</h4>
                  <span className={`text-xs px-2 py-1 rounded-md border ${
                    entry.type === 'due' ? 'bg-primary/10 text-primary border-primary/20' :
                    entry.type === 'missed' ? 'bg-warning/10 text-warning border-warning/20' :
                    entry.type === 'rescheduled' ? 'bg-accent/10 text-accent border-accent/20' :
                    'bg-border/50 text-secondary-text border-border'
                  }`}>
                    {entry.type}
                  </span>
                </div>
                {entry.reason && <p className="text-xs text-secondary-text mt-1">Reason: {entry.reason}</p>}
                {entry.originalDate && <p className="text-xs text-secondary-text">Originally: {new Date(entry.originalDate).toLocaleDateString()}</p>}
              </div>
              {entry.type === 'missed' && (
                <Button variant="secondary" size="sm" onClick={() => setSelectedTaskToReschedule(entry.id)}>
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
