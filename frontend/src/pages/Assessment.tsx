import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "../components/ui/Icon";
import { Mascot } from "../components/ui/Mascot";
import { cn } from "../utils/utils";
import {
    getAssessments, getFlashcardDecks,
    type Assessment as AssessmentSet, type FlashcardDeck,
} from "../mocks/assessment.mock";
import { fade } from "../components/assessment/shared";
import { Hero } from "../components/assessment/Hero";
import { SetCard } from "../components/assessment/SetCard";
import { QuizRunner } from "../components/assessment/QuizRunner";
import { DeckRunner } from "../components/assessment/DeckRunner";

type Tab = "quizzes" | "flashcards";

const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "quizzes", label: "Quizzes", icon: "help-circle" },
    { id: "flashcards", label: "Flashcards", icon: "albums" },
];

export function Assessment() {
    const [params, setParams] = useSearchParams();
    const tab: Tab = params.get("tab") === "flashcards" ? "flashcards" : "quizzes";

    const [quizzes, setQuizzes] = useState<AssessmentSet[] | null>(null);
    const [decks, setDecks] = useState<FlashcardDeck[] | null>(null);
    const [activeQuiz, setActiveQuiz] = useState<AssessmentSet | null>(null);
    const [activeDeck, setActiveDeck] = useState<FlashcardDeck | null>(null);

    useEffect(() => {
        getAssessments().then(setQuizzes);
        getFlashcardDecks().then(setDecks);
    }, []);

    const switchTab = (t: Tab) => {
        setActiveQuiz(null);
        setActiveDeck(null);
        setParams(t === "quizzes" ? {} : { tab: t });
    };

    const loading = tab === "quizzes" ? !quizzes : !decks;

    return (
        <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
            <header className="bg-white border-b border-border px-4 md:px-8 pt-5 shrink-0">
                <h1 className="text-xl md:text-2xl font-extrabold text-carbon-900 tracking-tight mb-4">Assessment</h1>
                <div className="flex gap-6">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => switchTab(t.id)}
                            className={cn(
                                "relative pb-3 flex items-center gap-2 text-sm font-bold transition-colors",
                                tab === t.id ? "text-chrome" : "text-navy-300 hover:text-carbon-900"
                            )}
                        >
                            <Icon name={t.icon} /> {t.label}
                            {tab === t.id && (
                                <motion.div layoutId="assessment-tab" className="absolute left-0 right-0 -bottom-px h-0.5 bg-chrome rounded-full" />
                            )}
                        </button>
                    ))}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 safe-area-bottom">
                <div className="max-w-6xl mx-auto pb-16">
                    {loading ? (
                        <div className="flex flex-col items-center py-20 gap-3">
                            <Mascot variant="working.gif" size="lg" />
                            <p className="text-sm font-semibold text-navy-300">Loading…</p>
                        </div>
                    ) : (
                        <AnimatePresence mode="wait">
                            <motion.div key={tab + (activeQuiz?._id ?? activeDeck?._id ?? "")} {...fade}>
                                {tab === "quizzes" ? (
                                    activeQuiz ? (
                                        <QuizRunner quiz={activeQuiz} onExit={() => setActiveQuiz(null)} />
                                    ) : (
                                        <>
                                            <Hero
                                                tab="quizzes"
                                                total={quizzes!.length}
                                                completed={quizzes!.filter((q) => q.is_completed).length}
                                                items={quizzes!.reduce((n, q) => n + q.questions.length, 0)}
                                            />
                                            <div className="grid sm:grid-cols-2 gap-6">
                                                {quizzes!.map((a, i) => (
                                                    <SetCard
                                                        key={a._id}
                                                        index={i}
                                                        icon="help-circle"
                                                        title={`Quiz Set ${i + 1}`}
                                                        meta={`${a.questions.length} questions`}
                                                        badge={a.is_completed ? "Completed" : "Not started"}
                                                        onClick={() => setActiveQuiz(a)}
                                                    />
                                                ))}
                                            </div>
                                        </>
                                    )
                                ) : activeDeck ? (
                                    <DeckRunner deck={activeDeck} onExit={() => setActiveDeck(null)} />
                                ) : (
                                    <>
                                        <Hero
                                            tab="flashcards"
                                            total={decks!.length}
                                            completed={decks!.filter((d) => d.is_completed).length}
                                            items={decks!.reduce((n, d) => n + d.cards.length, 0)}
                                        />                                        <div className="grid sm:grid-cols-2 gap-6">
                                            {decks!.map((d, i) => (
                                                <SetCard
                                                    key={d._id}
                                                    index={i}
                                                    icon="albums"
                                                    title={`Flashcard Deck ${i + 1}`}
                                                    meta={`${d.cards.length} cards · ${d.reviewed_count} reviewed`}
                                                    badge={d.is_completed ? "Completed" : "New"}
                                                    onClick={() => setActiveDeck(d)}
                                                />
                                            ))}
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    )}
                </div>
            </div>
        </div>
    );
}