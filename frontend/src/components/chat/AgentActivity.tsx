import { motion } from 'framer-motion';
import { Icon } from '../ui/Icon';
import { AGENTS } from '../../data/mockData';
import type { AgentName } from '../../data/mockData';

interface AgentActivityProps {
  activeAgent: AgentName | null;
  statusText: string;
}

export function AgentActivity({ activeAgent, statusText }: AgentActivityProps) {
  
  const allAgents: AgentName[] = AGENTS.map(a => a.name);

  return (
    <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] p-4 overflow-hidden shrink-0">
      <div className="flex items-center gap-3 mb-4 overflow-x-auto hide-scrollbar pb-2">
        {allAgents.map((agent, i) => {
          const isActive = activeAgent === agent;
          const isDone = activeAgent ? allAgents.indexOf(agent) < allAgents.indexOf(activeAgent) : false;
          
          return (
            <div key={agent} className="flex items-center gap-2 shrink-0">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                isActive ? 'bg-[var(--color-navy-900)]/10 border-primary/20 text-[var(--color-forest-700)]' : 
                isDone ? 'bg-[var(--color-forest-700)]/10 border-accent/20 text-[var(--color-forest-700)]' : 
                'bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-navy-500)]'
              }`}>
                {isActive && (
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-3 h-3 border-2 border-current border-t-transparent rounded-full"
                  />
                )}
                {isDone && <Icon name="checkmark-outline" />}
                {agent}
              </div>
              {i < allAgents.length - 1 && (
                <div className="w-4 h-px bg-border" />
              )}
            </div>
          );
        })}
      </div>
      
      <div className="flex items-center gap-2 text-sm text-[var(--color-navy-500)] bg-[var(--color-bg)] p-3 rounded-[var(--radius-control)] border border-[var(--color-border)]">
        <Icon name="information-circle-outline" className="text-[var(--color-forest-700)]" />
        <span className="font-medium text-[var(--color-forest-700)]-text">{activeAgent || 'Idle'}:</span> {statusText || 'Waiting for input...'}
      </div>
    </div>
  );
}
