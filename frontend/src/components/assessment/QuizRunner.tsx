import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "../ui/Icon";
import { cn } from "../../utils/utils";
import { submitAssessmentAttempt, type Assessment } from "../../mocks/assessment.mock";
import { Back, Badge, ProgressBar, fade } from "./shared";
import { Result } from "./Result";

const LETTERS = ["A", "B", "C", "D"];

export function QuizRunner({ quiz, onExit }: { quiz: Assessment; onExit: () => void }) {
    const [idx, setIdx] = useState(0);
    const [picked, setPicked] = useState<string | null>(null);
    const [results, setResults] = useState<boolean[]>([]);
    const [answers, setAnswers] = useState<(string | null)[]>([]);
    const [done, setDone] = useState(false);

    const total = quiz.questions.length;
    const qn = quiz.questions[idx];
    const checked = picked !== null;

    const restart = () => { setIdx(0); setPicked(null); setResults([]); setAnswers([]); setDone(false); };
    const next = () => {
        if (idx + 1 >= total) {
            setDone(true);
            submitAssessmentAttempt(quiz._id, quiz.questions.map((_: unknown, i: number) => answers[i] ?? null));
        } else {
            setIdx(idx + 1);
            setPicked(null);
        }
    };
    const pick = (letter: string) => {
        if (checked) return;
        setPicked(letter);
        setResults((r) => [...r, letter === qn.correct_answer]);
        setAnswers((a) => { const copy = [...a]; copy[idx] = letter; return copy; });
    };

    if (done) {
        const score = results.filter(Boolean).length;
        return (
            <div className="max-w-2xl mx-auto py-6">
                <Result
                    title={`You scored ${score} / ${total}`}
                    sub={score === total ? "Outstanding performance! All concepts mastered." : "Review the explanations and take another round to strengthen your baseline."}
                    onAgain={restart}
                    onExit={onExit}
                />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6 py-2">
            {/* Top Navigation & Status Bar */}
            <div className="flex items-center justify-between pb-1">
                <Back onClick={onExit} label="Exit Quiz" />
                <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-white border border-border text-carbon-700 shadow-xs">
                        Question <strong className="text-carbon-900">{idx + 1}</strong> of {total}
                    </span>
                    <span className="text-xs font-bold text-cocoa uppercase tracking-wider">
                        {Math.round(((idx + (checked ? 1 : 0)) / total) * 100)}%
                    </span>
                </div>
            </div>

            <ProgressBar value={idx + (checked ? 1 : 0)} total={total} />

            <AnimatePresence mode="wait">
                <motion.div
                    key={idx}
                    {...fade}
                    className="bg-white border border-border/80 rounded-2xl p-6 sm:p-8 shadow-card space-y-6"
                >
                    {/* Header Info */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-4">
                        <div className="flex items-center gap-2">
                            <Badge>{qn.difficulty}</Badge>
                            {qn.concept && (
                                <span className="text-xs font-medium text-carbon-500 bg-bg px-2.5 py-1 rounded-full border border-border/60">
                                    {qn.concept}
                                </span>
                            )}
                        </div>
                        <span className="text-xs font-medium text-carbon-400">Single Choice</span>
                    </div>

                    {/* Question Title */}
                    <h2 className="text-lg sm:text-xl font-bold text-carbon-900 leading-relaxed tracking-tight">
                        {qn.question}
                    </h2>

                    {/* Options List */}
                    <div className="space-y-2.5 pt-1">
                        {qn.options.map((opt: string, i: number) => {
                            const letter = LETTERS[i];
                            const isCorrect = letter === qn.correct_answer;
                            const isPicked = letter === picked;

                            let optionStateClasses = "border-border/70 hover:border-chrome/40 hover:bg-lavender-50/50 bg-white text-carbon-800";
                            let badgeClasses = "bg-bg text-carbon-600 border border-border/60 group-hover:border-chrome/40";

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
                                    onClick={() => pick(letter)}
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

                    {/* Feedback Explanation Drawer */}
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

                                <div className="flex justify-end pt-5">
                                    <button
                                        onClick={next}
                                        className="px-6 py-2.5 rounded-xl bg-chrome text-on-chrome font-bold text-sm hover:bg-chrome-hover shadow-xs hover:shadow-pop transition-all flex items-center gap-2 cursor-pointer"
                                    >
                                        <span>{idx + 1 >= total ? "View Summary" : "Next Question"}</span>
                                        <Icon name="arrow-forward" className="text-sm" />
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
