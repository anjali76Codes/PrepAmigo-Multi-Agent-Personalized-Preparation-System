import { motion } from 'framer-motion';
import { Icon } from '../ui/Icon';
import { Badge } from '../ui/Badge';
import { AGENTS } from '../../data/mockData';
import type { AgentName } from '../../data/mockData';

interface AgentActivityProps {
  activeAgent: AgentName | null;
  statusText: string;
}

export function AgentActivity({ activeAgent, statusText }: AgentActivityProps) {
  
  const allAgents: AgentName[] = AGENTS.map(a => a.name);

  return (
    <div className="bg-surface border-b border-border p-4 overflow-hidden shrink-0">
      <div className="flex items-center gap-3 mb-4 overflow-x-auto hide-scrollbar pb-2">
        {allAgents.map((agent, i) => {
          const isActive = activeAgent === agent;
          const isDone = activeAgent ? allAgents.indexOf(agent) < allAgents.indexOf(activeAgent) : false;
          
          return (
            <div key={agent} className="flex items-center gap-2 shrink-0">
              <Badge 
                variant={isActive ? 'navy' : isDone ? 'forest' : 'default'}
                className="gap-1.5 px-3 py-1.5 transition-colors"
              >
                {isActive && (
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-3 h-3 border-2 border-current border-t-transparent rounded-full"
                  />
                )}
                {isDone && <Icon name="checkmark-outline" />}
                {agent}
              </Badge>
              {i < allAgents.length - 1 && (
                <div className="w-4 h-px bg-border" />
              )}
            </div>
          );
        })}
      </div>
      
      <div className="flex items-center gap-2 text-sm text-carbon-500 bg-bg p-3 rounded-control border border-border">
        <Icon name="information-circle-outline" className="text-forest-700" />
        <span className="font-medium text-carbon-900">{activeAgent || 'Idle'}:</span> {statusText || 'Waiting for input...'}
      </div>
    </div>
  );
}
