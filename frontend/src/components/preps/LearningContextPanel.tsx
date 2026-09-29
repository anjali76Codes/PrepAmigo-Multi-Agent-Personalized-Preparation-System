import { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import type { LearningContext } from '../../data/mockData';
import { motion } from 'framer-motion';

interface LearningContextPanelProps {
  context: LearningContext;
  highlightField?: 'role' | 'summary' | 'gaps' | 'all' | null;
  highlightSource?: string;
}

export function LearningContextPanel({ context, highlightField, highlightSource }: LearningContextPanelProps) {
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    if (highlightField) {
      setHighlight(true);
      const timer = setTimeout(() => setHighlight(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [context, highlightField]);

  return (
    <Card className="p-6 bg-surface border-border">
      <h3 className="text-lg font-semibold mb-6 text-primary-text">Live Learning Context</h3>
      
      <div className="space-y-6">
        <motion.div 
          animate={{ backgroundColor: highlight && (highlightField === 'role' || highlightField === 'all') ? 'rgba(47, 163, 107, 0.2)' : 'transparent' }}
          className="rounded-lg p-2 -mx-2 transition-colors relative"
        >
          <div className="text-xs font-semibold text-secondary-text uppercase tracking-wider mb-2 flex justify-between items-center">
            Target Role
            {highlight && (highlightField === 'role' || highlightField === 'all') && highlightSource && (
              <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full normal-case">Updated by {highlightSource}</span>
            )}
          </div>
          <div className="text-primary-text">{context.targetRole}</div>
        </motion.div>

        <motion.div 
          animate={{ backgroundColor: highlight && (highlightField === 'summary' || highlightField === 'all') ? 'rgba(47, 163, 107, 0.2)' : 'transparent' }}
          className="rounded-lg p-2 -mx-2 transition-colors relative"
        >
          <div className="text-xs font-semibold text-secondary-text uppercase tracking-wider mb-2 flex justify-between items-center">
            Resume Summary
            {highlight && (highlightField === 'summary' || highlightField === 'all') && highlightSource && (
              <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full normal-case">Updated by {highlightSource}</span>
            )}
          </div>
          <div className="text-sm text-primary-text leading-relaxed">{context.resumeSummary}</div>
        </motion.div>

        <motion.div 
          animate={{ backgroundColor: highlight && (highlightField === 'gaps' || highlightField === 'all') ? 'rgba(47, 163, 107, 0.2)' : 'transparent' }}
          className="rounded-lg p-2 -mx-2 transition-colors relative"
        >
          <div className="text-xs font-semibold text-secondary-text uppercase tracking-wider mb-2 flex justify-between items-center">
            Top Weakness
            {highlight && (highlightField === 'gaps' || highlightField === 'all') && highlightSource && (
              <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full normal-case">Updated by {highlightSource}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {context.knowledgeGaps.map(gap => (
              <span key={gap.id} className="px-2 py-1 bg-warning/10 text-warning text-xs rounded-md border border-warning/20">
                {gap.skill}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </Card>
  );
}
