import React from 'react';
import { Icon } from '../ui/Icon';

export interface TripContextData {
  id: string;
  destination: string;
  dates: string;
  travelers: number;
  budget: {
    total: number;
    spent: number;
    currency: string;
  };
}

export function TripContextPanel({ data }: { data: TripContextData }) {
  return (
    <div className="flex flex-col h-full bg-surface-elevated/30 border-l border-border backdrop-blur-sm p-6 w-full lg:w-80 shrink-0">
      <div className="flex items-center gap-2 text-accent mb-6">
        <Icon name="compass-outline" className="text-xl" />
        <h3 className="font-semibold tracking-wide uppercase text-sm">Trip Context</h3>
      </div>

      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-primary-text">{data.destination}</h2>
          <div className="flex items-center gap-2 text-secondary-text text-sm">
            <Icon name="calendar-outline" />
            <span>{data.dates}</span>
          </div>
          <div className="flex items-center gap-2 text-secondary-text text-sm">
            <Icon name="people-outline" />
            <span>{data.travelers} Travelers</span>
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <div className="flex justify-between items-end mb-2">
            <span className="text-sm font-medium text-secondary-text">Budget</span>
            <span className="text-sm font-semibold text-primary-text">
              {data.budget.spent} / {data.budget.total} {data.budget.currency}
            </span>
          </div>
          <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
            <div 
              className="h-full bg-accent" 
              style={{ width: `${(data.budget.spent / data.budget.total) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
