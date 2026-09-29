import { Reveal } from '../ui/Reveal';
import { Icon } from '../ui/Icon';
import { RevealCard, CardText } from '../ui/RevealCard';

export function InterviewTrap() {
    return (
        <section className="relative z-10 mx-auto max-w-6xl px-6 py-24">
            <Reveal>
                <h2 className="mb-4 text-center text-3xl font-bold text-navy-900">The Interview Prep Trap</h2>
                <p className="mx-auto mb-14 max-w-xl text-center text-navy-500">
                    Why the old way of preparing for interviews is broken.
                </p>
            </Reveal>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Fragmented Research */}
                <RevealCard from="bottom" className="bg-navy-900 text-white md:col-span-1">
                    <CardText
                        title="Fragmented Research"
                        desc="Scouring Reddit, Blind, and Glassdoor for days just to find what a company actually asks."
                        muted="text-on-chrome-muted"
                    />
                    <div className="mt-auto pt-8 flex justify-end opacity-20">
                        <Icon name="search" className="text-8xl" />
                    </div>
                </RevealCard>

                {/* Unclear Priorities */}
                <RevealCard from="center" className="bg-lavender-100 text-navy-900 md:col-span-1">
                    <CardText
                        title="Unclear Priorities"
                        desc="Not knowing if you should study System Design, LeetCode Hard, or behavioral questions today."
                        muted="text-navy-500"
                    />
                    <div className="mt-auto pt-8 flex justify-end opacity-20">
                        <Icon name="help-circle" className="text-8xl" />
                    </div>
                </RevealCard>

                {/* Limited Time */}
                <RevealCard from="bottom" className="bg-chrome-accent text-navy-900 md:col-span-1">
                    <CardText
                        title="Limited Time"
                        desc="Wasting precious hours planning when you only have 3 weeks until the onsite."
                        muted="text-navy-500"
                    />
                    <div className="mt-auto pt-8 flex justify-end opacity-20">
                        <Icon name="time" className="text-8xl" />
                    </div>
                </RevealCard>
            </div>
        </section>
    );
}
