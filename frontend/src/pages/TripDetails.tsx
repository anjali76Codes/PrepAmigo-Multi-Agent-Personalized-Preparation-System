import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

  // In a real app we'd fetch by tripId. For now, use mockTripData directly.
  const data = mockTripData;

  return (
    <div className="flex-1 overflow-y-auto w-full h-full p-6 md:p-10 relative">
      <div className="max-w-6xl mx-auto w-full space-y-12">
        
        {/* Header Navigation */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/app/trips')}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-surface border border-border hover:bg-elevated text-secondary-text hover:text-primary-text transition-colors"
          >
            <Icon name="arrow-back-outline" className="text-xl" />
          </button>
          <span className="text-secondary-text font-medium text-lg">Back to Trips</span>
        </div>

        {/* Trip Overview */}
        <TripOverview data={data} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-8">
          
          {/* Main Content: Itinerary */}
          <div className="lg:col-span-2 space-y-12">
            <section>
              <div className="flex justify-between items-end mb-8">
                <h2 className="text-2xl font-bold tracking-tight">Itinerary</h2>
                <Button variant="secondary" className="rounded-full">
                  <Icon name="download-outline" className="mr-2" />
                  Export
                </Button>
              </div>
              <ItineraryTimeline itinerary={data.itinerary} />
            </section>
          </div>

          {/* Sidebar Content: Coordination & Status */}
          <div className="space-y-12">
            
            {/* Ask kaju CTA */}
            <div className="p-6 rounded-3xl bg-surface border border-border text-center space-y-4 shadow-lg">
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
            </div>

            {/* Affected Items */}
            {data.affectedItems && data.affectedItems.length > 0 && (
              <section>
                <AffectedItems items={data.affectedItems} />
              </section>
            )}

            {/* Dependency Timeline */}
            <section>
              <DependencyGraph nodes={data.nodes} />
            </section>

            {/* Activity History */}
            <section className="bg-surface p-6 rounded-3xl border border-border">
              <ActivityTimeline history={data.activityHistory} />
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
