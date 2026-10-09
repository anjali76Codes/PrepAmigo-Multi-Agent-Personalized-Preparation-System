import { motion, AnimatePresence } from "framer-motion";
import { Mascot } from "../ui/Mascot";
import { Icon } from "../ui/Icon";
import { cn } from "../../utils/utils";
import type { Question } from "./QuestionCard";
import { Button, LETTERS } from "./shared";

export type Feedback = {
    correct: boolean;
    letter: string;
    answerText: string;
    explanation: string;
    nextLabel: string;
    onNext: () => void;
} | null;

export function buildFeedback(
    qn: Question,
    picked: string,
    nextLabel: string,
    onNext: () => void
): Feedback {
    return {
        correct: picked === qn.correct_answer,
        letter: qn.correct_answer,
        answerText: qn.options[LETTERS.indexOf(qn.correct_answer)] ?? "",
        explanation: qn.explanation,
        nextLabel,
        onNext,
    };
}

const EASE = [0.22, 1, 0.36, 1] as const;

const collapse = {
    initial: { height: 0, opacity: 0 },
    animate: { height: "auto", opacity: 1, transition: { duration: 0.4, ease: EASE } },
    exit: { height: 0, opacity: 0, transition: { duration: 0.25, ease: EASE } },
};

const mascotSwap = {
    initial: { opacity: 0, scale: 0.7 },
    animate: { opacity: 1, scale: 1, transition: { type: "spring" as const, stiffness: 320, damping: 16 } },
    exit: { opacity: 0, scale: 0.85, transition: { duration: 0.12 } },
};

export function FeedbackPanel({ feedback }: { feedback: Feedback }) {
    const key = !feedback ? "idle" : feedback.correct ? "right" : "wrong";
    const mascot =
        key === "right" ? "Celebration.png"
            : key === "wrong" ? "dissapointed.png"
                : "Motivated.png";

    return (
        <aside className="w-full shrink-0 self-start lg:sticky lg:top-6 lg:w-80">
            <div
                className={cn(
                    "overflow-hidden rounded-3xl border p-6 text-center shadow-card transition-colors duration-300",
                    key === "right" && "border-sky-500/30 bg-sky-100/70",
                    key === "wrong" && "border-danger-600/30 bg-danger-100/70",
                    key === "idle" && "border-border bg-lavender-100"
                )}
            >
                {/* Mascot: crossfades between states, card itself never remounts */}
                <div className="flex justify-center" style={{ height: 140 }}>
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div key={mascot} {...mascotSwap}>
                            <Mascot variant={mascot} size="xl" style={{ width: 140, height: 140 }} />
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Idle hint collapses away when feedback arrives */}
                <AnimatePresence initial={false}>
                    {!feedback && (
                        <motion.p
                            key="hint"
                            {...collapse}
                            className="overflow-hidden text-sm font-semibold text-carbon-500"
                        >
                            <span className="block pt-4">Pick an answer and I'll tell you how you did.</span>
                        </motion.p>
                    )}
                </AnimatePresence>

                {/* Feedback body grows downward from under the mascot */}
                <AnimatePresence initial={false}>
                    {feedback && (
                        <motion.div key="body" {...collapse} className="overflow-hidden">
                            <div className="space-y-4 pt-4">
                                <AnimatePresence mode="wait" initial={false}>
                                    <motion.div
                                        key={feedback.correct ? "right" : "wrong"}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0, transition: { duration: 0.25, delay: 0.1 } }}
                                        exit={{ opacity: 0, transition: { duration: 0.1 } }}
                                        className="space-y-4"
                                    >
                                        {feedback.correct ? (
                                            <>
                                                <div className="flex items-center justify-center gap-2 text-forest-emerald">
                                                    <Icon name="checkmark-circle" className="text-xl" />
                                                    <h3 className="text-lg font-extrabold">Correct!</h3>
                                                </div>
                                                <p className="text-left text-sm leading-relaxed text-carbon-700">
                                                    {feedback.explanation}
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex items-center justify-center gap-2 text-danger-600">
                                                    <Icon name="alert-circle" className="text-xl" />
                                                    <h3 className="text-lg font-extrabold">Not quite</h3>
                                                </div>
                                                <div className="rounded-2xl border border-danger-600/20 bg-white/60 p-3 text-left">
                                                    <p className="text-xs font-bold uppercase tracking-wide text-carbon-500">
                                                        Correct answer
                                                    </p>
                                                    <p className="mt-1 text-sm font-bold text-carbon-900">
                                                        {feedback.letter}. {feedback.answerText}
                                                    </p>
                                                </div>
                                                <p className="text-left text-sm leading-relaxed text-carbon-700">
                                                    {feedback.explanation}
                                                </p>
                                            </>
                                        )}
                                    </motion.div>
                                </AnimatePresence>

                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: 0.2 } }}
                                >
                                    <Button
                                        onClick={feedback.onNext}
                                        className="min-h-12 w-full justify-center gap-2 rounded-full px-6 text-sm font-bold"
                                    >
                                        {feedback.nextLabel}
                                        <Icon name="arrow-forward" className="text-sm" />
                                    </Button>
                                </motion.div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </aside>
    );
}