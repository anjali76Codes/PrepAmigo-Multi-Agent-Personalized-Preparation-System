import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "../ui/Icon";
import { Mascot } from "../ui/Mascot";
import { cn } from "../../utils/utils";
import {
    submitAssessmentAttempt,
    submitFlashcardReview,
    type Assessment,
    type FlashcardDeck,
} from "../../mocks/assessment.mock";
import { Back, Badge, ProgressBar, fade } from "./shared";

type QuizItem = { kind: "quiz"; question: any; quizId: string; idx: number };
type CardItem = { kind: "card"; card: any; deckId: string; idx: number };
type Item = QuizItem | CardItem;

const LETTERS = ["A", "B", "C", "D"];
const RATINGS = [
    { label: "Hard", value: 1 },
    { label: "Okay", value: 3 },
    { label: "Easy", value: 5 },
];

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function QuizCard({ item, picked, onPick }: { item: QuizItem; picked: string | null; onPick: (l: string) => void }) {
    const { question: qn } = item;
    const checked = picked !== null;
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
                <div className="flex items-center gap-2">
                    <Badge>{qn.difficulty}</Badge>
                    <span className="px-2.5 py-1 rounded-full bg-lavender-100 border border-chrome/20 text-xs font-bold text-chrome">
                        Quiz Challenge
                    </span>
                </div>
                <span className="text-xs font-medium text-carbon-400">Single Choice</span>
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-carbon-900 leading-relaxed tracking-tight">
                {qn.question}
            </h2>

            <div className="space-y-2.5 pt-1">
                {qn.options.map((opt: string, i: number) => {
                    const letter = LETTERS[i];
                    const isCorrect = letter === qn.correct_answer;
                    const isPicked = letter === picked;

                    let optionStateClasses = "border-border/70 hover:border-chrome/40 hover:bg-lavender-50/50 bg-white text-carbon-800";
                    let badgeClasses = "bg-bg text-carbon-600 border border-border/60";

                    if (checked) {
                        if (isCorrect) {
                            optionStateClasses = "border-green-600/60 bg-green-50/70 text-green-950 shadow-xs";
                            badgeClasses = "bg-green-600 text-white border-green-600";
                        } else if (isPicked) {
                            optionStateClasses = "border-coral-500/70 bg-coral-50/60 text-carbon-900 shadow-xs";
                            badgeClasses = "bg-coral-500 text-white border-coral-500";
                        } else {
                            optionStateClasses = "border-border/40 opacity-40 bg-white/40 text-carbon-500 cursor-not-allowed";
                            badgeClasses = "bg-bg text-carbon-400 border-border/40";
                        }
                    }

                    return (
                        <motion.button
                            key={letter}
                            whileHover={!checked ? { x: 3 } : undefined}
                            whileTap={!checked ? { scale: 0.995 } : undefined}
                            onClick={() => onPick(letter)}
                            disabled={checked}
                            className={cn(
                                "w-full group flex items-start gap-3.5 text-left p-3.5 sm:p-4 rounded-xl border transition-all duration-150 cursor-pointer",
                                optionStateClasses
                            )}
                        >
                            <span
                                className={cn(
                                    "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors mt-0.5",
                                    badgeClasses
                                )}
                            >
                                {checked && isCorrect ? (
                                    <Icon name="checkmark" className="text-sm" />
                                ) : checked && isPicked ? (
                                    <Icon name="close" className="text-sm" />
                                ) : (
                                    letter
                                )}
                            </span>
                            <span className="font-medium text-sm sm:text-base leading-normal pt-0.5">
                                {opt}
                            </span>
                        </motion.button>
                    );
                })}
            </div>

            <AnimatePresence>
                {checked && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden pt-3 border-t border-border/60"
                    >
                        <div
                            className={cn(
                                "rounded-xl p-4 sm:p-5 border space-y-1.5 transition-colors",
                                picked === qn.correct_answer
                                    ? "bg-green-50/60 border-green-200/80"
                                    : "bg-coral-50/50 border-coral-200/70"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <Icon
                                    name={picked === qn.correct_answer ? "checkmark-circle" : "alert-circle"}
                                    className={cn(
                                        "text-lg",
                                        picked === qn.correct_answer ? "text-green-600" : "text-coral-500"
                                    )}
                                />
                                <span
                                    className={cn(
                                        "text-xs font-bold uppercase tracking-wider",
                                        picked === qn.correct_answer ? "text-green-800" : "text-coral-700"
                                    )}
                                >
                                    {picked === qn.correct_answer ? "Correct Answer" : `Incorrect · Answer: Option ${qn.correct_answer}`}
                                </span>
                            </div>
                            <p className="text-sm text-carbon-800 leading-relaxed pl-6">
                                {qn.explanation}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function FlashCard({ item, flipped, onFlip, onRate }: { item: CardItem; flipped: boolean; onFlip: () => void; onRate: (v: number) => void }) {
    const { card } = item;
    const face: React.CSSProperties = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" as any };
    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
                <div className="flex items-center gap-2">
                    <Badge>{card.category}</Badge>
                    <span className="px-2.5 py-1 rounded-full bg-lavender-100 border border-chrome/20 text-xs font-bold text-chrome">
                        Flashcard Review
                    </span>
                </div>
                <span className="text-xs font-medium text-carbon-400">Flip to reveal</span>
            </div>

            <div style={{ perspective: 1400 }}>
                <motion.div
                    onClick={onFlip}
                    animate={{ rotateX: flipped ? 180 : 0 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    style={{ transformStyle: "preserve-3d" }}
                    className="relative h-60 sm:h-64 cursor-pointer"
                >
                    <div style={face} className="absolute inset-0 bg-white border border-border/80 rounded-2xl shadow-card p-6 sm:p-8 flex flex-col items-center justify-center text-center gap-3">
                        <p className="text-lg sm:text-xl font-bold text-carbon-900 leading-relaxed">{card.front}</p>
                        <span className="text-xs font-semibold text-navy-400 flex items-center gap-1.5 mt-2 bg-bg px-3 py-1.5 rounded-full border border-border/60">
                            <Icon name="refresh" className="text-sm" /> Tap card to reveal answer
                        </span>
                    </div>
                    <div style={{ ...face, transform: "rotateX(180deg)" }} className="absolute inset-0 bg-chrome text-on-chrome rounded-2xl shadow-card p-6 sm:p-8 flex flex-col items-center justify-center text-center gap-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-on-chrome-muted">Answer Key</span>
                        <p className="text-base sm:text-lg font-medium leading-relaxed">{card.back}</p>
                        <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                            {card.tags.map((t: string) => (
                                <span key={t} className="px-2.5 py-0.5 rounded-full bg-chrome-hover border border-chrome-border text-xs text-on-chrome-muted">
                                    {t}
                                </span>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </div>

            <AnimatePresence mode="wait">
                {flipped && (
                    <motion.div key="rate" {...fade} className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
                        <span className="text-xs text-carbon-500 font-semibold">Self-Assessment:</span>
                        <div className="flex gap-2">
                            {RATINGS.map((r) => (
                                <button
                                    key={r.label}
                                    onClick={() => onRate(r.value)}
                                    className="px-4 py-2 rounded-xl bg-white border border-border text-chrome font-bold text-xs hover:bg-chrome hover:text-on-chrome hover:border-chrome shadow-xs transition-all cursor-pointer"
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function CompletionOverlay({ onBack }: { onBack: () => void }) {
    return (
        <motion.div {...fade} className="max-w-xl mx-auto bg-white border border-border/80 rounded-2xl p-8 sm:p-10 text-center space-y-5 shadow-card">
            <Mascot variant="Celebration.png" size="xl" style={{ width: 140, height: 140, margin: "0 auto" }} />
            <h2 className="text-2xl sm:text-3xl font-extrabold text-carbon-900">Sprint Assessment Complete!</h2>
            <p className="text-carbon-600 text-sm sm:text-base leading-relaxed">
                Great job! You have completed all questions and flashcard reviews for this sprint milestone.
            </p>
            <div className="flex justify-center gap-3 pt-3">
                <button
                    onClick={onBack}
                    className="px-6 py-2.5 rounded-xl bg-chrome text-on-chrome font-bold text-sm hover:bg-chrome-hover shadow-xs hover:shadow-pop transition-all cursor-pointer"
                >
                    Back to Dashboard
                </button>
            </div>
        </motion.div>
    );
}

interface Props {
    quiz: Assessment;
    deck: FlashcardDeck | null;
    onExit: () => void;
    onLevelComplete: () => void;
}

export function CombinedRunner({ quiz, deck, onExit, onLevelComplete }: Props) {
    const items: Item[] = useMemo(() => {
        const quizItems: Item[] = quiz.questions.map((q, i) => ({ kind: "quiz" as const, question: q, quizId: quiz._id, idx: i }));
        const cardItems: Item[] = deck ? deck.cards.map((c, i) => ({ kind: "card" as const, card: c, deckId: deck._id, idx: i })) : [];
        return shuffle([...quizItems, ...cardItems]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quiz._id, deck?._id]);

    const total = items.length;
    const [pos, setPos] = useState(0);
    const [visited, setVisited] = useState<Set<number>>(new Set([0]));
    const [quizAnswers, setQuizAnswers] = useState<(string | null)[]>(Array(quiz.questions.length).fill(null));
    const [deckRatings, setDeckRatings] = useState<Record<number, number>>({});
    const [pickedLetter, setPickedLetter] = useState<string | null>(null);
    const [cardFlipped, setCardFlipped] = useState(false);
    const [showCompletion, setShowCompletion] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const item = items[pos];
    const visitedCount = visited.size;

    const go = async (newPos: number) => {
        if (newPos >= total) {
            if (!submitted) {
                setSubmitted(true);
                try {
                    await submitAssessmentAttempt(quiz._id, quizAnswers);
                    if (deck) {
                        await submitFlashcardReview(
                            deck._id,
                            deck.cards.map((_: any, i: number) => deckRatings[i] ?? null)
                        );
                    }
                } catch (err) {
                    console.error("Failed to submit assessment/deck:", err);
                }
            }
            setShowCompletion(true);
        } else {
            setPos(newPos);
            setPickedLetter(null);
            setCardFlipped(false);
            setVisited((v) => { const n = new Set(v); n.add(newPos); return n; });
        }
    };

    const handlePickQuiz = (letter: string) => {
        if (pickedLetter !== null || item.kind !== "quiz") return;
        setPickedLetter(letter);
        const i = (item as QuizItem).idx;
        setQuizAnswers((prev) => { const n = [...prev]; n[i] = letter; return n; });
        setVisited((v) => { const n = new Set(v); n.add(pos); return n; });
    };

    const handleNext = () => {
        setVisited((v) => { const n = new Set(v); n.add(pos); return n; });
        go(pos + 1);
    };

    const handleRate = (value: number) => {
        if (item.kind !== "card") return;
        const updRatings = { ...deckRatings, [(item as CardItem).idx]: value };
        setDeckRatings(updRatings);
        setVisited((v) => { const n = new Set(v); n.add(pos); return n; });
        go(pos + 1);
    };

    if (showCompletion) return <CompletionOverlay onBack={onLevelComplete} />;

    return (
        <div className="max-w-2xl mx-auto space-y-6 py-2">
            {/* Top Navigation & Status Bar */}
            <div className="flex items-center justify-between pb-1">
                <Back onClick={onExit} label="All assessments" />
                <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-white border border-border text-carbon-700 shadow-xs">
                        {pos + 1} of {total}
                    </span>
                    <span className="text-xs font-bold text-cocoa uppercase tracking-wider">
                        {Math.round((visitedCount / total) * 100)}%
                    </span>
                </div>
            </div>

            <ProgressBar value={visitedCount} total={total} />

            <AnimatePresence mode="wait">
                <motion.div
                    key={pos}
                    {...fade}
                    className="bg-white border border-border/80 rounded-2xl p-6 sm:p-8 shadow-card space-y-5"
                >
                    {item.kind === "quiz" ? (
                        <QuizCard item={item as QuizItem} picked={pickedLetter} onPick={handlePickQuiz} />
                    ) : (
                        <FlashCard item={item as CardItem} flipped={cardFlipped} onFlip={() => setCardFlipped((f) => !f)} onRate={handleRate} />
                    )}

                    {item.kind === "quiz" && pickedLetter !== null && (
                        <div className="flex justify-end pt-3">
                            <button
                                onClick={handleNext}
                                className="px-6 py-2.5 rounded-xl bg-chrome text-on-chrome font-bold text-sm hover:bg-chrome-hover shadow-xs hover:shadow-pop transition-all flex items-center gap-2 cursor-pointer"
                            >
                                <span>{pos + 1 >= total ? "Finish Level" : "Next Question"}</span>
                                <Icon name="arrow-forward" className="text-sm" />
                            </button>
                        </div>
                    )}

                    {item.kind === "card" && !cardFlipped && (
                        <div className="flex justify-end pt-3">
                            <button
                                onClick={handleNext}
                                className="px-5 py-2 rounded-xl bg-bg border border-border text-carbon-500 font-semibold text-xs hover:bg-lavender-100 hover:text-carbon-900 transition-colors cursor-pointer"
                            >
                                <span>Skip to Next →</span>
                            </button>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
