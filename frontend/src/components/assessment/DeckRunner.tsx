import { useState, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "../ui/Icon";
import { submitFlashcardReview, type FlashcardDeck } from "../../mocks/assessment.mock";
import { Back, Badge, ProgressBar, fade } from "./shared";
import { Result } from "./Result";

const RATINGS = [
    { label: "Hard", value: 1 },
    { label: "Okay", value: 3 },
    { label: "Easy", value: 5 },
];

const face: CSSProperties = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" };

export function DeckRunner({ deck, onExit }: { deck: FlashcardDeck; onExit: () => void }) {
    const [idx, setIdx] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [ratings, setRatings] = useState<Record<number, number>>({});
    const [done, setDone] = useState(false);

    const total = deck.cards.length;
    const card = deck.cards[idx];

    const restart = () => { setIdx(0); setFlipped(false); setRatings({}); setDone(false); };
    const go = (n: number) => { setFlipped(false); setIdx(Math.max(0, Math.min(total - 1, n))); };
    const rate = (value: number) => {
        const r = { ...ratings, [idx]: value };
        setRatings(r);
        if (Object.keys(r).length >= total) {
            setDone(true);
            // saved once per finished deck: feeds the knowledge graph
            submitFlashcardReview(deck._id, deck.cards.map((_: unknown, i: number) => r[i] ?? null));
        }
        else go(idx + 1 >= total ? 0 : idx + 1);
    };

    if (done) {
        const confident = Object.values(ratings).filter((v) => v >= 3).length;
        return <Result title="Deck complete" sub={`You felt confident on ${confident} of ${total} cards.`} onAgain={restart} onExit={onExit} />;
    }

    return (
        <div className="space-y-5 max-w-3xl mx-auto">
            <div className="flex items-center justify-between">
                <Back onClick={onExit} label="All decks" />
                <span className="text-sm font-bold text-rosewood">Card {idx + 1} of {total}</span>
            </div>
            <ProgressBar value={Object.keys(ratings).length} total={total} />

            <div style={{ perspective: 1400 }}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -40 }}
                        transition={{ duration: 0.2 }}
                    >
                        {/* rotateX flips bottom to top */}
                        <motion.div
                            onClick={() => setFlipped((f) => !f)}
                            animate={{ rotateX: flipped ? 180 : 0 }}
                            transition={{ duration: 0.6, ease: "easeInOut" }}
                            style={{ transformStyle: "preserve-3d" }}
                            className="relative h-80 md:h-[26rem] cursor-pointer"
                        >
                            <div style={face} className="absolute inset-0 bg-surface border border-border rounded-3xl shadow-card p-10 flex flex-col items-center justify-center text-center gap-5">
                                <Badge>{card.category}</Badge>
                                <p className="text-2xl md:text-3xl font-bold text-carbon-900 leading-snug">{card.front}</p>
                                <span className="text-sm font-semibold text-rosewood flex items-center gap-1">
                                    <Icon name="refresh" /> Tap to reveal
                                </span>
                            </div>

                            <div style={{ ...face, transform: "rotateX(180deg)" }} className="absolute inset-0 bg-chrome text-on-chrome rounded-3xl shadow-card p-10 flex flex-col items-center justify-center text-center gap-5">
                                <span className="text-xs font-bold uppercase tracking-wider text-on-chrome-muted">Answer</span>
                                <p className="text-xl md:text-2xl font-medium leading-relaxed">{card.back}</p>
                                <div className="flex flex-wrap justify-center gap-1.5">
                                    {card.tags.map((t: string) => (
                                        <span key={t} className="px-2.5 py-0.5 rounded-full bg-chrome-hover border border-chrome-border text-xs">{t}</span>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </AnimatePresence>
            </div>

            <div className="h-14 flex items-center justify-center">
                <AnimatePresence mode="wait">
                    {flipped ? (
                        <motion.div key="rate" {...fade} className="flex items-center gap-3">
                            <span className="text-sm text-rosewood font-semibold">How well did you know it?</span>
                            {RATINGS.map((r) => (
                                <button
                                    key={r.label}
                                    onClick={() => rate(r.value)}
                                    className="px-5 py-2.5 rounded-xl bg-lavender-100 border border-border text-chrome font-bold text-sm hover:bg-chrome hover:text-on-chrome transition-colors"
                                >
                                    {r.label}
                                </button>
                            ))}
                        </motion.div>
                    ) : (
                        <motion.div key="nav" {...fade} className="flex items-center gap-3">
                            <button onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="Previous"
                                className="w-11 h-11 rounded-full border border-border text-chrome flex items-center justify-center hover:bg-lavender-100 disabled:opacity-30 transition-colors">
                                <Icon name="arrow-back" />
                            </button>
                            <button onClick={() => go(idx + 1)} disabled={idx === total - 1} aria-label="Next"
                                className="w-11 h-11 rounded-full border border-border text-chrome flex items-center justify-center hover:bg-lavender-100 disabled:opacity-30 transition-colors">
                                <Icon name="arrow-forward-outline" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}