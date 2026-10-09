import { motion } from "framer-motion";
import { Icon } from "../ui/Icon";
import { cn } from "../../utils/utils";
import type { Assessment } from "../../mocks/assessment.mock";
import { CardHeader, LETTERS } from "./shared";

export type Question = Assessment["questions"][number];

interface Props {
    question: Question;
    picked: string | null;
    onPick: (letter: string) => void;
    onNext: () => void;
    nextLabel: string;
    /** small chip next to the difficulty badge */
    tag?: string;
    showInlineFeedback?: boolean;

}

type OptionState = "idle" | "correct" | "wrong" | "dim";

const OPTION_STYLES: Record<OptionState, { box: string; badge: string }> = {
    idle: {
        box: "border-border/70 bg-white text-carbon-700 hover:border-chrome/40 hover:bg-lavender-50",
        badge: "bg-bg text-carbon-500 border-border/60 group-hover:border-chrome/40",
    },
    correct: {
        box: "border-sky-500/60 bg-sky-100 text-deep-emerald shadow-xs",
        badge: "bg-sky-500 text-on-chrome border-sky-500",
    },
    wrong: {
        box: "border-danger-600/60 bg-danger-100 text-carbon-900 shadow-xs",
        badge: "bg-danger-600 text-white border-danger-600",
    },
    dim: {
        box: "border-border/40 bg-white/80 text-carbon-500 opacity-40 cursor-not-allowed",
        badge: "bg-bg text-carbon-500 border-border/40",
    },
};

export function QuestionCard({ question: qn, picked, onPick, tag,
    // onNext, nextLabel, showInlineFeedback = true 
}: Props) {
    const checked = picked !== null;
    // const isRight = picked === qn.correct_answer;

    const stateOf = (letter: string): OptionState => {
        if (!checked) return "idle";
        if (letter === qn.correct_answer) return "correct";
        if (letter === picked) return "wrong";
        return "dim";
    };

    return (
        <div className="space-y-6">
            <CardHeader badge={qn.difficulty} tag={tag ?? qn.concept} hint="Single choice" />

            <h2 className="text-lg sm:text-xl font-bold text-lavender-100">
                {qn.question}
            </h2>

            <div className="space-y-2.5">
                {qn.options.map((opt: string, i: number) => {
                    const letter = LETTERS[i];
                    const state = stateOf(letter);
                    const styles = OPTION_STYLES[state];

                    return (
                        <motion.button
                            key={letter}
                            whileHover={!checked ? { x: 3 } : undefined}
                            whileTap={!checked ? { scale: 0.995 } : undefined}
                            onClick={() => !checked && onPick(letter)}
                            disabled={checked}
                            className={cn(
                                "w-full group flex items-start gap-3.5 text-left p-3.5 sm:p-4 rounded-2xl border transition-all duration-150 cursor-pointer",
                                styles.box
                            )}
                        >
                            <span
                                className={cn(
                                    "w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition-colors",
                                    styles.badge
                                )}
                            >
                                {state === "correct" ? (
                                    <Icon name="checkmark" className="text-sm" />
                                ) : state === "wrong" ? (
                                    <Icon name="close" className="text-sm" />
                                ) : (
                                    letter
                                )}
                            </span>
                            <span className="font-medium text-sm sm:text-base pt-0.5">{opt}</span>
                        </motion.button>
                    );
                })}
            </div>

            {/* <AnimatePresence>
                {checked && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        {showInlineFeedback && (

                            <div
                                className={cn(
                                    "rounded-2xl p-4 sm:p-5 border space-y-1.5",
                                    isRight ? "bg-sky-100/70 border-sky-500/30" : "bg-danger-100/70 border-danger-600/30"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <Icon
                                        name={isRight ? "checkmark-circle" : "alert-circle"}
                                        className={cn("text-lg", isRight ? "text-sky-500" : "text-danger-600")}
                                    />
                                    <span
                                        className={cn(
                                            "text-sm font-bold",
                                            isRight ? "text-forest-emerald" : "text-danger-600"
                                        )}
                                    >
                                        {isRight ? "Correct" : `Not quite. The answer is option ${qn.correct_answer}`}
                                    </span>
                                </div>
                                <p className="text-sm text-carbon-700 leading-relaxed pl-7">{qn.explanation}</p>
                            </div>
                        )}
                        <div className="flex justify-end pt-5">
                            <Button onClick={onNext}>
                                {nextLabel}
                                <Icon name="arrow-forward" className="text-sm" />
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence> */}
        </div>
    );
}