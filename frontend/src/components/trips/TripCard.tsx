import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

export interface TripCardProps {
  id: string;
  destination: string;
  dates: string;
  travelers: number;
  budget: {
    total: number;
    currency: string;
  };
  status: string;
  disruption?: string;
  icon?: string;
}

export function TripCard({
  id,
  destination,
  dates,
  travelers,
  budget,
  status,
  disruption,
  icon = 'compass-outline',
}: TripCardProps) {
  const navigate = useNavigate();

  const isActive = status === 'Needs Attention' || status === 'Active';
  const isCompleted = status === 'Completed';

  return (
    <Card 
      className={cn(
        "flex flex-col p-6 rounded-3xl border transition-all duration-300 hover:-translate-y-1 relative overflow-hidden group bg-elevated/40 backdrop-blur-sm",
        isActive ? "border-warning/30 hover:border-warning/60 shadow-[0_4px_30px_rgba(217,119,6,0.05)]" : "border-border hover:border-accent/40 hover:bg-elevated/60"
      )}
    >
      {/* Subtle glow behind card content if active */}
      {isActive && (
        <div className="absolute -inset-2 bg-gradient-to-br from-warning/5 to-transparent blur-xl pointer-events-none -z-10" />
      )}

      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border",
            isActive ? "bg-warning/10 text-warning border-warning/20" : 
            isCompleted ? "bg-surface text-secondary-text border-border" : 
            "bg-accent/10 text-accent border-accent/20"
          )}>
            <Icon name={icon} className="text-2xl" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-primary-text">{destination}</h3>
            <p className="text-sm text-secondary-text flex items-center gap-1.5 mt-0.5">
              <Icon name="calendar-outline" /> {dates}
            </p>
          </div>
        </div>
        
        {/* Status Text instead of a generic pill if possible, but user said "few or no badges unless they actually communicate useful status". Needs Attention is a useful status. */}
        {isActive && (
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-warning px-3 py-1 rounded-full bg-warning/10 border border-warning/20">
            <Icon name="alert-circle-outline" className="text-sm" />
            {status}
          </div>
        )}
        {!isActive && (
          <span className="text-xs font-medium uppercase tracking-widest text-secondary-text">
            {status}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="flex flex-col">
          <span className="text-xs text-muted-text uppercase tracking-wider mb-1">Travelers</span>
          <div className="flex items-center gap-2 text-primary-text font-medium">
            <Icon name="people-outline" className="text-secondary-text" />
            {travelers}
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted-text uppercase tracking-wider mb-1">Budget</span>
          <div className="flex items-center gap-2 text-primary-text font-medium">
            <Icon name="wallet-outline" className="text-secondary-text" />
            {budget.currency}{budget.total.toLocaleString()}
          </div>
        </div>
      </div>

      {disruption && (
        <div className="mb-6 p-3 rounded-2xl bg-warning/5 border border-warning/10 flex items-start gap-3">
          <Icon name="warning-outline" className="text-warning text-lg shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-warning">Disruption detected</p>
            <p className="text-xs text-secondary-text mt-0.5">{disruption}</p>
          </div>
        </div>
      )}

      <div className="mt-auto pt-4 border-t border-border flex justify-end">
        <Button 
          variant={isActive ? "primary" : "secondary"} 
          className={cn(
            "rounded-full px-6",
            isActive && "bg-warning text-white hover:bg-warning/90 shadow-[0_0_15px_rgba(217,119,6,0.3)]"
          )}
          onClick={() => navigate(`/app/trips/${id}`)}
        >
          View Trip
        </Button>
      </div>
    </Card>
  );
}
