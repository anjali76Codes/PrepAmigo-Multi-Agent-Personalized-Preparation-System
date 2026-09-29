import { PageBackground } from '../components/ui/PageBackground';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';
import { AGENTS } from '../data/mockData';

export function Home() {
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
    show: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] relative overflow-hidden text-[var(--color-forest-700)]-text">
      <PageBackground />
      
      {/* 1. Hero */}
      <section className="relative pt-32 pb-20 px-6 max-w-6xl mx-auto text-center z-10">
        <motion.div initial="hidden" animate="show" variants={containerVariants} className="max-w-4xl mx-auto space-y-8">
          <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-bold tracking-tight">
            Stop figuring out <span className="text-[var(--color-forest-700)] italic">what</span> to prepare. <br/> Just start preparing.
          </motion.h1>
          <motion.p variants={itemVariants} className="text-xl text-[var(--color-navy-500)] max-w-2xl mx-auto leading-relaxed">
            Candidates spend more time researching what to study than actually studying. PrepAmigo is a multi-agent AI system that builds and adapts your personalized interview roadmap.
          </motion.p>
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Link to="/signup" className="bg-[var(--color-navy-900)] text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-[var(--color-navy-900)]/90 transition-colors shadow-[var(--shadow-pop)] shadow-primary/20">
              Start Free Trial
            </Link>
            <Link to="/app/chat" className="bg-[var(--color-surface)] text-[var(--color-forest-700)]-text border border-[var(--color-border)] px-8 py-4 rounded-full font-bold text-lg hover:border-primary/30 hover:bg-[var(--color-bg)] transition-colors">
              Try the Chat Demo
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* 2. Problem */}
      <section className="py-20 px-6 bg-[var(--color-surface)]/50 border-y border-[var(--color-border)] relative z-10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">The Interview Prep Trap</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: 'search', title: 'Fragmented Research', desc: 'Scouring Reddit, Blind, and Glassdoor for days just to find what a company actually asks.' },
              { icon: 'help-circle', title: 'Unclear Priorities', desc: 'Not knowing if you should study System Design, LeetCode Hard, or behavioral questions today.' },
              { icon: 'time', title: 'Limited Time', desc: 'Wasting precious hours planning when you only have 3 weeks until the onsite.' }
            ].map((p, i) => (
              <Card key={i} icon={p.icon} title={p.title} desc={p.desc} />
            ))}
          </div>
        </div>
      </section>

      {/* 3. How it works */}
      <section className="py-20 px-6 max-w-6xl mx-auto relative z-10">
        <h2 className="text-3xl font-bold text-center mb-16">How PrepAmigo Works</h2>
        <div className="flex flex-col md:flex-row gap-8 text-center items-center justify-between relative">
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-border -translate-y-1/2 -z-10" />
          {[
            { step: '1', title: 'Input', desc: 'Tell us your target role and upload your resume.' },
            { step: '2', title: 'Analyze', desc: 'Our agents find company expectations and your skill gaps.' },
            { step: '3', title: 'Plan', desc: 'We generate a day-by-day study roadmap.' },
            { step: '4', title: 'Adapt', desc: 'The plan shifts based on your quiz scores and missed days.' }
          ].map((s, i) => (
            <div key={i} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-[var(--radius-card)] relative w-full md:w-64 group hover:border-primary/50 transition-colors">
              <div className="w-10 h-10 bg-[var(--color-navy-900)] text-white rounded-full flex items-center justify-center font-bold text-lg absolute -top-5 left-1/2 -translate-x-1/2 shadow-[var(--shadow-card)]">
                {s.step}
              </div>
              <h3 className="font-bold text-lg mt-4 mb-2 text-[var(--color-forest-700)]-text">{s.title}</h3>
              <p className="text-sm text-[var(--color-navy-500)]">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Agent grid */}
      <section className="py-20 px-6 bg-[var(--color-surface)] border-y border-[var(--color-border)] relative z-10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16">The Intelligence Engine</h2>
          <div className="grid md:grid-cols-4 gap-4">
            {AGENTS.map((a, i) => (
              <div key={i} className="p-5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-card)] hover:border-primary hover:shadow-[var(--shadow-pop)] hover:shadow-primary/5 transition-all group">
                <h4 className="font-bold text-[var(--color-forest-700)]-text mb-1">{a.name}</h4>
                <p className="text-xs text-[var(--color-navy-500)] mb-3">{a.role}</p>
                <div className="text-xs p-2 bg-[var(--color-surface)] rounded text-[var(--color-forest-700)]-text border border-[var(--color-border)] font-medium">"{a.out}"</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. What the Planner builds */}
      <section className="py-20 px-6 max-w-6xl mx-auto relative z-10">
        <h2 className="text-3xl font-bold text-center mb-16">What You Get</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <OutputCard title="Roadmap" desc="Day-by-day task lists tailored to your timeframe." preview={<div className="h-12 bg-[var(--color-navy-900)]/10 rounded-[var(--radius-control)] border border-primary/20 flex items-center px-4"><div className="w-4 h-4 rounded-full border-2 border-primary mr-3"/><div className="h-2 w-32 bg-[var(--color-navy-900)]/40 rounded-full" /></div>} />
          <OutputCard title="Calendar" desc="A global view of deadlines and missed tasks." preview={<div className="grid grid-cols-7 gap-1">{Array.from({length:14}).map((_,i)=><div key={i} className={`h-6 rounded ${i===5?'bg-[var(--color-amber-600)]/20 border border-warning':'bg-[var(--color-surface)] border border-[var(--color-border)]'}`} />)}</div>} />
          <OutputCard title="Resource Pack" desc="Curated links grouped by start, deep dive, and practice." preview={<div className="space-y-2"><div className="h-8 bg-[var(--color-surface)] rounded flex items-center px-3 border border-[var(--color-border)]"><Icon name="link" className="text-[var(--color-navy-500)] mr-2 text-sm"/><div className="h-1.5 w-24 bg-border rounded-full" /></div></div>} />
          <OutputCard title="Assessments" desc="Quizzes, coding tasks, and flashcard decks." preview={<div className="h-16 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] flex items-center justify-center p-2"><div className="text-[var(--color-forest-700)] font-bold">Q: What is a Bloom Filter?</div></div>} />
          <div className="md:col-span-2">
            <OutputCard title="Progress Dashboard" desc="Track your level, streaks, and XP as you complete real work." preview={<div className="h-4 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-full overflow-hidden mt-2"><div className="h-full bg-[var(--color-forest-700)] w-2/3" /></div>} />
          </div>
        </div>
      </section>

      {/* 6. Worked Example */}
      <section className="py-20 px-6 bg-[var(--color-surface)] border-y border-[var(--color-border)] relative z-10 overflow-hidden">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">From Prompt to Plan</h2>
          <div className="bg-[var(--color-bg)] border border-[var(--color-border)] p-8 rounded-[var(--radius-card)] shadow-[var(--shadow-card)]">
            <div className="bg-[var(--color-navy-900)]/10 text-[var(--color-forest-700)] p-4 rounded-[var(--radius-card)] border border-primary/20 font-medium mb-8">
              "I have 45 days. Target: SDE at Company X. Strong in React/Node. Weak in DSA and System Design."
            </div>
            
            <div className="space-y-4 border-l-2 border-[var(--color-border)] ml-4 pl-6 relative">
              {[
                { title: 'Company Expects', content: 'Distributed systems, Leetcode Medium/Hard' },
                { title: 'Candidate Knows', content: 'Frontend architectures, basic APIs' },
                { title: 'Gaps that matter', content: 'Scalability patterns, Graph algorithms' },
                { title: 'What to learn', content: 'System Design basics, Load Balancing, BFS/DFS' },
                { title: 'Time Allocation', content: '70% DSA & Systems, 30% React/Node revision' }
              ].map((step, i) => (
                <div key={i} className="relative">
                  <div className="absolute w-3 h-3 bg-[var(--color-navy-900)] rounded-full -left-[31px] top-1.5 ring-4 ring-background" />
                  <h4 className="font-bold text-[var(--color-forest-700)]-text">{step.title}</h4>
                  <p className="text-sm text-[var(--color-navy-500)]">{step.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 7. Gamification */}
      <section className="py-20 px-6 max-w-6xl mx-auto text-center relative z-10">
        <h2 className="text-3xl font-bold mb-6">Real Work = Real Progress</h2>
        <p className="text-[var(--color-navy-500)] max-w-2xl mx-auto mb-12">
          Earn XP, maintain your streak, and unlock titles by completing tasks and passing assessments. Progress here means you're actually getting better, not just spending time in the app.
        </p>
        <div className="flex justify-center gap-8 flex-wrap">
          {['5 Day Streak!', '+250 XP', 'Level Up: Architect', 'Badge: DSA Master'].map((badge, i) => (
            <div key={i} className="px-6 py-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full font-bold text-[var(--color-forest-700)] shadow-[var(--shadow-card)] flex items-center gap-2">
              <Icon name="star" /> {badge}
            </div>
          ))}
        </div>
      </section>

      {/* 8. USP / CTA */}
      <section className="py-24 px-6 bg-[var(--color-navy-900)] text-white text-center relative z-10">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="text-4xl font-bold">Tell PrepAmigo where you want to go.</h2>
          <p className="text-2xl text-white/80">It figures out what you need to learn next.</p>
          <div className="pt-8">
            <Link to="/signup" className="bg-white text-[var(--color-forest-700)] px-10 py-5 rounded-full font-bold text-lg hover:bg-white/90 transition-colors shadow-[var(--shadow-pop)]">
              Create your account
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Card({ icon, title, desc }: { icon: string, title: string, desc: string }) {
  return (
    <div className="bg-[var(--color-bg)] border border-[var(--color-border)] p-8 rounded-[var(--radius-card)] text-center">
      <div className="w-16 h-16 bg-[var(--color-navy-900)]/10 text-[var(--color-forest-700)] rounded-full flex items-center justify-center mx-auto mb-6">
        <Icon name={icon} className="text-3xl" />
      </div>
      <h3 className="font-bold text-xl mb-3 text-[var(--color-forest-700)]-text">{title}</h3>
      <p className="text-[var(--color-navy-500)]">{desc}</p>
    </div>
  );
}

function OutputCard({ title, desc, preview }: { title: string, desc: string, preview: React.ReactNode }) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-[var(--radius-card)] hover:border-primary/30 transition-colors flex flex-col h-full">
      <h3 className="font-bold text-xl mb-2 text-[var(--color-forest-700)]-text">{title}</h3>
      <p className="text-[var(--color-navy-500)] mb-6 text-sm">{desc}</p>
      <div className="mt-auto bg-[var(--color-bg)] p-4 rounded-[var(--radius-card)] border border-[var(--color-border)]">
        {preview}
      </div>
    </div>
  );
}
