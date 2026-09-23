import { motion, useReducedMotion } from 'framer-motion';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';

export function Home() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col w-full">
      {/* 1. Hero Section */}
      <section className="relative pt-24 pb-32 md:pt-36 md:pb-40 px-6 max-w-5xl mx-auto w-full flex flex-col items-center text-center">
        {/* Subtle glow behind hero text */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-full bg-primary/10 blur-[100px] rounded-[100%] pointer-events-none -z-10" />

        <motion.div 
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
        >
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
            Tell kaju what changed.<br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              We handle the rest.
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-secondary-text max-w-2xl mx-auto mb-12">
            Meet kaju, your AI travel assistant. When life happens, just say the word. 
            Behind the scenes, our specialized agents coordinate flights, hotels, and schedules so you don't have to.
          </p>
        </motion.div>

        {/* Conversational Input (Visual Only) */}
        <motion.div 
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 1 }}
          className="w-full max-w-3xl relative group"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-accent/30 rounded-full blur opacity-25 group-hover:opacity-75 transition duration-500"></div>
          <div className="relative flex items-center bg-surface-elevated border border-border/50 rounded-full p-2 pl-6 shadow-2xl transition-all focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary">
            <input 
              type="text" 
              placeholder="What changed with your trip?" 
              className="flex-1 bg-transparent border-none outline-none text-base sm:text-lg text-primary-text placeholder:text-muted-text py-3"
            />
            <button className="flex items-center justify-center h-12 w-12 sm:w-auto sm:px-6 shrink-0 rounded-full bg-primary text-white hover:bg-primary-hover shadow-glow-primary transition-all">
              <Icon name="arrow-up-outline" className="text-xl sm:hidden" />
              <span className="hidden sm:inline font-semibold">Tell kaju</span>
            </button>
          </div>
        </motion.div>
      </section>

      {/* 2. Example Conversation */}
      <section className="py-24 px-6 border-t border-white/5 relative bg-surface/30">
        <div className="max-w-4xl mx-auto flex flex-col gap-16 md:flex-row items-center">
          <div className="flex-1 space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Real-time change propagation.</h2>
            <p className="text-secondary-text text-lg leading-relaxed">
              When your flight gets cancelled, it's not just a flight problem. It's a hotel problem, a transfer problem, and a dinner reservation problem.
              <br /><br />
              kaju understands the impact across your entire itinerary and coordinates the solution instantly.
            </p>
          </div>
          
          <div className="flex-1 w-full max-w-md">
            <Card className="rounded-3xl p-6 bg-surface-elevated/80 backdrop-blur-md border-white/10 shadow-2xl space-y-6">
              {/* User Message */}
              <div className="flex gap-4 items-start">
                <Avatar fallback="ME" size="md" className="bg-white/10 text-white" />
                <div className="bg-surface rounded-2xl rounded-tl-sm p-4 text-sm text-primary-text border border-border/50">
                  kaju, my flight to Rome was cancelled. Get me there tonight and keep tomorrow's plans intact.
                </div>
              </div>
              
              {/* kaju Message */}
              <div className="flex gap-4 items-start flex-row-reverse">
                <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow-primary">
                  <Icon name="sparkles" className="text-white text-lg" />
                </div>
                <div className="bg-primary/10 border border-primary/20 rounded-2xl rounded-tr-sm p-4 text-sm text-primary-text space-y-3">
                  <p>I'm on it. Here is the updated plan:</p>
                  <ul className="space-y-2 opacity-80">
                    <li className="flex items-center gap-2"><Icon name="airplane" className="text-primary" /> Rebooked you on AF123 at 8:45 PM</li>
                    <li className="flex items-center gap-2"><Icon name="car" className="text-primary" /> Shifted airport transfer to 11:30 PM</li>
                    <li className="flex items-center gap-2"><Icon name="bed" className="text-primary" /> Notified hotel of late arrival</li>
                  </ul>
                  <Button variant="primary" className="w-full rounded-full mt-2" size="sm">Review & Approve</Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* 3 & 4. How it works & Multi-Agent Coordination */}
      <section id="agents" className="py-32 px-6 max-w-6xl mx-auto w-full text-center">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">An entire agency in your pocket.</h2>
        <p className="text-secondary-text text-lg max-w-2xl mx-auto mb-20">
          Behind kaju's simple chat interface is a swarm of specialized AI agents working together around your shared trip context.
        </p>

        <div className="relative">
          {/* Center node (kaju) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
            <div className="h-24 w-24 rounded-full bg-surface-elevated border-2 border-primary shadow-glow-primary flex flex-col items-center justify-center">
              <Icon name="sparkles" className="text-3xl text-primary mb-1" />
              <span className="text-xs font-bold tracking-widest text-primary">kaju</span>
            </div>
          </div>

          {/* Agents Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-16 relative z-10 max-w-4xl mx-auto">
            {[
              { icon: 'airplane', name: 'Flight Agent' },
              { icon: 'bed', name: 'Accommodation' },
              { icon: 'train', name: 'Logistics' },
              { icon: 'restaurant', name: 'Dining' },
              { icon: 'wallet', name: 'Budget' },
              { icon: 'umbrella', name: 'Weather' },
            ].map((agent, i) => (
              <div key={agent.name} className="flex flex-col items-center gap-4 bg-surface/50 rounded-3xl p-6 border border-border/50 backdrop-blur-sm transition-transform hover:-translate-y-1 hover:border-primary/50">
                <div className="h-14 w-14 rounded-full bg-surface-elevated border border-white/10 flex items-center justify-center text-secondary-text">
                  <Icon name={agent.icon} className="text-2xl" />
                </div>
                <span className="font-medium text-sm text-primary-text">{agent.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Trip Dependency Visualization */}
      <section id="features" className="py-24 px-6 border-t border-white/5 bg-surface/30 overflow-hidden">
        <div className="max-w-5xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Every detail connected.</h2>
          <p className="text-secondary-text text-lg max-w-2xl mx-auto">
            TravelAmigo maps your journey as a living graph. If one link breaks, we instantly recompute the rest.
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 max-w-5xl mx-auto">
          {[
            { icon: 'airplane', title: 'Flight', time: '14:00', state: 'delayed' },
            { icon: 'bus', title: 'Transfer', time: '16:30', state: 'updating' },
            { icon: 'bed', title: 'Check-in', time: '17:15', state: 'updating' },
            { icon: 'restaurant', title: 'Dinner', time: '19:00', state: 'safe' },
          ].map((node, i) => (
            <div key={node.title} className="flex items-center flex-col md:flex-row gap-4 md:gap-8 w-full md:w-auto">
              <div className={`flex flex-col items-center justify-center w-32 h-32 rounded-3xl border transition-all duration-500
                ${node.state === 'delayed' ? 'border-warning text-warning bg-warning/5 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 
                  node.state === 'updating' ? 'border-primary text-primary bg-primary/5 shadow-[0_0_20px_rgba(0,82,255,0.2)]' : 
                  'border-border text-secondary-text bg-surface-elevated'}
              `}>
                <Icon name={node.icon} className="text-3xl mb-2" />
                <span className="font-semibold text-sm">{node.title}</span>
                <span className="text-xs opacity-80 mt-1">{node.time}</span>
              </div>
              
              {i < 3 && (
                <div className="hidden md:flex flex-col items-center justify-center w-8">
                  <div className={`h-0.5 w-full ${node.state === 'delayed' || node.state === 'updating' ? 'bg-primary animate-pulse' : 'bg-border'}`} />
                  <Icon name="chevron-forward" className={`text-xl -mt-2.5 ${node.state === 'delayed' || node.state === 'updating' ? 'text-primary' : 'text-border'}`} />
                </div>
              )}
              {i < 3 && (
                <div className="flex md:hidden flex-row items-center justify-center h-8">
                  <div className={`w-0.5 h-full ${node.state === 'delayed' || node.state === 'updating' ? 'bg-primary animate-pulse' : 'bg-border'}`} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 6. Final CTA */}
      <section className="py-32 px-6 text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl aspect-square rounded-full bg-gradient-blob-1 pointer-events-none -z-10 blur-[100px] opacity-40" />
        
        <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-1000">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight">
            Your trip changes.<br/>
            Your plan doesn't have to fall apart.
          </h2>
          <div className="pt-8">
            <Button size="lg" className="rounded-full px-10 text-lg shadow-glow-primary">
              Plan with kaju
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
