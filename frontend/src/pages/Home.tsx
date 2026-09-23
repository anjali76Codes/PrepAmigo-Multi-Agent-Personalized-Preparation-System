import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion, type Variants } from 'framer-motion';

import { ChatInput } from '../components/chat/ChatInput';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { ShaderBackground } from '../components/ui/ShaderBackground';
import { HalftoneBackground } from '../components/ui/HalftoneBackground';

const AGENTS = [
  {
    icon: 'airplane',
    name: 'Flight Booking',
    description: 'Flights, availability, cancellations and rescheduling',
  },
  {
    icon: 'bed',
    name: 'Accommodation',
    description: 'Hotels, stays, bookings and modifications',
  },
  {
    icon: 'train',
    name: 'Transportation',
    description: 'Airport transfers and local transit',
  },
  {
    icon: 'restaurant',
    name: 'Dining & Reservations',
    description: 'Restaurants, activities and reservations',
  },
  {
    icon: 'umbrella',
    name: 'Logistics & Weather',
    description: 'Delays, weather, closures and disruptions',
  },
  {
    icon: 'wallet',
    name: 'Budget & Expense',
    description: 'Trip spending and cost impact',
  },
];

const DEPENDENCY_NODES = [
  {
    icon: 'airplane',
    title: 'Flight',
    time: '14:00',
    state: 'changed',
  },
  {
    icon: 'bus',
    title: 'Airport Transfer',
    time: '16:30',
    state: 'affected',
  },
  {
    icon: 'bed',
    title: 'Hotel Check-in',
    time: '17:15',
    state: 'affected',
  },
  {
    icon: 'restaurant',
    title: 'Dinner',
    time: '19:00',
    state: 'review',
  },
  {
    icon: 'restaurant',
    title: 'Activity',
    time: 'Tomorrow',
    state: 'protected',
  },
] as const;

const EXAMPLES = [
  'My flight got cancelled. Get me to Rome tonight and keep tomorrow intact.',
  'The weather changed. Rework today without breaking my dinner reservation.',
  'Move my hotel booking because my arrival is now six hours later.',
  'My plans changed. Find alternatives that stay within my remaining budget.',
];

export function Home() {
  const [inputValue, setInputValue] = useState('');
  const [activeExample, setActiveExample] = useState<string | null>(null);

  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (inputValue.trim()) {
      navigate('/app/chat');
    }
  };

  const handleStart = () => {
    navigate('/app/chat');
  };

  const useExample = (example: string) => {
    setInputValue(example);
    setActiveExample(example);

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const itemVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 30,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  const groupVariants: Variants = {
    hidden: {
      opacity: 0,
    },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.08,
      },
    },
  };

  return (
    <div className="flex flex-col w-full bg-background overflow-hidden">
      <section className="relative w-full pt-4 md:pt-6 px-4 md:px-6 z-10">
        <div className="relative min-h-[80vh] md:min-h-[85vh] rounded-[2rem] border border-white/10 border-b-0 rounded-b-none overflow-hidden flex flex-col items-center justify-center text-center px-6">
          <ShaderBackground
            className="absolute inset-0 w-full h-full z-0"
          />
          <div className="absolute bottom-[-10%] left-[-10%] right-[-10%] h-[20%] bg-background blur-[80px] z-0" />
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background via-background/60 to-transparent z-0" />

          <motion.div
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="relative z-10 max-w-4xl mx-auto mb-10"
          >

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[0.95] mb-7">
              Tell kaju what changed.
              <br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                We handle the rest.
              </span>
            </h1>

            <p className="text-lg sm:text-md text-secondary-text max-w-2xl mx-auto leading-relaxed">
              TravelAmigo coordinates your entire journey when real-world
              changes throw your plans off track.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.9 }}
            className="relative z-20 w-full max-w-2xl"
          >
            <ChatInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleChatSubmit}
            />

            <div className="flex flex-wrap items-center justify-center gap-3 mt-5 text-sm text-secondary-text">
              <span>Try:</span>
              <button
                type="button"
                onClick={() => useExample('kaju, my flight got cancelled. Get me to Rome tonight.')}
                className="px-3 py-1.5 rounded-full border border-white/10 bg-surface/60 hover:bg-surface-elevated transition-colors"
              >
                Cancelled flight
              </button>
              <button
                type="button"
                onClick={() => useExample('kaju, the weather changed. Rework today without breaking my plans.')}
                className="px-3 py-1.5 rounded-full border border-white/10 bg-surface/60 hover:bg-surface-elevated transition-colors"
              >
                Weather disruption
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.8 }}
            className="relative z-10 flex flex-wrap items-center justify-center gap-2 mt-4"
          >
            {['One conversation', 'Multiple agents', 'Shared trip context', 'Real-time coordination'].map((tag) => (
              <span key={tag} className="px-3 py-1.5 rounded-full text-xs sm:text-sm text-secondary-text bg-background/50 border border-white/10 backdrop-blur-sm">
                {tag}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-28 px-6 bg-gradient-to-b from-background to-surface/30">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div variants={itemVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }}>
              <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
                One conversation.
                <br />
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">An entire agent network.</span>
              </h2>
              <p className="mt-7 text-lg text-secondary-text leading-relaxed max-w-xl">
                At the centre of TravelAmigo is kaju, a single conversational interface. You tell kaju what you want or what has changed. Behind the scenes, specialized agents coordinate the planning, search, evaluation and execution.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} transition={{ delay: 0.15 }} className="relative">
              <div className="absolute inset-0 bg-primary/10 blur-[100px] rounded-full" />
              <Card className="relative p-7 md:p-9 rounded-[2rem] bg-surface-elevated/80 backdrop-blur-xl border-white/10">
                <div className="flex items-center gap-4 pb-7 border-b border-white/10">
                  <Avatar fallback="kaju" size="lg" />
                  <div>
                    <div className="font-semibold text-lg">kaju</div>
                    <div className="text-sm text-secondary-text">TravelAmigo coordinator</div>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-xs text-secondary-text">Active</span>
                  </div>
                </div>

                <div className="py-7">
                  <div className="rounded-2xl bg-background/70 border border-white/10 p-5">
                    <p className="text-sm text-secondary-text mb-2">You</p>
                    <p className="leading-relaxed">
                      "My flight got cancelled. Get me to Rome tonight, keep it within my budget, and make sure tomorrow's plans still work."
                    </p>
                  </div>
                  <div className="flex justify-center py-5">
                    <div className="w-px h-8 bg-gradient-to-b from-primary/60 to-transparent" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {AGENTS.map((agent) => (
                      <div key={agent.name} className="flex items-center gap-2.5 p-3 rounded-xl bg-background/50 border border-white/5">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon name={agent.icon} className="text-[14px] text-primary" />
                        </div>
                        <span className="text-xs truncate">{agent.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-primary/10 bg-primary/5 p-4">
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    Coordinating trip changes...
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="relative h-[50vh] min-h-[250px] max-w-6xl w-[100%] rounded-2xl overflow-hidden mx-auto">
        <HalftoneBackground className="absolute inset-0 w-full h-full z-0 opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-b from-surface/30 via-transparent to-background z-10 pointer-events-none" />
      </section>

      <section className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div variants={itemVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }}>
              <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
                Your trip is a network,
                <br />
                <span className="text-secondary-text">not a checklist.</span>
              </h2>
              <p className="mt-7 text-lg text-secondary-text leading-relaxed max-w-xl">
                TravelAmigo represents your journey as interconnected activities and dependencies. When one element changes, the system traces what could be affected instead of treating the change in isolation.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} transition={{ delay: 0.15 }} className="relative">
              <div className="absolute inset-0 bg-primary/10 blur-[100px] rounded-full" />
              <Card className="relative p-6 md:p-8 rounded-[2rem] bg-surface-elevated/80 backdrop-blur-xl border-white/10">
                <div className="flex items-center justify-between mb-7">
                  <div>
                    <p className="text-sm text-secondary-text">Trip dependency map</p>
                    <p className="font-semibold mt-1">Rome · Today</p>
                  </div>
                  <div className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                    <span className="text-xs text-primary">Recalculating</span>
                  </div>
                </div>

                <div className="relative">
                  {DEPENDENCY_NODES.map((node, index) => (
                    <div key={node.title} className="relative flex items-center gap-4">
                      {index !== DEPENDENCY_NODES.length - 1 && (
                        <div className="absolute left-[19px] top-12 h-12 w-px bg-gradient-to-b from-primary/40 to-white/5" />
                      )}
                      <div className={`relative z-10 w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${node.state === 'changed' ? 'bg-primary/15 border-primary/30' : node.state === 'protected' ? 'bg-green-500/10 border-green-500/20' : 'bg-background/70 border-white/10'}`}>
                        <Icon name={node.icon} className={`text-[17px] ${node.state === 'changed' ? 'text-primary' : node.state === 'protected' ? 'text-green-400' : 'text-secondary-text'}`} />
                      </div>
                      <div className="flex-1 flex items-center justify-between py-4 border-b border-white/5 last:border-0">
                        <div>
                          <p className="font-medium text-sm">{node.title}</p>
                          <p className="text-xs text-secondary-text mt-1">{node.time}</p>
                        </div>
                        <span className={`text-xs ${node.state === 'changed' ? 'text-primary' : node.state === 'protected' ? 'text-green-400' : 'text-secondary-text'}`}>
                          {node.state === 'changed' ? 'Changed' : node.state === 'affected' ? 'Affected' : node.state === 'review' ? 'Reviewing' : 'Protected'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-28 px-6 bg-gradient-to-b from-background to-surface/30">
        <div className="max-w-6xl mx-auto">
          <motion.div variants={itemVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }}>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight">
              Travel problems,
              <br />
              <span className="text-secondary-text">in your own words.</span>
            </h2>
          </motion.div>

          <motion.div variants={groupVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} className="grid md:grid-cols-2 gap-4 mt-14">
            {EXAMPLES.map((example) => (
              <motion.button
                key={example}
                variants={itemVariants}
                type="button"
                onClick={() => useExample(example)}
                className={`group relative text-left p-6 rounded-3xl border transition-all duration-300 overflow-hidden ${activeExample === example
                  ? 'border-primary shadow-[0_0_0_1px_rgba(47,163,107,1)] bg-primary/10'
                  : 'border-white/10 bg-[var(--color-soft-green)]/5 hover:border-primary/80 hover:shadow-[0_0_0_1px_rgba(47,163,107,0.8)] hover:bg-surface-elevated'
                  }`}
              >
                <div
                  className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px)', backgroundSize: '14px 14px' }}
                />
                <div className="relative z-10 flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary">→</span>
                  </div>
                  <div>
                    <p className="leading-relaxed group-hover:text-white transition-colors">“{example}”</p>
                    <p className="text-xs font-bold mt-4 group-hover:scale-1.5 transition-colors">Ask kaju →</p>
                  </div>
                </div>
              </motion.button>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="relative py-32 md:py-44 px-6 overflow-hidden">
        <ShaderBackground className="absolute inset-0 opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background pointer-events-none" />

        <motion.div variants={itemVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
            Tell kaju what changed.
            <br />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">See what happens next.</span>
          </h2>
          <p className="mt-7 text-lg md:text-xl text-secondary-text max-w-xl mx-auto">
            TravelAmigo turns unexpected changes into coordinated next steps.
          </p>
          <div className="mt-10 flex justify-center">
            <Button onClick={handleStart} className="px-7 py-3.5 text-base">
              Start with kaju <span className="ml-2">→</span>
            </Button>
          </div>
        </motion.div>
      </section>
    </div>
  );
}