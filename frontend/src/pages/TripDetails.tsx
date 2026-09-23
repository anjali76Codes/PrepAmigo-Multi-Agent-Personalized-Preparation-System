import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { mockTripData } from '../data/mockData';
import { TripOverview } from '../components/trips/TripOverview';
import { ItineraryTimeline } from '../components/trips/ItineraryTimeline';
import { DependencyGraph } from '../components/trips/DependencyGraph';
import { AffectedItems } from '../components/trips/AffectedItems';
import { ActivityTimeline } from '../components/trips/ActivityTimeline';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';

export function TripDetails() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  // In a real app we'd fetch by tripId. For now, use mockTripData directly.
  const data = mockTripData;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: shouldReduceMotion ? 0 : 0.15 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full h-full p-6 md:p-10 relative">
      <div className="max-w-6xl mx-auto w-full space-y-12">
        
        {/* Header Navigation */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/app/trips')}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-surface border border-border hover:bg-elevated text-secondary-text hover:text-primary-text transition-colors"
          >
            <Icon name="arrow-back-outline" className="text-xl" />
          </button>
          <span className="text-secondary-text font-medium text-lg">Back to Trips</span>
        </motion.div>

        {/* Trip Overview */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <TripOverview data={data} />
        </motion.div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-8"
        >
          
          {/* Main Content: Itinerary */}
          <div className="lg:col-span-2 space-y-12">
            <motion.section variants={itemVariants}>
              <div className="flex justify-between items-end mb-8">
                <h2 className="text-2xl font-bold tracking-tight">Itinerary</h2>
                <Button variant="secondary" className="rounded-full">
                  <Icon name="download-outline" className="mr-2" />
                  Export
                </Button>
              </div>
              <ItineraryTimeline itinerary={data.itinerary} />
            </motion.section>
          </div>

          {/* Sidebar Content: Coordination & Status */}
          <div className="space-y-12">
            
            {/* Ask kaju CTA */}
            <motion.div variants={itemVariants} className="p-6 rounded-3xl bg-surface border border-border text-center space-y-4 shadow-lg">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow-primary">
                <Icon name="sparkles" className="text-2xl text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Need to make a change?</h3>
                <p className="text-sm text-secondary-text">Tell kaju what changed, and we'll figure out what happens next.</p>
              </div>
              <Button 
                className="w-full rounded-full" 
                onClick={() => navigate('/app/chat')}
              >
                Ask kaju about this trip
              </Button>
            </motion.div>

            {/* Affected Items */}
            {data.affectedItems && data.affectedItems.length > 0 && (
              <motion.section variants={itemVariants}>
                <AffectedItems items={data.affectedItems} />
              </motion.section>
            )}

            {/* Dependency Timeline */}
            <motion.section variants={itemVariants}>
              <DependencyGraph nodes={data.nodes} />
            </motion.section>

            {/* Activity History */}
            <motion.section variants={itemVariants} className="bg-surface p-6 rounded-3xl border border-border">
              <ActivityTimeline history={data.activityHistory} />
            </motion.section>

          </div>
        </motion.div>
      </div>
    </div>
  );
}
