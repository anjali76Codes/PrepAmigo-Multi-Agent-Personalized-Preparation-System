import React from 'react';
import { motion } from 'framer-motion';
import { mockBudget } from '../data/mockData';
import { Icon } from '../components/ui/Icon';
import { Card } from '../components/ui/Card';
import { useReducedMotion } from 'framer-motion';

export function Budget() {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: shouldReduceMotion ? 0 : 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: shouldReduceMotion ? 1 : 0.95 },
    show: { opacity: 1, scale: 1, transition: { duration: 0.4 } }
  };

  const remaining = mockBudget.total - mockBudget.spent;
  const progressPercent = (mockBudget.spent / mockBudget.total) * 100;

  return (
    <div className="flex-1 overflow-y-auto w-full h-full p-6 md:p-10 relative">
      <div className="max-w-4xl mx-auto w-full space-y-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Budget</h1>
            <p className="text-secondary-text text-lg flex items-center gap-2">
              <Icon name="compass-outline" /> {mockBudget.tripName}
            </p>
          </div>
        </div>

        {/* Top Level Summary */}
        <motion.div 
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="p-8 rounded-[2rem] border-border bg-elevated/40 backdrop-blur-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              <div className="flex flex-col">
                <span className="text-sm text-secondary-text uppercase tracking-wider mb-2">Total Budget</span>
                <span className="text-3xl font-bold text-primary-text">{mockBudget.currency}{mockBudget.total.toLocaleString()}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-secondary-text uppercase tracking-wider mb-2">Spent</span>
                <span className="text-3xl font-bold text-primary-text">{mockBudget.currency}{mockBudget.spent.toLocaleString()}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-secondary-text uppercase tracking-wider mb-2">Remaining</span>
                <span className="text-3xl font-bold text-accent">{mockBudget.currency}{remaining.toLocaleString()}</span>
              </div>
            </div>
            
            <div className="w-full h-3 bg-surface rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-accent" 
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
              />
            </div>
          </Card>
        </motion.div>

        {/* Category Breakdown */}
        <div>
          <h2 className="text-xl font-bold mb-6">Spending Breakdown</h2>
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {mockBudget.categories.map((cat, i) => (
              <motion.div key={cat.name} variants={itemVariants}>
                <Card className="p-5 rounded-3xl border border-border bg-surface/50 backdrop-blur-sm flex items-center gap-4 hover:border-accent/30 transition-colors">
                  <div className="w-12 h-12 rounded-2xl bg-surface border border-border flex items-center justify-center shrink-0">
                    <Icon name={cat.icon} className="text-xl text-secondary-text" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-primary-text">{cat.name}</span>
                      <span className="text-sm font-semibold">{mockBudget.currency}{cat.spent.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-secondary-text/50" 
                        initial={{ width: 0 }}
                        animate={{ width: `${(cat.spent / cat.allocated) * 100}%` }}
                        transition={{ duration: 1, delay: 0.5 + (i * 0.1), ease: "easeOut" }}
                      />
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>

      </div>
    </div>
  );
}
