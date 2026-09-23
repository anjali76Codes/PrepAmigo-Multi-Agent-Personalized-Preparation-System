import React from 'react';
import { Icon } from '../ui/Icon';
import { cn } from '../../lib/utils';

export function ItineraryTimeline({ itinerary }: { itinerary: any[] }) {
  return (
    <div className="space-y-10">
      {itinerary.map((dayPlan, i) => (
        <div key={i} className="flex flex-col">
          <h3 className="text-lg font-bold text-primary-text mb-6 pb-2 border-b border-border">
            {dayPlan.day}
          </h3>
          <div className="space-y-6">
            {dayPlan.items.map((item: any, idx: number) => (
              <div key={item.id} className="flex gap-4 group">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border shrink-0 transition-colors",
                    item.status === 'cancelled' ? "bg-error/10 border-error/20 text-error" :
                    item.status === 'impacted' ? "bg-warning/10 border-warning/20 text-warning" :
                    "bg-surface border-border text-secondary-text group-hover:border-accent/40 group-hover:text-primary-text"
                  )}>
                    <Icon name={item.icon} className="text-lg" />
                  </div>
                  {idx < dayPlan.items.length - 1 && (
                    <div className={cn(
                      "w-px h-full mt-2 min-h-[1.5rem]",
                      item.status === 'cancelled' || item.status === 'impacted' ? "bg-warning/30" : "bg-border"
                    )} />
                  )}
                </div>
                
                <div className="pt-1.5 pb-2 flex-1">
                  <div className="flex justify-between items-start">
                    <span className={cn(
                      "font-medium",
                      item.status === 'cancelled' ? "text-error line-through opacity-70" :
                      item.status === 'impacted' ? "text-warning" : "text-primary-text"
                    )}>
                      {item.title}
                    </span>
                    <span className="text-sm font-medium text-secondary-text">{item.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
