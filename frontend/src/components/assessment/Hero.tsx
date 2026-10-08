import { Mascot } from "../ui/Mascot";

interface Props {
    tab: "flashcards" | "quizzes";
    total: number;      // number of quizzes or decks
    completed: number;  // how many have is_completed === true
    items: number;      // total questions or cards across all sets
}

export function Hero({ tab, total, completed, items }: Props) {
    const flashcards = tab === "flashcards";
    const percent = total ? Math.round((completed / total) * 100) : 0;

    const stats = [
        { label: flashcards ? "Decks" : "Quizzes", value: total },
        { label: "Completed", value: `${completed}/${total}` },
        { label: flashcards ? "Flashcards" : "Questions", value: items },
    ];

    return (
        <div className="bg-white border border-border/80 rounded-2xl p-5 sm:p-6 mb-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
            <div className="flex items-center gap-5">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-lavender-100 flex items-center justify-center shrink-0 border border-chrome/10 overflow-hidden">
                    <Mascot variant={flashcards ? "Thinking.png" : "Motivated.png"} size="md" style={{ width: 64, height: 64 }} />
                </div>
                <div>
                    <h2 className="text-lg sm:text-xl font-extrabold text-carbon-900 tracking-tight">
                        {flashcards ? "Master Concepts with Flashcards" : "Test Your Knowledge"}
                    </h2>
                    <p className="text-xs sm:text-sm text-carbon-600 mt-0.5 max-w-md">
                        {flashcards ? "Spaced-repetition cards tailored to your sprint topics." : "Interactive scenario-based quizzes generated from your syllabus."}
                    </p>
                </div>
            </div>

            <div className="w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shrink-0">
                <div className="flex items-center gap-2.5">
                    {stats.map((s) => (
                        <div key={s.label} className="bg-bg border border-border/70 rounded-xl px-3.5 py-2 text-center min-w-[76px]">
                            <div className="text-base font-extrabold text-carbon-900 leading-tight">{s.value}</div>
                            <div className="text-[10px] font-bold text-carbon-500 uppercase tracking-wider mt-0.5">{s.label}</div>
                        </div>
                    ))}
                </div>

                <div className="bg-bg border border-border/70 rounded-xl px-4 py-2 flex flex-col justify-center min-w-[120px]">
                    <div className="flex justify-between items-center text-xs font-bold text-carbon-700 mb-1">
                        <span className="text-[10px] uppercase tracking-wider text-carbon-500">Progress</span>
                        <span>{percent}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-border/60 overflow-hidden">
                        <div
                            className="h-full bg-chrome rounded-full transition-all duration-500"
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}