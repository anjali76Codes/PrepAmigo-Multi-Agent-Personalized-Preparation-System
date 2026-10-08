import type { ReactNode } from "react";
import { Mascot } from "../ui/Mascot";
import { Icon } from "../ui/Icon";

interface Props {
    tab: "flashcards" | "quizzes";
    total: number;
    completed: number;
    items: number;
}

const COPY = {
    flashcards: {
        icon: "albums",
        mascot: "Thinking.png",
        kicker: "Flashcard review",
        title: "Master your concepts",
        text: "Review important concepts from your preparation roadmap.",
        unit: "Decks",
    },
    quizzes: {
        icon: "help-circle",
        mascot: "Motivated.png",
        kicker: "Knowledge check",
        title: "See how much you know",
        text: "Practice questions based on the topics you're preparing for.",
        unit: "Quizzes",
    },
};

function Stat({ value, label, className = "min-w-[82px]", children }: { value?: ReactNode; label: string; className?: string; children?: ReactNode }) {
    return (
        <div className={`bg-bg border border-border/70 rounded-2xl px-4 py-2.5 ${className}`}>
            {children ?? <div className="text-lg font-extrabold text-carbon-900 leading-none">{value}</div>}
            <div className="text-[11px] font-semibold text-carbon-500 mt-1">{label}</div>
        </div>
    );
}

export function Hero({ tab, total, completed, items }: Props) {
    const c = COPY[tab];
    const percent = total ? Math.round((completed / total) * 100) : 0;

    return (
        <div className="relative overflow-hidden bg-surface border border-border/70 rounded-3xl p-5 sm:p-6 shadow-card mb-6">
            <div className="absolute -right-12 -top-16 w-40 h-40 rounded-full bg-beige-100/50 blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-lavender-100 border border-border/70 flex items-center justify-center shrink-0 overflow-hidden">
                        <Mascot variant={c.mascot} size="md" style={{ width: 68, height: 68 }} />
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Icon name={c.icon} className="text-beige-500" />
                            <span className="text-xs font-semibold text-cocoa">{c.kicker}</span>
                        </div>
                        <h2 className="text-lg sm:text-xl font-extrabold text-carbon-900 tracking-tight">{c.title}</h2>
                        <p className="text-xs sm:text-sm text-carbon-500 mt-1 max-w-md">{c.text}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <Stat value={total} label={c.unit} />
                    <Stat value={`${completed}/${total}`} label="Completed" />
                    <Stat value={items} label={tab === "flashcards" ? "Cards" : "Questions"} />
                    <Stat label="Progress" className="min-w-[120px]">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-extrabold text-chrome">{percent}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-border/60 overflow-hidden">
                            <div
                                className="h-full bg-chrome rounded-full transition-all duration-500"
                                style={{ width: `${percent}%` }}
                            />
                        </div>
                    </Stat>
                </div>
            </div>
        </div>
    );
}