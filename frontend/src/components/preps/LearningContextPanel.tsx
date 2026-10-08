import { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import type { LearningContext } from '../../data/mockData';
import { motion } from 'framer-motion';
import { Badge } from '../ui/Badge';

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
    <Card variant="default" className="p-6">
      <h3 className="text-lg font-semibold mb-6 text-carbon-900">Live Learning Context</h3>

      <div className="space-y-6">
        <motion.div
          animate={{ backgroundColor: highlight && (highlightField === 'role' || highlightField === 'all') ? 'var(--color-soft-rose)' : 'transparent' }}
          className="rounded-control p-2 -mx-2 transition-colors relative"
        >
          <div className="text-xs font-semibold text-carbon-500 uppercase tracking-wider mb-2 flex justify-between items-center">
            Target Role
            {highlight && (highlightField === 'role' || highlightField === 'all') && highlightSource && (
              <Badge variant="navy" className="text-[10px] normal-case py-0.5">Updated by {highlightSource}</Badge>
            )}
          </div>
          <div className="text-carbon-900">{context.targetRole}</div>
        </motion.div>

        <motion.div
          animate={{ backgroundColor: highlight && (highlightField === 'summary' || highlightField === 'all') ? 'var(--color-soft-rose)' : 'transparent' }}
          className="rounded-control p-2 -mx-2 transition-colors relative"
        >
          <div className="text-xs font-semibold text-carbon-500 uppercase tracking-wider mb-2 flex justify-between items-center">
            Resume Summary
            {highlight && (highlightField === 'summary' || highlightField === 'all') && highlightSource && (
              <Badge variant="navy" className="text-[10px] normal-case py-0.5">Updated by {highlightSource}</Badge>
            )}
          </div>
          <div className="text-sm text-carbon-900 leading-relaxed">{context.resumeSummary}</div>
        </motion.div>

        <motion.div
          animate={{ backgroundColor: highlight && (highlightField === 'gaps' || highlightField === 'all') ? 'var(--color-soft-rose)' : 'transparent' }}
          className="rounded-control p-2 -mx-2 transition-colors relative"
        >
          <div className="text-xs font-semibold text-carbon-500 uppercase tracking-wider mb-2 flex justify-between items-center">
            Top Weakness
            {highlight && (highlightField === 'gaps' || highlightField === 'all') && highlightSource && (
              <Badge variant="navy" className="text-[10px] normal-case py-0.5">Updated by {highlightSource}</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {context.knowledgeGaps.map(gap => (
              <Badge key={gap.id} variant="default" className="bg-beige-100 text-beige-600 border-beige-600/20">
                {gap.skill}
              </Badge>
            ))}
          </div>
        </motion.div>
      </div>
    </Card>
  );
}
