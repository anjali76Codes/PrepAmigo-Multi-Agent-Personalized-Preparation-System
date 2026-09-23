import React from 'react';
import { cn } from '../../lib/utils';
import { Icon } from '../ui/Icon';

interface Agent {
  id: string;
  name: string;
  icon: string;
  status: string;
}

export function AgentActivity({ agents, title = "kaju is coordinating your trip" }: { agents: Agent[], title?: string }) {
  return (
    <div className="flex flex-col mb-4">
      <div className="flex items-center gap-2 mb-3 text-sm font-medium text-accent">
        <Icon name="sync-outline" className="animate-spin text-lg" />
        {title}
      </div>
      
      <div className="flex flex-col ml-2 pl-3 border-l-2 border-border/50 space-y-3 relative">
        {agents.map((agent) => (
          <div key={agent.id} className="flex items-center gap-3 text-sm">
            <div className="relative">
              {/* Connector dot */}
              <div className="absolute -left-[17px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-accent" />
              
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center border",
                agent.status === 'active' ? "bg-accent/10 border-accent/30 text-accent shadow-[0_0_10px_rgba(47,163,107,0.2)]" : "bg-surface border-border text-secondary-text"
              )}>
                <Icon name={agent.icon} />
              </div>
            </div>
            
            <span className={cn(
              agent.status === 'active' ? "text-primary-text font-medium" : "text-secondary-text"
            )}>
              {agent.name}
            </span>
            
            {agent.status === 'active' && (
              <span className="text-xs text-accent animate-pulse ml-1">updating...</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
