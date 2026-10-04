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
        { label: flashcards ? "Quizzes" : "Decks", value: total },
        { label: "Completed", value: `${completed}/${total}` },
        { label: flashcards ? "Questions" : "Cards", value: items },
    ];

    return (
        <div className="flex flex-col md:flex-row items-center gap-6 bg-chrome-accent border border-border rounded-3xl p-6 md:p-8 mb-8 shadow-xs">
            <Mascot variant={flashcards ? "Thinking.png" : "Motivated.png"} size="xl" style={{ width: 200, height: 200 }} />

            <div className="flex-1 w-full">
                <h2 className="text-2xl md:text-3xl font-extrabold text-carbon-900">
                    {flashcards ? "Make it stick" : "Test what you know"}
                </h2>
                <p className="text-carbon-700 mt-1 md:text-lg">
                    {flashcards ? "Flip through cards and rate how well you knew them." : "Quick quizzes from each day of your sprints."}
                </p>

                <div className="grid grid-cols-3 gap-3 mt-5">
                    {stats.map((s) => (
                        <div key={s.label} className="bg-surface/70 border border-border rounded-2xl px-4 py-3">
                            <div className="text-2xl font-extrabold text-carbon-900 leading-none">{s.value}</div>
                            <div className="text-xs font-bold text-navy-500 mt-1">{s.label}</div>
                        </div>
                    ))}
                </div>

                <div className="mt-4">
                    <div className="flex justify-between text-xs font-bold text-carbon-700 mb-1.5">
                        <span>Overall progress</span>
                        <span>{percent}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-surface/70 overflow-hidden">
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