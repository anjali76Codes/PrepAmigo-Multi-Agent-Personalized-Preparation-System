import { PageBackground } from '../components/ui/PageBackground';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';

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
    <div className="min-h-screen bg-background relative overflow-hidden text-primary-text">
      <PageBackground />
      
      {/* 1. Hero */}
      <section className="relative pt-32 pb-20 px-6 max-w-6xl mx-auto text-center z-10">
        <motion.div initial="hidden" animate="show" variants={containerVariants} className="max-w-4xl mx-auto space-y-8">
          <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-bold tracking-tight">
            Stop figuring out <span className="text-primary italic">what</span> to prepare. <br/> Just start preparing.
          </motion.h1>
          <motion.p variants={itemVariants} className="text-xl text-secondary-text max-w-2xl mx-auto leading-relaxed">
            Candidates spend more time researching what to study than actually studying. PrepAmigo is a multi-agent AI system that builds and adapts your personalized interview roadmap.
          </motion.p>
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Link to="/signup" className="bg-primary text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
              Start Free Trial
            </Link>
            <Link to="/app/chat" className="bg-surface text-primary-text border border-border px-8 py-4 rounded-full font-bold text-lg hover:border-primary/30 hover:bg-background transition-colors">
              Try the Chat Demo
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* 2. Problem */}
      <section className="py-20 px-6 bg-surface/50 border-y border-border relative z-10">
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
            <div key={i} className="bg-surface border border-border p-6 rounded-3xl relative w-full md:w-64 group hover:border-primary/50 transition-colors">
              <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold text-lg absolute -top-5 left-1/2 -translate-x-1/2 shadow-md">
                {s.step}
              </div>
              <h3 className="font-bold text-lg mt-4 mb-2 text-primary-text">{s.title}</h3>
              <p className="text-sm text-secondary-text">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Agent grid */}
      <section className="py-20 px-6 bg-surface border-y border-border relative z-10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16">The Intelligence Engine</h2>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { name: 'Company Research', role: 'Finds company-specific culture and stack.', out: 'Company X prefers React and AWS.' },
              { name: 'Job Intelligence', role: 'Analyzes the specific job description.', out: 'Role requires distributed systems knowledge.' },
              { name: 'Interview Intelligence', role: 'Finds past interview patterns.', out: 'They frequently ask System Design first.' },
              { name: 'Skill Gap', role: 'Compares your resume to the job.', out: 'Gap identified: High-scale database design.' },
              { name: 'Research', role: 'Gathers learning resources.', out: 'Found 5 highly-rated System Design articles.' },
              { name: 'Assessment', role: 'Generates quizzes and flashcards.', out: 'Created 15 flashcards for load balancing.' },
              { name: 'Planner', role: 'Builds and adjusts the roadmap.', out: 'Scheduled System Design for Day 3.' },
              { name: 'Progress', role: 'Tracks your velocity and streak.', out: 'Streak maintained! XP awarded.' }
            ].map((a, i) => (
              <div key={i} className="p-5 bg-background border border-border rounded-2xl hover:border-primary hover:shadow-lg hover:shadow-primary/5 transition-all group">
                <h4 className="font-bold text-primary-text mb-1">{a.name}</h4>
                <p className="text-xs text-secondary-text mb-3">{a.role}</p>
                <div className="text-xs p-2 bg-surface rounded text-primary-text border border-border font-medium">"{a.out}"</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. What the Planner builds */}
      <section className="py-20 px-6 max-w-6xl mx-auto relative z-10">
        <h2 className="text-3xl font-bold text-center mb-16">What You Get</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <OutputCard title="Roadmap" desc="Day-by-day task lists tailored to your timeframe." preview={<div className="h-12 bg-primary/10 rounded-lg border border-primary/20 flex items-center px-4"><div className="w-4 h-4 rounded-full border-2 border-primary mr-3"/><div className="h-2 w-32 bg-primary/40 rounded-full" /></div>} />
          <OutputCard title="Calendar" desc="A global view of deadlines and missed tasks." preview={<div className="grid grid-cols-7 gap-1">{Array.from({length:14}).map((_,i)=><div key={i} className={`h-6 rounded ${i===5?'bg-warning/20 border border-warning':'bg-surface border border-border'}`} />)}</div>} />
          <OutputCard title="Resource Pack" desc="Curated links grouped by start, deep dive, and practice." preview={<div className="space-y-2"><div className="h-8 bg-surface rounded flex items-center px-3 border border-border"><Icon name="link" className="text-secondary-text mr-2 text-sm"/><div className="h-1.5 w-24 bg-border rounded-full" /></div></div>} />
          <OutputCard title="Assessments" desc="Quizzes, coding tasks, and flashcard decks." preview={<div className="h-16 bg-surface border border-border rounded-xl flex items-center justify-center p-2"><div className="text-primary font-bold">Q: What is a Bloom Filter?</div></div>} />
          <div className="md:col-span-2">
            <OutputCard title="Progress Dashboard" desc="Track your level, streaks, and XP as you complete real work." preview={<div className="h-4 bg-background border border-border rounded-full overflow-hidden mt-2"><div className="h-full bg-accent w-2/3" /></div>} />
          </div>
        </div>
      </section>

      {/* 6. Worked Example */}
      <section className="py-20 px-6 bg-surface border-y border-border relative z-10 overflow-hidden">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">From Prompt to Plan</h2>
          <div className="bg-background border border-border p-8 rounded-3xl shadow-sm">
            <div className="bg-primary/10 text-primary p-4 rounded-xl border border-primary/20 font-medium mb-8">
              "I have 45 days. Target: SDE at Company X. Strong in React/Node. Weak in DSA and System Design."
            </div>
            
            <div className="space-y-4 border-l-2 border-border ml-4 pl-6 relative">
              {[
                { title: 'Company Expects', content: 'Distributed systems, Leetcode Medium/Hard' },
                { title: 'Candidate Knows', content: 'Frontend architectures, basic APIs' },
                { title: 'Gaps that matter', content: 'Scalability patterns, Graph algorithms' },
                { title: 'What to learn', content: 'System Design basics, Load Balancing, BFS/DFS' },
                { title: 'Time Allocation', content: '70% DSA & Systems, 30% React/Node revision' }
              ].map((step, i) => (
                <div key={i} className="relative">
                  <div className="absolute w-3 h-3 bg-primary rounded-full -left-[31px] top-1.5 ring-4 ring-background" />
                  <h4 className="font-bold text-primary-text">{step.title}</h4>
                  <p className="text-sm text-secondary-text">{step.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 7. Gamification */}
      <section className="py-20 px-6 max-w-6xl mx-auto text-center relative z-10">
        <h2 className="text-3xl font-bold mb-6">Real Work = Real Progress</h2>
        <p className="text-secondary-text max-w-2xl mx-auto mb-12">
          Earn XP, maintain your streak, and unlock titles by completing tasks and passing assessments. Progress here means you're actually getting better, not just spending time in the app.
        </p>
        <div className="flex justify-center gap-8 flex-wrap">
          {['5 Day Streak!', '+250 XP', 'Level Up: Architect', 'Badge: DSA Master'].map((badge, i) => (
            <div key={i} className="px-6 py-3 bg-surface border border-border rounded-full font-bold text-primary shadow-sm flex items-center gap-2">
              <Icon name="star" /> {badge}
            </div>
          ))}
        </div>
      </section>

      {/* 8. USP / CTA */}
      <section className="py-24 px-6 bg-primary text-white text-center relative z-10">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="text-4xl font-bold">Tell PrepAmigo where you want to go.</h2>
          <p className="text-2xl text-white/80">It figures out what you need to learn next.</p>
          <div className="pt-8">
            <Link to="/signup" className="bg-white text-primary px-10 py-5 rounded-full font-bold text-lg hover:bg-white/90 transition-colors shadow-xl">
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
    <div className="bg-background border border-border p-8 rounded-3xl text-center">
      <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
        <Icon name={icon} className="text-3xl" />
      </div>
      <h3 className="font-bold text-xl mb-3 text-primary-text">{title}</h3>
      <p className="text-secondary-text">{desc}</p>
    </div>
  );
}

function OutputCard({ title, desc, preview }: { title: string, desc: string, preview: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border p-6 rounded-3xl hover:border-primary/30 transition-colors flex flex-col h-full">
      <h3 className="font-bold text-xl mb-2 text-primary-text">{title}</h3>
      <p className="text-secondary-text mb-6 text-sm">{desc}</p>
      <div className="mt-auto bg-background p-4 rounded-xl border border-border">
        {preview}
      </div>
    </div>
  );
}
