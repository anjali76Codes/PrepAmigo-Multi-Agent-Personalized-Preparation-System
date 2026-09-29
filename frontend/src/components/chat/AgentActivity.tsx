import { motion } from 'framer-motion';
import { Icon } from '../ui/Icon';
import type { AgentName } from '../../data/mockData';

interface AgentActivityProps {
  activeAgent: AgentName | null;
  statusText: string;
}

export function AgentActivity({ activeAgent, statusText }: AgentActivityProps) {
  
  const allAgents: AgentName[] = [
    'Company Research',
    'Job Intelligence',
    'Interview Intelligence',
    'Skill Gap',
    'Research',
    'Assessment',
    'Planner',
    'Progress'
  ];

  return (
    <div className="bg-surface border-b border-border p-4 overflow-hidden shrink-0">
      <div className="flex items-center gap-3 mb-4 overflow-x-auto hide-scrollbar pb-2">
        {allAgents.map((agent, i) => {
          const isActive = activeAgent === agent;
          const isDone = activeAgent ? allAgents.indexOf(agent) < allAgents.indexOf(activeAgent) : false;
          
          return (
            <div key={agent} className="flex items-center gap-2 shrink-0">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                isActive ? 'bg-primary/10 border-primary/20 text-primary' : 
                isDone ? 'bg-accent/10 border-accent/20 text-accent' : 
                'bg-background border-border text-secondary-text'
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
      
      <div className="flex items-center gap-2 text-sm text-secondary-text bg-background p-3 rounded-lg border border-border">
        <Icon name="information-circle-outline" className="text-primary" />
        <span className="font-medium text-primary-text">{activeAgent || 'Idle'}:</span> {statusText || 'Waiting for input...'}
      </div>
    </div>
  );
}
