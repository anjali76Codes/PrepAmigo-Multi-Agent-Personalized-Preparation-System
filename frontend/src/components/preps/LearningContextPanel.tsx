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
    <Card className="p-6 bg-[var(--color-surface)] border-[var(--color-border)]">
      <h3 className="text-lg font-semibold mb-6 text-[var(--color-forest-700)]-text">Live Learning Context</h3>
      
      <div className="space-y-6">
        <motion.div 
          animate={{ backgroundColor: highlight && (highlightField === 'role' || highlightField === 'all') ? 'rgba(47, 163, 107, 0.2)' : 'transparent' }}
          className="rounded-[var(--radius-control)] p-2 -mx-2 transition-colors relative"
        >
          <div className="text-xs font-semibold text-[var(--color-navy-500)] uppercase tracking-wider mb-2 flex justify-between items-center">
            Target Role
            {highlight && (highlightField === 'role' || highlightField === 'all') && highlightSource && (
              <span className="text-[10px] bg-[var(--color-navy-900)]/20 text-[var(--color-forest-700)] px-2 py-0.5 rounded-full normal-case">Updated by {highlightSource}</span>
            )}
          </div>
          <div className="text-[var(--color-forest-700)]-text">{context.targetRole}</div>
        </motion.div>

        <motion.div 
          animate={{ backgroundColor: highlight && (highlightField === 'summary' || highlightField === 'all') ? 'rgba(47, 163, 107, 0.2)' : 'transparent' }}
          className="rounded-[var(--radius-control)] p-2 -mx-2 transition-colors relative"
        >
          <div className="text-xs font-semibold text-[var(--color-navy-500)] uppercase tracking-wider mb-2 flex justify-between items-center">
            Resume Summary
            {highlight && (highlightField === 'summary' || highlightField === 'all') && highlightSource && (
              <span className="text-[10px] bg-[var(--color-navy-900)]/20 text-[var(--color-forest-700)] px-2 py-0.5 rounded-full normal-case">Updated by {highlightSource}</span>
            )}
          </div>
          <div className="text-sm text-[var(--color-forest-700)]-text leading-relaxed">{context.resumeSummary}</div>
        </motion.div>

        <motion.div 
          animate={{ backgroundColor: highlight && (highlightField === 'gaps' || highlightField === 'all') ? 'rgba(47, 163, 107, 0.2)' : 'transparent' }}
          className="rounded-[var(--radius-control)] p-2 -mx-2 transition-colors relative"
        >
          <div className="text-xs font-semibold text-[var(--color-navy-500)] uppercase tracking-wider mb-2 flex justify-between items-center">
            Top Weakness
            {highlight && (highlightField === 'gaps' || highlightField === 'all') && highlightSource && (
              <span className="text-[10px] bg-[var(--color-navy-900)]/20 text-[var(--color-forest-700)] px-2 py-0.5 rounded-full normal-case">Updated by {highlightSource}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {context.knowledgeGaps.map(gap => (
              <span key={gap.id} className="px-2 py-1 bg-[var(--color-amber-600)]/10 text-[var(--color-amber-600)] text-xs rounded-[var(--radius-control)] border border-warning/20">
                {gap.skill}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </Card>
  );
}
