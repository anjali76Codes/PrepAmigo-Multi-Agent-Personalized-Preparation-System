import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "../ui/Icon";
import { submitFlashcardReview, type FlashcardDeck } from "../../mocks/assessment.mock";
import { fade } from "./shared";
import { RunnerHeader } from "./RunnerHead";
import { FlipCard, RatingButtons } from "./FlipCard";
import { Result } from "./Result";

const NAV_BTN =
    "w-11 h-11 rounded-full border border-border bg-surface text-chrome flex items-center justify-center hover:bg-lavender-100 disabled:opacity-30 transition-colors";

export function DeckRunner({ deck, onExit }: { deck: FlashcardDeck; onExit: () => void }) {
    const [idx, setIdx] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [ratings, setRatings] = useState<Record<number, number>>({});
    const [done, setDone] = useState(false);

    const total = deck.cards.length;
    const card = deck.cards[idx];
    const ratedCount = Object.keys(ratings).length;

    const restart = () => { setIdx(0); setFlipped(false); setRatings({}); setDone(false); };
    const go = (n: number) => { setFlipped(false); setIdx(Math.max(0, Math.min(total - 1, n))); };

    const rate = (value: number) => {
        const next = { ...ratings, [idx]: value };
        setRatings(next);
        if (Object.keys(next).length >= total) {
            setDone(true);
            // saved once per finished deck: feeds the knowledge graph
            submitFlashcardReview(deck._id, deck.cards.map((_: unknown, i: number) => next[i] ?? null));
        } else {
            go(idx + 1 >= total ? 0 : idx + 1);
        }
    };

    if (done) {
        const confident = Object.values(ratings).filter((v) => v >= 3).length;
        return (
            <div className="py-6">
                <Result
                    title="Deck complete"
                    sub={`You felt confident on ${confident} of ${total} cards.`}
                    onAgain={restart}
                    onExit={onExit}
                />
            </div>
        );
    }

    return (
        <div className="space-y-5 max-w-3xl mx-auto">
            <RunnerHeader
                backLabel="All decks"
                onBack={onExit}
                label={`Card ${idx + 1} of ${total}`}
                value={ratedCount}
                total={total}
            />

            <AnimatePresence mode="wait">
                <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.2 }}
                >
                    <FlipCard card={card} flipped={flipped} onFlip={() => setFlipped((f) => !f)} size="lg" showCategory />
                </motion.div>
            </AnimatePresence>

            <div className="min-h-14 flex items-center justify-center">
                <AnimatePresence mode="wait">
                    {flipped ? (
                        <motion.div key="rate" {...fade}>
                            <RatingButtons onRate={rate} />
                        </motion.div>
                    ) : (
                        <motion.div key="nav" {...fade} className="flex items-center gap-3">
                            <button onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="Previous card" className={NAV_BTN}>
                                <Icon name="arrow-back" />
                            </button>
                            <button onClick={() => go(idx + 1)} disabled={idx === total - 1} aria-label="Next card" className={NAV_BTN}>
                                <Icon name="arrow-forward-outline" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}