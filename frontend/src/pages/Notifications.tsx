import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { mockNotifications } from '../data/mockData';
import { Icon } from '../components/ui/Icon';
import { Card } from '../components/ui/Card';
import { cn } from '../lib/utils';

export function Notifications() {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: shouldReduceMotion ? 0 : 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: shouldReduceMotion ? 0 : -20 },
    show: { opacity: 1, x: 0, transition: { duration: 0.4 } }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full h-full p-6 md:p-10 relative">
      <div className="max-w-3xl mx-auto w-full space-y-10">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Notifications</h1>
          <p className="text-secondary-text text-lg">
            Updates and alerts from kaju and your travel agents.
          </p>
        </motion.div>

        {mockNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-surface-elevated/30 border border-border rounded-3xl backdrop-blur-sm">
            <Icon name="notifications-off-outline" className="text-4xl text-secondary-text mb-4" />
            <h3 className="text-2xl font-bold mb-2">You're all caught up!</h3>
            <p className="text-secondary-text">There are no new notifications.</p>
          </div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-4"
          >
            {mockNotifications.map((notif) => (
              <motion.div key={notif.id} variants={itemVariants}>
                <Card className={cn(
                  "p-5 rounded-3xl flex items-start gap-5 border transition-colors hover:bg-elevated/60 cursor-pointer relative overflow-hidden",
                  notif.read ? "bg-surface/50 border-border" : "bg-elevated/80 border-accent/30 shadow-[0_4px_20px_rgba(16,185,129,0.05)]",
                  notif.type === 'error' && !notif.read && "border-error/30 shadow-[0_4px_20px_rgba(239,68,68,0.05)]",
                  notif.type === 'warning' && !notif.read && "border-warning/30 shadow-[0_4px_20px_rgba(245,158,11,0.05)]"
                )}>
                  {!notif.read && (
                    <div className="absolute top-1/2 -translate-y-1/2 left-0 w-1 h-12 bg-accent rounded-r-full" />
                  )}
                  
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border mt-0.5",
                    notif.type === 'error' ? "bg-error/10 text-error border-error/20" :
                    notif.type === 'warning' ? "bg-warning/10 text-warning border-warning/20" :
                    notif.type === 'success' ? "bg-accent/10 text-accent border-accent/20" :
                    "bg-surface-elevated text-secondary-text border-border"
                  )}>
                    <Icon name={notif.icon} className="text-2xl" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className={cn(
                        "text-base font-bold",
                        !notif.read ? "text-primary-text" : "text-secondary-text"
                      )}>
                        {notif.title}
                      </h3>
                      <span className="text-xs font-medium text-muted-text whitespace-nowrap ml-4">
                        {notif.time}
                      </span>
                    </div>
                    <p className="text-sm text-secondary-text">{notif.description}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
