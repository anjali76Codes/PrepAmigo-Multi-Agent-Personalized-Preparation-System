import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "../ui/Icon";
import { cn } from "../../utils/utils";
import type { Assessment } from "../../mocks/assessment.mock";
import { Back, Badge, ProgressBar, fade } from "./shared";
import { Result } from "./Result";

const LETTERS = ["A", "B", "C", "D"];

export function QuizRunner({ quiz, onExit }: { quiz: Assessment; onExit: () => void }) {
    const [idx, setIdx] = useState(0);
    const [picked, setPicked] = useState<string | null>(null);
    const [results, setResults] = useState<boolean[]>([]);
    const [done, setDone] = useState(false);

    const total = quiz.questions.length;
    const qn = quiz.questions[idx];
    const checked = picked !== null;

    const restart = () => { setIdx(0); setPicked(null); setResults([]); setDone(false); };
    const next = () => {
        if (idx + 1 >= total) setDone(true);
        else { setIdx(idx + 1); setPicked(null); }
    };
    const pick = (letter: string) => {
        if (checked) return;
        setPicked(letter);
        setResults((r) => [...r, letter === qn.correct_answer]);
    };

    if (done) {
        const score = results.filter(Boolean).length;
        return (
            <Result
                title={`You scored ${score} / ${total}`}
                sub={score === total ? "Perfect round. Nice work!" : "Review the explanations and give it another go."}
                onAgain={restart}
                onExit={onExit}
            />
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <Back onClick={onExit} label="All quizzes" />
                <span className="text-sm font-bold text-navy-300">Question {idx + 1} of {total}</span>
            </div>
            <ProgressBar value={idx + (checked ? 1 : 0)} total={total} />

            <AnimatePresence mode="wait">
                <motion.div key={idx} {...fade} className="bg-surface border border-border rounded-3xl p-8 md:p-10 shadow-xs space-y-7">
                    <div className="space-y-3">
                        <Badge>{qn.difficulty}</Badge>
                        <h2 className="text-xl md:text-2xl font-bold text-carbon-900 leading-snug">{qn.question}</h2>
                    </div>

                    <div className="space-y-3">
                        {qn.options.map((opt: string, i: number) => {
                            const letter = LETTERS[i];
                            const isCorrect = letter === qn.correct_answer;
                            const isPicked = letter === picked;
                            return (
                                <motion.button
                                    key={letter}
                                    whileHover={!checked ? { x: 4 } : undefined}
                                    whileTap={!checked ? { scale: 0.99 } : undefined}
                                    onClick={() => pick(letter)}
                                    disabled={checked}
                                    className={cn(
                                        "w-full flex items-center gap-4 text-left px-5 py-4 rounded-xl border-2 transition-colors",
                                        !checked && "border-border hover:border-chrome hover:bg-lavender-100",
                                        checked && isCorrect && "border-chrome bg-lavender-100",
                                        checked && isPicked && !isCorrect && "border-danger-600 bg-danger-100",
                                        checked && !isCorrect && !isPicked && "border-border opacity-50"
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0",
                                            checked && isCorrect ? "bg-chrome text-on-chrome"
                                                : checked && isPicked ? "bg-danger-600 text-white"
                                                    : "bg-lavender-100 text-chrome"
                                        )}
                                    >
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
                                <div className="bg-lavender-100 border border-border rounded-xl p-5 space-y-1">
                                    <div className="text-sm font-bold text-chrome">
                                        {picked === qn.correct_answer ? "Correct" : `Not quite. The answer is ${qn.correct_answer}.`}
                                    </div>
                                    <p className="text-base text-carbon-700 leading-relaxed">{qn.explanation}</p>
                                </div>
                                <div className="flex justify-end pt-4">
                                    <button onClick={next} className="px-6 py-3 rounded-xl bg-chrome text-on-chrome font-bold text-sm hover:bg-chrome-hover transition-colors">
                                        {idx + 1 >= total ? "Finish" : "Next question"}
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