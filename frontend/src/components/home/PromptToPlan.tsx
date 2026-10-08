import React from 'react';
import { Reveal, RevealStagger, RevealStaggerItem } from '../ui/Reveal';

export function PromptToPlan() {
    return (
        <section className="relative z-10 mx-auto max-w-6xl px-6 py-24 overflow-hidden">
            <Reveal>
                <h2 className="mb-12 text-center text-4xl font-extrabold tracking-tight text-carbon-900">
                    From <span className="text-chrome-accent">Prompt</span> to Plan
                </h2>
            </Reveal>

            <div className="grid gap-8 md:grid-cols-2">
                <RevealCard className="bg-deep-emerald p-8 flex flex-col justify-center rounded-[2rem] text-white">
                    <p className="text-soft-rose mb-4 text-sm font-semibold uppercase tracking-widest">
                        Your Input
                    </p>
                    <div className="rounded-2xl bg-white/10 p-6 shadow-inner border border-white/10">
                        <p className="text-xl italic leading-relaxed">
                            "I have 45 days. Target: SDE at Company X. Strong in React/Node. Weak in DSA and System Design."
                        </p>
                    </div>
                </RevealCard>

                <RevealCard className="bg-surface p-8 rounded-[2rem] border border-border">
                    <p className="text-carbon-500 mb-6 text-sm font-semibold uppercase tracking-widest">
                        What PrepAmigo Extracts
                    </p>
                    <RevealStagger className="space-y-6 relative border-l-2 border-chrome-accent ml-2 pl-6">
                        {[
                            { title: 'Company Expects', content: 'Distributed systems, Leetcode Medium/Hard' },
                            { title: 'Candidate Knows', content: 'Frontend architectures, basic APIs' },
                            { title: 'Gaps that matter', content: 'Scalability patterns, Graph algorithms' },
                            { title: 'What to learn', content: 'System Design basics, Load Balancing, BFS/DFS' },
                            { title: 'Time Allocation', content: '70% DSA & Systems, 30% React/Node revision' }
                        ].map((step, i) => (
                            <RevealStaggerItem key={i} className="relative">
                                <div className="absolute w-4 h-4 bg-chrome-accent rounded-full -left-[33px] top-1 ring-4 ring-surface" />
                                <h4 className="font-bold text-carbon-900 mb-1">{step.title}</h4>
                                <p className="text-sm text-carbon-500">{step.content}</p>
                            </RevealStaggerItem>
                        ))}
                    </RevealStagger>
                </RevealCard>
            </div>
        </section>
    );
}

// A simple wrapper to reveal sections since RevealCard from ui expects specific "from" prop
function RevealCard({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <Reveal className={className}>
            {children}
        </Reveal>
    )
}
