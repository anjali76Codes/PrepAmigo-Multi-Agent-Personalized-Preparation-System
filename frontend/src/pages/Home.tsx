import { useNavigate } from "react-router-dom";
import { RevealStagger, RevealStaggerItem } from "../components/ui/Reveal";
import { PageBackground } from "../components/ui/PageBackground";

import { motion, useScroll, useTransform } from "framer-motion";
import { ChatInput } from "../components/chat/ChatInput";
import { ScrollSteps } from "../components/home/ScrollSteps";
import { WhatYouGet } from "../components/home/WhatYouGet";
import { InterviewTrap } from "../components/home/InterviewTrap";
import { PromptToPlan } from "../components/home/PromptToPlan";
import { Gamification } from "../components/home/Gamification";
import { BottomCTA } from "../components/home/BottomCTA";
import { useAuth } from "../hooks/useAuth";
import { featureFlags } from "../config/featureFlags";
import { Mascot } from "../components/ui/Mascot";

export function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { scrollY } = useScroll();
  const scale = useTransform(scrollY, [0, 500], [1, 0.9]);
  const filter = useTransform(scrollY, [0, 500], ["blur(0px)", "blur(8px)"]);

  const handleChatSubmit = (message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;

    // Persist pending query for chat auto-firing
    sessionStorage.setItem("prepamigo_pending_query", trimmed);

    // If auth is enabled and the user is logged out, route through login
    if (featureFlags.enableAuth && !user) {
      navigate("/login", {
        state: { initialQuery: trimmed, from: "/dashboard/chat" },
      });
      return;
    }

    // Otherwise navigate directly to chat with the initial query
    navigate("/dashboard/chat", { state: { initialQuery: trimmed } });
  };

  return (
    <div className="min-h-screen bg-bg relative overflow-x-clip text-carbon-700">
      <PageBackground />

      {/* 1. Hero */}
      <motion.section
        style={{ scale, filter }}
        className="relative pt-24 pb-12 px-4 md:px-6 mx-2 md:mx-4 md:rounded-b-[2.5rem] min-h-[98vh] flex flex-col items-center justify-center bg-carbon-900 text-white text-center z-10 shadow-2xl"
      >
        <RevealStagger className="max-w-3xl mx-auto w-full flex flex-col items-center justify-center space-y-5 my-auto">
          <RevealStaggerItem>
            <p className="text-sm sm:text-base md:text-lg text-carbon-300 max-w-xl mx-auto leading-relaxed">
              PrepAmigo builds your preparation roadmap in seconds.
            </p>
          </RevealStaggerItem>

          <RevealStaggerItem className="w-full max-w-2xl mx-auto pt-2">
            <ChatInput
              onSend={handleChatSubmit}
              placeholder="What role, company, or topic are you prepping for?..."
              className="text-left"
            />
          </RevealStaggerItem>


          <Mascot variant="hi.png" className="absolute left-10 bottom-0 mx-auto" style={{ height: "500px", width: "auto" }} />
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
      <div id="features" className="scroll-mt-10">
        <WhatYouGet />
      </div>

      {/* 6. Worked Example */}
      <div id="agents" className="scroll-mt-10">
        <PromptToPlan />
      </div>

      {/* 7. Gamification */}
      <Gamification />

      <BottomCTA />
    </div>
  );
}
