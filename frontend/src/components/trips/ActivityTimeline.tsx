import React from 'react';
import { Icon } from '../ui/Icon';

export function ActivityTimeline({ history }: { history: any[] }) {
  if (!history || history.length === 0) return null;

  return (
    <div className="flex flex-col">
      <h3 className="text-sm font-bold uppercase tracking-wider text-secondary-text mb-4">Trip Activity</h3>
      <div className="relative pl-4 border-l border-border/50 space-y-6">
        {history.map((event, idx) => (
          <div key={event.id} className="relative flex items-start gap-4">
            {/* Timeline Dot */}
            <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-accent border-[3px] border-surface" />
            
            <div className="flex-1 -mt-1">
              <p className="text-sm text-primary-text">{event.description}</p>
              <span className="text-xs text-muted-text mt-0.5 block">{event.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
