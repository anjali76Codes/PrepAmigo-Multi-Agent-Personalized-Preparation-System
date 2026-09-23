import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { TripCard } from '../components/trips/TripCard';
import { mockTrips } from '../data/mockData';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';

export function Trips() {
  const shouldReduceMotion = useReducedMotion();
  const activeTrips = mockTrips.filter(t => t.status === 'Needs Attention' || t.status === 'Active');
  const upcomingTrips = mockTrips.filter(t => t.status === 'Upcoming');
  const pastTrips = mockTrips.filter(t => t.status === 'Completed');

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
      <div className="max-w-6xl mx-auto w-full space-y-12">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <motion.div initial="hidden" animate="show" variants={itemVariants}>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Your Trips</h1>
            <p className="text-secondary-text text-lg">
              Manage your upcoming adventures and past journeys.
            </p>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
            <Button className="rounded-full shrink-0 shadow-glow-accent">
              <Icon name="add-outline" className="mr-2" />
              New Trip
            </Button>
          </motion.div>
        </div>

        {mockTrips.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 text-center bg-surface-elevated/30 border border-border rounded-3xl backdrop-blur-sm">
            <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center border border-border mb-6">
              <Icon name="airplane-outline" className="text-4xl text-secondary-text" />
            </div>
            <h3 className="text-2xl font-bold mb-2">No trips yet</h3>
            <p className="text-secondary-text max-w-sm mb-8">
              You haven't planned any trips with TravelAmigo yet. Let's start your first journey.
            </p>
            <Button className="rounded-full px-8">Plan a Trip</Button>
          </motion.div>
        ) : (
          <div className="space-y-16">
            
            {/* Active / Needs Attention */}
            {activeTrips.length > 0 && (
              <motion.section variants={containerVariants} initial="hidden" animate="show">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
                  Active & Disrupted
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeTrips.map(trip => (
                    <motion.div key={trip.id} variants={itemVariants}>
                      <TripCard {...trip} />
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Upcoming */}
            {upcomingTrips.length > 0 && (
              <motion.section variants={containerVariants} initial="hidden" animate="show">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Icon name="calendar-outline" className="text-accent" />
                  Upcoming
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {upcomingTrips.map(trip => (
                    <motion.div key={trip.id} variants={itemVariants}>
                      <TripCard {...trip} />
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Past */}
            {pastTrips.length > 0 && (
              <motion.section variants={containerVariants} initial="hidden" animate="show" className="opacity-80 hover:opacity-100 transition-opacity">
                <h2 className="text-xl font-bold mb-6 text-secondary-text flex items-center gap-2">
                  <Icon name="time-outline" />
                  Past Trips
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pastTrips.map(trip => (
                    <motion.div key={trip.id} variants={itemVariants}>
                      <TripCard {...trip} />
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
