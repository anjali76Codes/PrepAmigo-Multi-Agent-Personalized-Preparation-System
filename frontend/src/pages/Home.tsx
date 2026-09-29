import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Reveal, RevealStagger, RevealStaggerItem } from '../components/ui/Reveal';
import { Mascot } from '../components/ui/Mascot';
import { PageBackground } from '../components/ui/PageBackground';
import { AGENTS } from '../data/mockData';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ChatInput } from '../components/chat/ChatInput';

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
    <div className="min-h-screen bg-bg relative overflow-hidden text-carbon-700">
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
      <section className="py-20 px-6 bg-surface-muted/50 border-y border-border relative z-10">
        <Reveal className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-carbon-900">The Interview Prep Trap</h2>
          <RevealStagger className="grid md:grid-cols-3 gap-8 items-start">
            {[
              { icon: 'search', title: 'Fragmented Research', desc: 'Scouring Reddit, Blind, and Glassdoor for days just to find what a company actually asks.', translate: 'md:translate-y-0' },
              { icon: 'help-circle', title: 'Unclear Priorities', desc: 'Not knowing if you should study System Design, LeetCode Hard, or behavioral questions today.', translate: 'md:translate-y-8' },
              { icon: 'time', title: 'Limited Time', desc: 'Wasting precious hours planning when you only have 3 weeks until the onsite.', translate: 'md:translate-y-16' }
            ].map((p, i) => (
              <RevealStaggerItem key={i} className={`${p.translate} transition-transform`}>
                <Card variant="outlined" className="p-8 text-center hover:-translate-y-2 transition-transform h-full">
                  <div className="w-16 h-16 bg-navy-100 text-navy-900 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Icon name={p.icon} className="text-3xl" />
                  </div>
                  <h3 className="font-bold text-xl mb-3 text-carbon-900">{p.title}</h3>
                  <p className="text-carbon-500">{p.desc}</p>
                </Card>
              </RevealStaggerItem>
            ))}
          </RevealStagger>
        </Reveal>
      </section>

      {/* 3. How it works */}
      <section className="py-20 px-6 max-w-6xl mx-auto relative z-10">
        <Reveal>
          <h2 className="text-3xl font-bold text-center mb-16 text-carbon-900">How PrepAmigo Works</h2>
          <RevealStagger className="flex flex-col md:flex-row gap-8 text-center items-center justify-between relative">
            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-border -translate-y-1/2 -z-10" />
            {[
              { step: '1', title: 'Input', desc: 'Tell us your target role and upload your resume.', variant: 'forest' },
              { step: '2', title: 'Analyze', desc: 'Our agents find company expectations and your skill gaps.', variant: 'sunny' },
              { step: '3', title: 'Plan', desc: 'We generate a day-by-day study roadmap.', variant: 'coral' },
              { step: '4', title: 'Adapt', desc: 'The plan shifts based on your quiz scores and missed days.', variant: 'sky' }
            ].map((s, i) => (
              <RevealStaggerItem key={i} className="w-full md:w-64">
                <Card variant={s.variant as any} className="p-6 relative group hover:-translate-y-1 transition-transform">
                  <div className="w-10 h-10 bg-carbon-900 text-white rounded-full flex items-center justify-center font-bold text-lg absolute -top-5 left-1/2 -translate-x-1/2 shadow-card">
                    {s.step}
                  </div>
                  <h3 className="font-bold text-lg mt-4 mb-2">{s.title}</h3>
                  <p className="text-sm opacity-80">{s.desc}</p>
                </Card>
              </RevealStaggerItem>
            ))}
          </RevealStagger>
        </Reveal>
      </section>

      {/* 4. Agent grid */}
      <section className="py-20 px-6 bg-surface border-y border-border relative z-10">
        <Reveal className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16 text-carbon-900">The Intelligence Engine</h2>
          <RevealStagger className="grid md:grid-cols-3 gap-4 items-start pb-12">
            {AGENTS.map((a, i) => {
              const tints = ['forest', 'sunny', 'coral', 'sky', 'navy', 'default'];
              const tint = tints[i % tints.length] as any;
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
      </section>

      {/* 5. What the Planner builds */}
      <section className="py-20 px-6 max-w-6xl mx-auto relative z-10">
        <Reveal>
          <h2 className="text-3xl font-bold text-center mb-16 text-carbon-900">What You Get</h2>
          <RevealStagger className="grid md:grid-cols-2 gap-8">
            <RevealStaggerItem>
              <Card variant="navy" className="p-6 flex flex-col h-full hover:-translate-y-1 transition-transform">
                <h3 className="font-bold text-xl mb-2">Roadmap</h3>
                <p className="opacity-80 mb-6 text-sm">Day-by-day task lists tailored to your timeframe.</p>
                <div className="mt-auto bg-white/60 p-4 rounded-card">
                  <div className="h-12 bg-white/50 rounded-control flex items-center px-4">
                    <div className="w-4 h-4 rounded-full border-2 border-navy-900 mr-3" />
                    <div className="h-2 w-32 bg-navy-900/40 rounded-full" />
                  </div>
                </div>
              </Card>
            </RevealStaggerItem>

            <RevealStaggerItem>
              <Card variant="coral" className="p-6 flex flex-col h-full hover:-translate-y-1 transition-transform">
                <h3 className="font-bold text-xl mb-2">Calendar</h3>
                <p className="opacity-80 mb-6 text-sm">A global view of deadlines and missed tasks.</p>
                <div className="mt-auto bg-white/60 p-4 rounded-card">
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 14 }).map((_, i) => (
                      <div key={i} className={`h-6 rounded ${i === 5 ? 'bg-amber-600/20 border border-amber-600' : 'bg-white'}`} />
                    ))}
                  </div>
                </div>
              </Card>
            </RevealStaggerItem>

            <RevealStaggerItem>
              <Card variant="sunny" className="p-6 flex flex-col h-full hover:-translate-y-1 transition-transform">
                <h3 className="font-bold text-xl mb-2">Resource Pack</h3>
                <p className="opacity-80 mb-6 text-sm">Curated links grouped by start, deep dive, and practice.</p>
                <div className="mt-auto bg-white/60 p-4 rounded-card">
                  <div className="space-y-2">
                    <div className="h-8 bg-white rounded flex items-center px-3">
                      <Icon name="link" className="mr-2 text-sm opacity-50" />
                      <div className="h-1.5 w-24 bg-black/10 rounded-full" />
                    </div>
                  </div>
                </div>
              </Card>
            </RevealStaggerItem>

            <RevealStaggerItem>
              <Card variant="sky" className="p-6 flex flex-col h-full hover:-translate-y-1 transition-transform">
                <h3 className="font-bold text-xl mb-2">Assessments</h3>
                <p className="opacity-80 mb-6 text-sm">Quizzes, coding tasks, and flashcard decks.</p>
                <div className="mt-auto bg-white/60 p-4 rounded-card">
                  <div className="h-16 bg-white rounded-card flex items-center justify-center p-2">
                    <div className="font-bold">Q: What is a Bloom Filter?</div>
                  </div>
                </div>
              </Card>
            </RevealStaggerItem>

            <RevealStaggerItem className="md:col-span-2">
              <Card variant="forest" className="p-6 flex flex-col h-full hover:-translate-y-1 transition-transform">
                <h3 className="font-bold text-xl mb-2">Progress Dashboard</h3>
                <p className="opacity-80 mb-6 text-sm">Track your level, streaks, and XP as you complete real work.</p>
                <div className="mt-auto bg-white/60 p-4 rounded-card">
                  <div className="h-4 bg-white rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-forest-700 w-2/3" />
                  </div>
                </div>
              </Card>
            </RevealStaggerItem>
          </RevealStagger>
        </Reveal>
      </section>

      {/* 6. Worked Example */}
      <section className="py-20 px-6 bg-surface border-y border-border relative z-10 overflow-hidden">
        <Reveal className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8 text-carbon-900">From Prompt to Plan</h2>
          <Card variant="default" className="p-8">
            <Card variant="navy" className="p-4 mb-8 font-medium">
              "I have 45 days. Target: SDE at Company X. Strong in React/Node. Weak in DSA and System Design."
            </Card>

            <RevealStagger className="space-y-4 border-l-2 border-border ml-4 pl-6 relative">
              {[
                { title: 'Company Expects', content: 'Distributed systems, Leetcode Medium/Hard' },
                { title: 'Candidate Knows', content: 'Frontend architectures, basic APIs' },
                { title: 'Gaps that matter', content: 'Scalability patterns, Graph algorithms' },
                { title: 'What to learn', content: 'System Design basics, Load Balancing, BFS/DFS' },
                { title: 'Time Allocation', content: '70% DSA & Systems, 30% React/Node revision' }
              ].map((step, i) => (
                <RevealStaggerItem key={i} className="relative">
                  <div className="absolute w-3 h-3 bg-carbon-900 rounded-full -left-[31px] top-1.5 ring-4 ring-surface" />
                  <h4 className="font-bold text-carbon-900">{step.title}</h4>
                  <p className="text-sm text-carbon-500">{step.content}</p>
                </RevealStaggerItem>
              ))}
            </RevealStagger>
          </Card>
        </Reveal>
      </section>

      {/* 7. Gamification */}
      <section className="py-20 px-6 max-w-6xl mx-auto text-center relative z-10">
        <Reveal>
          <h2 className="text-3xl font-bold mb-6 text-carbon-900">Real Work = Real Progress</h2>
          <p className="text-carbon-500 max-w-2xl mx-auto mb-12">
            Earn XP, maintain your streak, and unlock titles by completing tasks and passing assessments. Progress here means you're actually getting better, not just spending time in the app.
          </p>
          <RevealStagger className="flex justify-center gap-8 flex-wrap">
            {['5 Day Streak!', '+250 XP', 'Level Up: Architect', 'Badge: DSA Master'].map((badge, i) => (
              <RevealStaggerItem key={i}>
                <div className="px-6 py-3 bg-surface border border-border rounded-full font-bold text-carbon-900 shadow-card flex items-center gap-2">
                  <Icon name="star" className="text-sunny-500" /> {badge}
                </div>
              </RevealStaggerItem>
            ))}
          </RevealStagger>
        </Reveal>
      </section>

      {/* 8. USP / CTA */}
      <section className="py-24 px-6 bg-carbon-900 text-white text-center relative z-10">
        <Reveal className="max-w-3xl mx-auto space-y-8">
          <h2 className="text-4xl font-bold">Tell PrepAmigo where you want to go.</h2>
          <p className="text-2xl text-white/80">It figures out what you need to learn next.</p>
          <div className="pt-8">
            <Link to="/signup">
              <Button variant="primary" size="lg" className="bg-white text-carbon-900 hover:bg-white/90 shadow-pop">
                Create your account
              </Button>
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
