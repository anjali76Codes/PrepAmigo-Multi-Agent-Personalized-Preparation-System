import { Reveal } from '../ui/Reveal';
import { Icon } from '../ui/Icon';
import { RevealCard, CardText } from '../ui/RevealCard';
import { Mascot } from '../ui/Mascot';

export function WhatYouGet() {
    return (
        <section className="relative z-10 mx-auto max-w-6xl px-6 py-24">
            <Reveal>
                <h2 className="mb-4 text-center text-4xl font-bold text-navy-900"><Mascot size="lg" variant='Motivated.png' />What You Get </h2>
                <p className="mx-auto mb-14 max-w-xl text-center text-navy-500">
                    Five things the Planner builds for you, and keeps updating as you go.
                </p>
            </Reveal>

            <div className="grid gap-6 md:grid-cols-6">
                {/* Roadmap */}
                <RevealCard from="center" className="bg-navy-900 text-white md:col-span-4">
                    <CardText
                        title="Roadmap"
                        desc="Day-by-day tasks with a topic, objective, time estimate and practice task."
                        muted="text-on-chrome-muted"
                    />
                    <div className="mt-auto space-y-3">
                        {[
                            { t: 'Day 12 · Graphs: BFS and DFS', done: true },
                            { t: 'Day 13 · Load balancing basics', today: true },
                            { t: 'Day 14 · Practice: 3 medium problems' },
                        ].map((d) => (
                            <div
                                key={d.t}
                                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${d.today
                                    ? 'border-chrome-accent bg-chrome-accent text-navy-900'
                                    : 'border-white/10 bg-white/5'
                                    }`}
                            >
                                <span
                                    className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${d.today ? 'border-navy-900' : 'border-chrome-accent'
                                        } ${d.done ? 'bg-chrome-accent' : ''}`}
                                >
                                    {d.done && <Icon name="checkmark" className="text-xs text-navy-900" />}
                                </span>
                                <span className="font-medium">{d.t}</span>
                                {d.today && (
                                    <span className="ml-auto rounded-full bg-navy-900 px-2 py-0.5 text-xs text-white">
                                        Today
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </RevealCard>

                {/* Calendar */}
                <RevealCard from="bottom" className="bg-lavender-100 text-navy-900 md:col-span-2">
                    <CardText
                        title="Calendar"
                        desc="Due dates, reminders and one-tap rescheduling for missed days."
                        muted="text-navy-500"
                    />
                    <div className="mt-auto grid grid-cols-7 gap-1.5">
                        {Array.from({ length: 14 }).map((_, i) => (
                            <div
                                key={i}
                                className={`h-7 rounded-lg ${i === 5
                                    ? 'border border-beige-600 bg-beige-100'
                                    : i < 5
                                        ? 'bg-chrome'
                                        : i === 6
                                            ? 'bg-navy-900'
                                            : 'bg-white'
                                    }`}
                            />
                        ))}
                    </div>
                </RevealCard>

                {/* Resource Pack */}
                <RevealCard from="left" className="bg-chrome text-white md:col-span-2">
                    <CardText
                        title="Resource Pack"
                        desc="Curated, grouped by purpose. Never a link dump."
                        muted="text-white/80"
                    />
                    <div className="mt-auto flex flex-wrap gap-2">
                        {['Start here', 'Go deeper', 'Practice', 'Interview-specific'].map((c, i) => (
                            <span
                                key={c}
                                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${i === 0 ? 'bg-white text-navy-900' : 'border border-white/30 bg-white/10'
                                    }`}
                            >
                                {c}
                            </span>
                        ))}
                    </div>
                </RevealCard>

                {/* Assessments */}
                <RevealCard from="bottom" className="bg-chrome-accent text-navy-900 md:col-span-2">
                    <CardText
                        title="Assessments"
                        desc="Weekly quizzes and revision flashcards."
                        muted="text-navy-500"
                    />
                    <div className="mt-auto rounded-2xl bg-white p-4 shadow-card">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy-500">
                            Flashcard
                        </p>
                        <p className="font-bold">What is a Bloom filter?</p>
                    </div>
                </RevealCard>

                {/* Progress */}
                <RevealCard from="right" className="bg-navy-700 text-white md:col-span-2">
                    <CardText
                        title="Progress"
                        desc="XP, streaks, badges, titles and skill levels from real work."
                        muted="text-on-chrome-muted"
                    />
                    <div className="mt-auto">
                        <div className="mb-2 flex justify-between text-xs font-semibold">
                            <span>Level 4 · Architect</span>
                            <span>650 / 800 XP</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-white/15">
                            <div className="h-full w-4/5 rounded-full bg-chrome-accent" />
                        </div>
                    </div>
                </RevealCard>
            </div>
        </section>
    );
}