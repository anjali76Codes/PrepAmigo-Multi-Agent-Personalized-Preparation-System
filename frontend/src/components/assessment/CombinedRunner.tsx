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
            <div className="flex items-center gap-2">
                <Badge>{qn.difficulty}</Badge>
                <span className="px-3 py-1 rounded-full bg-chrome/10 border border-chrome/20 text-xs font-bold text-chrome">Quiz</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-carbon-900 leading-snug">{qn.question}</h2>
            <div className="space-y-3">
                {qn.options.map((opt: string, i: number) => {
                    const letter = LETTERS[i];
                    const isCorrect = letter === qn.correct_answer;
                    const isPicked = letter === picked;
                    return (
                        <motion.button key={letter} whileHover={!checked ? { x: 4 } : undefined} whileTap={!checked ? { scale: 0.99 } : undefined}
                            onClick={() => onPick(letter)} disabled={checked}
                            className={cn("w-full flex items-center gap-4 text-left px-5 py-4 rounded-xl border-2 transition-colors",
                                !checked && "border-border hover:border-chrome hover:bg-lavender-100",
                                checked && isCorrect && "border-chrome bg-lavender-100",
                                checked && isPicked && !isCorrect && "border-danger-600 bg-danger-100",
                                checked && !isCorrect && !isPicked && "border-border opacity-50")}>
                            <span className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0",
                                checked && isCorrect ? "bg-chrome text-on-chrome" : checked && isPicked ? "bg-danger-600 text-white" : "bg-lavender-100 text-chrome")}>
                                {checked && isCorrect ? <Icon name="checkmark" /> : checked && isPicked ? <Icon name="close" /> : letter}
                            </span>
                            <span className="text-carbon-900 font-medium text-base md:text-lg">{opt}</span>
                        </motion.button>
                    );
                })}
            </div>
            <AnimatePresence>
                {checked && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
                        <div className="bg-lavender-100 border border-border rounded-xl p-5">
                            <div className="text-sm font-bold text-chrome mb-1">
                                {picked === qn.correct_answer ? "Correct!" : `Not quite. The answer is ${qn.correct_answer}.`}
                            </div>
                            <p className="text-base text-carbon-700 leading-relaxed">{qn.explanation}</p>
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
            <div className="flex items-center gap-2">
                <Badge>{card.category}</Badge>
                <span className="px-3 py-1 rounded-full bg-lavender-100 border border-chrome/20 text-xs font-bold text-chrome">Flashcard</span>
            </div>
            <div style={{ perspective: 1400 }}>
                <motion.div onClick={onFlip} animate={{ rotateX: flipped ? 180 : 0 }} transition={{ duration: 0.6, ease: "easeInOut" }}
                    style={{ transformStyle: "preserve-3d" }} className="relative h-64 md:h-72 cursor-pointer">
                    <div style={face} className="absolute inset-0 bg-surface border border-border rounded-3xl shadow-card p-8 flex flex-col items-center justify-center text-center gap-4">
                        <p className="text-xl md:text-2xl font-bold text-carbon-900 leading-snug">{card.front}</p>
                        <span className="text-sm font-semibold text-navy-300 flex items-center gap-1"><Icon name="refresh" /> Tap to reveal</span>
                    </div>
                    <div style={{ ...face, transform: "rotateX(180deg)" }} className="absolute inset-0 bg-chrome text-on-chrome rounded-3xl shadow-card p-8 flex flex-col items-center justify-center text-center gap-4">
                        <span className="text-xs font-bold uppercase tracking-wider text-on-chrome-muted">Answer</span>
                        <p className="text-lg md:text-xl font-medium leading-relaxed">{card.back}</p>
                        <div className="flex flex-wrap justify-center gap-1.5">
                            {card.tags.map((t: string) => <span key={t} className="px-2.5 py-0.5 rounded-full bg-chrome-hover border border-chrome-border text-xs">{t}</span>)}
                        </div>
                    </div>
                </motion.div>
            </div>
            <AnimatePresence mode="wait">
                {flipped && (
                    <motion.div key="rate" {...fade} className="flex items-center justify-center gap-3 pt-2">
                        <span className="text-sm text-navy-300 font-semibold">How well did you know it?</span>
                        {RATINGS.map((r) => (
                            <button key={r.label} onClick={() => onRate(r.value)}
                                className="px-5 py-2.5 rounded-xl bg-lavender-100 border border-border text-chrome font-bold text-sm hover:bg-chrome hover:text-on-chrome transition-colors">
                                {r.label}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function CompletionOverlay({ onBack }: { onBack: () => void }) {
    return (
        <motion.div {...fade} className="bg-lavender-100 border border-border rounded-3xl p-12 text-center space-y-5 shadow-xs">
            <Mascot variant="Celebration.png" size="xl" style={{ width: 160, height: 160, margin: "0 auto" }} />
            <h2 className="text-3xl font-extrabold text-carbon-900">Assessment Level Complete!</h2>
            <p className="text-carbon-500 text-lg">You have reviewed all questions and flashcards for this level.</p>
            <div className="flex justify-center gap-3 pt-2">
                <button onClick={onBack} className="px-8 py-3 rounded-xl bg-chrome text-on-chrome font-bold text-sm hover:bg-chrome-hover transition-colors">
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
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <Back onClick={onExit} label="All assessments" />
                <span className="text-sm font-bold text-navy-300">
                    {pos + 1} / {total}
                    {visitedCount < total && <span className="ml-2 text-xs text-carbon-400">({visitedCount}/{total} visited)</span>}
                </span>
            </div>
            <ProgressBar value={visitedCount} total={total} />

            <AnimatePresence mode="wait">
                <motion.div key={pos} {...fade} className="bg-surface border border-border rounded-3xl p-8 md:p-10 shadow-xs space-y-4">
                    {item.kind === "quiz" ? (
                        <QuizCard item={item as QuizItem} picked={pickedLetter} onPick={handlePickQuiz} />
                    ) : (
                        <FlashCard item={item as CardItem} flipped={cardFlipped} onFlip={() => setCardFlipped((f) => !f)} onRate={handleRate} />
                    )}

                    {item.kind === "quiz" && pickedLetter !== null && (
                        <div className="flex justify-end pt-2">
                            <button onClick={handleNext} className="px-6 py-3 rounded-xl bg-chrome text-on-chrome font-bold text-sm hover:bg-chrome-hover transition-colors">
                                {pos + 1 >= total ? "Finish" : "Next →"}
                            </button>
                        </div>
                    )}

                    {item.kind === "card" && !cardFlipped && (
                        <div className="flex justify-end pt-2">
                            <button onClick={handleNext} className="px-6 py-3 rounded-xl bg-surface border border-border text-carbon-500 font-bold text-sm hover:bg-lavender-100 transition-colors">
                                {pos + 1 >= total ? "Finish" : "Skip →"}
                            </button>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
