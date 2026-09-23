import React from 'react';
import { cn } from '../../lib/utils';
import { Icon } from '../ui/Icon';

interface Node {
  id: string;
  type: string;
  title: string;
  time: string;
  status: string; // 'safe', 'cancelled', 'impacted'
}

export function DependencyGraph({ nodes }: { nodes: Node[] }) {
  return (
    <div className="flex flex-col gap-4 max-w-sm mt-4 p-4 bg-surface rounded-2xl border border-border">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-secondary-text mb-2">Trip Dependencies</h4>
      <div className="flex flex-col relative ml-3">
        {nodes.map((node, i) => (
          <div key={node.id} className="relative flex items-start gap-4 pb-6 last:pb-0">
            {/* Connecting Line */}
            {i < nodes.length - 1 && (
              <div className={cn(
                "absolute left-[11px] top-6 w-0.5 h-[calc(100%-8px)]",
                node.status === 'cancelled' || node.status === 'impacted' 
                  ? "bg-warning/50 animate-pulse" 
                  : "bg-border"
              )} />
            )}
            
            {/* Node Icon */}
            <div className={cn(
              "relative z-10 flex shrink-0 items-center justify-center w-6 h-6 rounded-full border bg-surface",
              node.status === 'cancelled' ? "border-error text-error bg-error/10" :
              node.status === 'impacted' ? "border-warning text-warning bg-warning/10" :
              "border-border text-secondary-text"
            )}>
              {node.status === 'cancelled' ? <Icon name="close" className="text-xs" /> :
               node.status === 'impacted' ? <Icon name="alert" className="text-xs" /> :
               <div className="w-1.5 h-1.5 rounded-full bg-secondary-text" />
              }
            </div>

            {/* Node Content */}
            <div className="flex-1 -mt-1.5">
              <div className={cn(
                "text-sm font-medium",
                node.status === 'cancelled' ? "text-error line-through opacity-70" :
                node.status === 'impacted' ? "text-warning" : "text-primary-text"
              )}>
                {node.title}
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-muted-text">{node.type}</span>
                <span className="text-xs text-secondary-text">{node.time}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
