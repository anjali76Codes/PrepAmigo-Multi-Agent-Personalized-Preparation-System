import React from 'react';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { cn } from '../../lib/utils';

export function TripOverview({ data }: { data: any }) {
  const isActive = data.status === 'Needs Attention' || data.status === 'Active';

  return (
    <Card className={cn(
      "p-6 rounded-3xl border bg-elevated/40 backdrop-blur-sm",
      isActive ? "border-warning/30" : "border-border"
    )}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-primary-text mb-2">{data.destination}</h2>
          <div className="flex flex-wrap items-center gap-4 text-sm text-secondary-text">
            <span className="flex items-center gap-1.5"><Icon name="calendar-outline" /> {data.dates}</span>
            <span className="flex items-center gap-1.5"><Icon name="people-outline" /> {data.travelers} Travelers</span>
          </div>
        </div>
        <div className={cn(
          "px-4 py-1.5 rounded-full text-sm font-semibold uppercase tracking-wider flex items-center gap-2",
          isActive ? "bg-warning/10 text-warning border border-warning/20" : "bg-surface text-secondary-text border border-border"
        )}>
          {isActive && <Icon name="alert-circle-outline" className="text-lg" />}
          {data.status}
        </div>
      </div>

      <div className="pt-6 border-t border-border">
        <div className="flex justify-between items-end mb-2">
          <span className="text-sm text-muted-text uppercase tracking-wider font-medium">Trip Budget</span>
          <span className="text-sm font-semibold text-primary-text">
            {data.budget.currency}{data.budget.spent.toLocaleString()} / {data.budget.currency}{data.budget.total.toLocaleString()}
          </span>
        </div>
        <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
          <div 
            className="h-full bg-accent" 
            style={{ width: `${(data.budget.spent / data.budget.total) * 100}%` }}
          />
        </div>
      </div>
    </Card>
  );
}
