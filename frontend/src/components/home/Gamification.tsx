import { Reveal, RevealStagger, RevealStaggerItem } from '../ui/Reveal';
import { Icon } from '../ui/Icon';

export function Gamification() {
    return (
        <section className="relative z-10 mx-auto max-w-6xl px-6 py-24 text-center">
            <Reveal>
                <h2 className="mb-6 text-4xl font-extrabold tracking-tight text-carbon-900">
                    Real Work = <span className="text-chrome-accent">Real Progress</span>
                </h2>
                <p className="mx-auto mb-16 max-w-2xl text-lg text-carbon-500 leading-relaxed">
                    Earn XP, maintain your streak, and unlock titles by completing tasks and passing assessments. Progress here means you're actually getting better, not just spending time in the app.
                </p>
                <RevealStagger className="flex flex-wrap justify-center gap-6">
                    {[
                        { title: '5 Day Streak!', icon: 'star', color: 'text-beige-500', bg: 'bg-beige-50' },
                        { title: '+250 XP', icon: 'flash', color: 'text-chrome-accent', bg: 'bg-chrome-accent/10' },
                        { title: 'Level Up: Architect', icon: 'trophy', color: 'text-coral-500', bg: 'bg-coral-50' },
                        { title: 'Badge: DSA Master', icon: 'shield', color: 'text-navy-500', bg: 'bg-navy-50' }
                    ].map((badge, i) => (
                        <RevealStaggerItem key={i}>
                            <div className="group relative flex items-center gap-3 rounded-full border border-border bg-white px-8 py-4 shadow-card hover:shadow-pop transition-all hover:-translate-y-1">
                                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${badge.bg}`}>
                                    <Icon name={badge.icon as any} className={`text-xl ${badge.color}`} />
                                </div>
                                <span className="font-bold text-carbon-900 text-lg">{badge.title}</span>
                            </div>
                        </RevealStaggerItem>
                    ))}
                </RevealStagger>
            </Reveal>
        </section>
    );
}
