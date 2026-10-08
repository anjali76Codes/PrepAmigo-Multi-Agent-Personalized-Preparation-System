import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { submitAssessmentAttempt, type Assessment } from "../../mocks/assessment.mock";
import { Panel } from "./shared";
import { RunnerHeader } from "./RunnerHead";
import { QuestionCard } from "./QuestionCard";
import { Result } from "./Result";

export function QuizRunner({ quiz, onExit }: { quiz: Assessment; onExit: () => void }) {
    const [idx, setIdx] = useState(0);
    const [answers, setAnswers] = useState<(string | null)[]>([]);
    const [done, setDone] = useState(false);

    const total = quiz.questions.length;
    const qn = quiz.questions[idx];
    const picked = answers[idx] ?? null;
    const isLast = idx + 1 >= total;

    const restart = () => { setIdx(0); setAnswers([]); setDone(false); };

    const pick = (letter: string) => {
        if (picked) return;
        setAnswers((a) => { const copy = [...a]; copy[idx] = letter; return copy; });
    };

    const next = () => {
        if (!isLast) return setIdx(idx + 1);
        setDone(true);
        submitAssessmentAttempt(quiz._id, quiz.questions.map((_: unknown, i: number) => answers[i] ?? null));
    };

    if (done) {
        const score = quiz.questions.filter((q, i) => answers[i] === q.correct_answer).length;
        return (
            <div className="py-6">
                <Result
                    title={`You scored ${score} / ${total}`}
                    sub={score === total
                        ? "Outstanding performance! All concepts mastered."
                        : "Review the explanations and take another round to strengthen your baseline."}
                    onAgain={restart}
                    onExit={onExit}
                />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6 py-2">
            <RunnerHeader
                backLabel="Exit quiz"
                onBack={onExit}
                label={`Question ${idx + 1} of ${total}`}
                value={idx + (picked ? 1 : 0)}
                total={total}
            />
            <AnimatePresence mode="wait">
                <Panel key={idx}>
                    <QuestionCard
                        question={qn}
                        picked={picked}
                        onPick={pick}
                        onNext={next}
                        nextLabel={isLast ? "View summary" : "Next question"}
                    />
                </Panel>
            </AnimatePresence>
        </div>
    );
}