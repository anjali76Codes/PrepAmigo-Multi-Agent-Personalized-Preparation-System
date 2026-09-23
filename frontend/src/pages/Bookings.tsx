import React from 'react';
import { motion } from 'framer-motion';
import { mockBookings } from '../data/mockData';
import { Icon } from '../components/ui/Icon';
import { Card } from '../components/ui/Card';
import { cn } from '../lib/utils';
import { useReducedMotion } from 'framer-motion';

export function Bookings() {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: shouldReduceMotion ? 0 : 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full h-full p-6 md:p-10 relative">
      <div className="max-w-4xl mx-auto w-full space-y-10">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Bookings</h1>
          <p className="text-secondary-text text-lg">
            A quick overview of your confirmed and pending reservations.
          </p>
        </div>

        {mockBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-surface-elevated/30 border border-border rounded-3xl backdrop-blur-sm">
            <Icon name="ticket-outline" className="text-4xl text-secondary-text mb-4" />
            <h3 className="text-2xl font-bold mb-2">No bookings</h3>
            <p className="text-secondary-text">You have no active bookings right now.</p>
          </div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-4"
          >
            {mockBookings.map((booking) => (
              <motion.div key={booking.id} variants={itemVariants}>
                <Card className={cn(
                  "p-5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 border bg-elevated/40 backdrop-blur-sm transition-colors hover:bg-elevated/60",
                  booking.status === 'Cancelled' ? "border-error/30" :
                  booking.status === 'Pending update' ? "border-warning/30" : "border-border hover:border-accent/30"
                )}>
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border",
                      booking.status === 'Cancelled' ? "bg-error/10 text-error border-error/20" :
                      booking.status === 'Pending update' ? "bg-warning/10 text-warning border-warning/20" :
                      "bg-surface text-secondary-text border-border"
                    )}>
                      <Icon name={booking.icon} className="text-2xl" />
                    </div>
                    <div>
                      <h3 className={cn(
                        "text-lg font-bold mb-1",
                        booking.status === 'Cancelled' ? "text-error line-through opacity-80" : "text-primary-text"
                      )}>
                        {booking.name}
                      </h3>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm text-secondary-text">
                        <span className="flex items-center gap-1.5"><Icon name="calendar-outline" /> {booking.date}</span>
                        <span className="hidden sm:inline">•</span>
                        <span className="flex items-center gap-1.5"><Icon name="location-outline" /> {booking.location}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between md:flex-col md:items-end gap-3 md:gap-2 ml-16 md:ml-0">
                    <span className={cn(
                      "text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full border",
                      booking.status === 'Cancelled' ? "bg-error/10 text-error border-error/20" :
                      booking.status === 'Pending update' ? "bg-warning/10 text-warning border-warning/20" :
                      "bg-surface text-secondary-text border-border"
                    )}>
                      {booking.status}
                    </span>
                    <button className="text-sm font-medium text-accent hover:text-accent/80 transition-colors">
                      View details
                    </button>
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
