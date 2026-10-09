import { useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    submitAssessmentAttempt,
    submitFlashcardReview,
    type Assessment,
    type FlashcardDeck,
} from "../../mocks/assessment.mock";
import { Button, CardHeader, Panel, fade } from "./shared";
import { RunnerHeader } from "./RunnerHead";
import { QuestionCard, type Question } from "./QuestionCard";
import { FlipCard, RatingButtons, type Card } from "./FlipCard";
import { Result } from "./Result";
import { buildFeedback, type Feedback } from "./FeedbackPanel";

type Item =
    | { kind: "quiz"; question: Question; idx: number }
    | { kind: "card"; card: Card; idx: number };

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

interface Props {
    quiz: Assessment;
    deck: FlashcardDeck | null;
    onExit: () => void;
    onLevelComplete: () => void;
    onFeedback: (f: Feedback) => void;
    onCardFlip?: (flipped: boolean) => void;
}

/** Level flow: quiz questions and flashcards mixed into one session. */
export function CombinedRunner({ quiz, deck, onExit, onLevelComplete, onFeedback, onCardFlip }: Props) {
    const items = useMemo<Item[]>(() => {
        const quizItems = quiz.questions.map((question, idx): Item => ({ kind: "quiz", question, idx }));
        const cardItems = (deck?.cards ?? []).map((card, idx): Item => ({ kind: "card", card, idx }));
        return shuffle([...quizItems, ...cardItems]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quiz._id, deck?._id]);

    const total = items.length;
    const [pos, setPos] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [quizAnswers, setQuizAnswers] = useState<(string | null)[]>(() => Array(quiz.questions.length).fill(null));
    const [deckRatings, setDeckRatings] = useState<Record<number, number>>({});
    const [submitting, setSubmitting] = useState(false);
    const [finished, setFinished] = useState(false);

    const nextRef = useRef<() => void>(() => { });

    const item = items[pos];

    if (!item) {
        return <Result title="Nothing to review" sub="This level has no questions yet." onExit={onExit} exitLabel="Back" />;
    }

    if (finished) {
        return (
            <Result
                mascot="Celebration.png"
                title="Sprint assessment complete!"
                sub="Great job! You finished all questions and flashcard reviews for this milestone."
                onExit={onLevelComplete}
                exitLabel="Back to dashboard"
            />
        );
    }

    const picked = item.kind === "quiz" ? quizAnswers[item.idx] : null;
    const currentDone = item.kind === "quiz" ? picked !== null : flipped;
    const isLast = pos + 1 >= total;

    const finish = async (ratings: Record<number, number>) => {
        if (submitting) return;
        setSubmitting(true);
        try {
            await submitAssessmentAttempt(quiz._id, quizAnswers);
            if (deck) {
                await submitFlashcardReview(deck._id, deck.cards.map((_: unknown, i: number) => ratings[i] ?? null));
            }
        } catch (err) {
            console.error("Failed to submit assessment/deck:", err);
        }
        setFinished(true);
    };

    // ratings are passed in so the very last card's rating is not lost to stale state
    const advance = (ratings = deckRatings) => {
        onFeedback(null);
        onCardFlip?.(false);
        if (isLast) return void finish(ratings);
        setPos(pos + 1);
        setFlipped(false);
    };

    nextRef.current = () => advance();

    const pickAnswer = (letter: string) => {
        if (item.kind !== "quiz" || picked) return;
        setQuizAnswers((prev) => { const n = [...prev]; n[item.idx] = letter; return n; });
        onFeedback(buildFeedback(
            item.question,
            letter,
            isLast ? "Finish level" : "Next question",
            () => nextRef.current()
        ));
    };

    const rateCard = (value: number) => {
        if (item.kind !== "card") return;
        const next = { ...deckRatings, [item.idx]: value };
        setDeckRatings(next);
        advance(next);
    };

    const toggleFlip = () => {
        const next = !flipped;
        setFlipped(next);
        onCardFlip?.(next);
    };

    return (
        <div className="w-full max-w-3xl space-y-6 py-2">
            <RunnerHeader
                backLabel="All assessments"
                onBack={onExit}
                label={`${pos + 1} of ${total}`}
                value={pos + (currentDone ? 1 : 0)}
                total={total}
            />

            <AnimatePresence mode="wait">
                <Panel key={pos} tone={item.kind === "quiz" ? "emerald" : "plain"}>
                    {item.kind === "quiz" ? (
                        <QuestionCard
                            question={item.question}
                            picked={picked}
                            onPick={pickAnswer}
                            onNext={() => advance()}
                            nextLabel={isLast ? "Finish level" : "Next question"}
                            tag="Quiz challenge"
                            showInlineFeedback={false}
                        />
                    ) : (
                        <div className="space-y-5">
                            <CardHeader
                                badge={item.card.category}
                                tag="Flashcard review"
                                hint="Flip to reveal"
                                tone="plain"
                            />

                            <FlipCard
                                card={item.card}
                                flipped={flipped}
                                onFlip={toggleFlip}
                                size="md"
                            />

                            <div className="flex justify-center pt-1 min-h-11">
                                {flipped ? (
                                    <motion.div {...fade}>
                                        <RatingButtons onRate={rateCard} />
                                    </motion.div>
                                ) : (
                                    <Button
                                        variant="ghost"
                                        onClick={() => advance()}
                                        className="px-5 py-2 text-xs font-semibold"
                                    >
                                        Skip for now
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </Panel>
            </AnimatePresence>
        </div>
    );
}