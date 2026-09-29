import { useNavigate } from 'react-router-dom';
import { RevealStagger, RevealStaggerItem } from '../components/ui/Reveal';
import { Mascot } from '../components/ui/Mascot';
import { PageBackground } from '../components/ui/PageBackground';

import { motion, useScroll, useTransform } from 'framer-motion';
import { ChatInput } from '../components/chat/ChatInput';
import { ScrollSteps } from '../components/home/ScrollSteps';
import { WhatYouGet } from '../components/home/WhatYouGet';
import { InterviewTrap } from '../components/home/InterviewTrap';
import { PromptToPlan } from '../components/home/PromptToPlan';
import { Gamification } from '../components/home/Gamification';
import { BottomCTA } from '../components/home/BottomCTA';

export function Home() {
  const navigate = useNavigate();

  const { scrollY } = useScroll();
  const scale = useTransform(scrollY, [0, 500], [1, 0.9]);
  const filter = useTransform(scrollY, [0, 500], ["blur(0px)", "blur(8px)"]);

  const handleChatSubmit = (message: string) => {
    if (message.trim()) {
      navigate('/app/chat');
    }
  };

  return (
    <div className="min-h-screen bg-bg relative overflow-x-clip text-carbon-700">
      <PageBackground />

      {/* 1. Hero */}
      <motion.section
        style={{ scale, filter }}
        className="relative pt-32 pb-12 px-6 mx-4 rounded-b-[2.5rem] h-[98vh] bg-carbon-900 text-white text-center z-10 shadow-lg"
      >
        <RevealStagger className="max-w-4xl mx-auto space-y-8">
          <RevealStaggerItem>
            <Mascot size="xl" mood="cheer" className="mb-6 shadow-pop bg-forest-100 mx-auto" />
          </RevealStaggerItem>
          <RevealStaggerItem>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white">
              Ace your interview.<br /> Without the <span className="text-forest-400 italic">guesswork</span>.
            </h1>
          </RevealStaggerItem>
          <RevealStaggerItem>
            <p className="text-xl text-carbon-300 max-w-2xl mx-auto leading-relaxed">
              PrepAmigo creates your personalized, adaptive study plan in seconds.
            </p>
          </RevealStaggerItem>
          <RevealStaggerItem>
            <div className="max-w-xl mx-auto mt-8">
              <ChatInput
                onSend={handleChatSubmit}
                placeholder="E.g. I have a frontend interview at Google in 2 weeks..."
                className="text-left"
              />
            </div>
          </RevealStaggerItem>
        </RevealStagger>
      </motion.section>

      {/* 2. Problem */}
      <InterviewTrap />

      {/* 3. How it works */}
      <ScrollSteps />

      {/* 4. Agent grid */}
      {/* <section className="py-20 px-6 bg-surface border-y border-border relative z-10">
        <Reveal className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16 text-carbon-900">The Intelligence Engine</h2>
          <RevealStagger className="grid md:grid-cols-3 gap-4 items-start pb-12">
            {AGENTS.map((a, i) => {
              const tints = ['forest', 'sunny', 'coral', 'sky', 'navy', 'default'] as const;
              const tint = tints[i % tints.length];
              const yOffset = i % 2 === 0 ? 'md:translate-y-0' : 'md:translate-y-12';
              return (
                <RevealStaggerItem key={i} className={`${yOffset} h-full`}>
                  <Card variant={tint} className="p-5 hover:-translate-y-2 transition-all group h-full flex flex-col shadow-sm">
                    <h4 className="font-bold mb-1">{a.name}</h4>
                    <p className="text-xs opacity-70 mb-3">{a.role}</p>
                    <div className="text-xs p-2 bg-white/50 rounded font-medium mt-auto">"{a.out}"</div>
                  </Card>
                </RevealStaggerItem>
              );
            })}
          </RevealStagger>
        </Reveal>
      </section> */}

      {/* 5. What the Planner builds */}
      <WhatYouGet />

      {/* 6. Worked Example */}
      <PromptToPlan />

      {/* 7. Gamification */}
      <Gamification />

      <BottomCTA />
    </div>
  );
}
