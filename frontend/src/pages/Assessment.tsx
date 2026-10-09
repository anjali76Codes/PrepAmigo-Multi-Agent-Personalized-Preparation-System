import { useEffect, useState, useCallback, useMemo } from "react";
import { useLocation, useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "../components/ui/Icon";
import { Mascot } from "../components/ui/Mascot";
import { cn } from "../utils/utils";
import {
    getAssessments, getFlashcardDecks, openSprintDayAssessment,
    type Assessment as AssessmentSet, type FlashcardDeck,
} from "../mocks/assessment.mock";
import { Button, fade } from "../components/assessment/shared";
import { Hero } from "../components/assessment/Hero";
import { SetCard } from "../components/assessment/SetCard";
import { SprintBanner } from "../components/assessment/SprintBanner";
import { QuizRunner } from "../components/assessment/QuizRunner";
import { DeckRunner } from "../components/assessment/DeckRunner";
import { CombinedRunner } from "../components/assessment/CombinedRunner";
import { findMatchingDeck, groupBySprint, type SprintGroup } from "../components/assessment/Groupassessments"
import { useAppContext } from "../context/AppContext";

type Tab = "quizzes" | "flashcards";
type RunMode = "standalone-quiz" | "standalone-deck" | "combined";

const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "quizzes", label: "Quizzes", icon: "help-circle" },
    { id: "flashcards", label: "Flashcards", icon: "albums" },
];

const GRID = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4";

/* ───────────── list views ───────────── */

function QuizList({ quizzes, groups, onOpen }: {
    quizzes: AssessmentSet[];
    groups: SprintGroup[];
    onOpen: (a: AssessmentSet) => void;
}) {
    return (
        <>
            <Hero
                tab="quizzes"
                total={quizzes.length}
                completed={quizzes.filter((q) => q.is_completed).length}
                items={quizzes.reduce((n, q) => n + q.questions.length, 0)}
            />
            {groups.map((sprint) => (
                <section key={sprint.label} className="mt-8 space-y-5">
                    <div className="flex items-center gap-2.5 border-b border-border/60 pb-2">
                        <Icon name="ribbon-outline" className="text-chrome text-lg" />
                        <h2 className="text-base sm:text-lg font-extrabold text-carbon-900 tracking-tight">{sprint.label}</h2>
                    </div>
                    {sprint.levels.map((level) => (
                        <div key={level.label} className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-carbon-500">{level.label}</h3>
                                <span className="text-xs font-semibold text-rosewood">
                                    {level.items.length} {level.items.length === 1 ? "assessment" : "assessments"}
                                </span>
                            </div>
                            <div className={GRID}>
                                {level.items.map(({ assessment: a, locked }, i) => (
                                    <SetCard
                                        key={a._id}
                                        index={i}
                                        locked={locked}
                                        icon={locked ? "lock-closed-outline" : "help-circle"}
                                        title={level.label}
                                        meta={locked
                                            ? "Complete earlier levels first"
                                            : `${a.questions.length} questions · ~${Math.max(3, Math.round(a.questions.length * 1.5))} mins`}
                                        badge={a.is_completed ? "Completed" : locked ? "Locked" : "Not started"}
                                        score={a.score}
                                        onClick={() => onOpen(a)}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </section>
            ))}
        </>
    );
}

function DeckList({ decks, onOpen }: { decks: FlashcardDeck[]; onOpen: (d: FlashcardDeck) => void }) {
    return (
        <>
            <Hero
                tab="flashcards"
                total={decks.length}
                completed={decks.filter((d) => d.is_completed).length}
                items={decks.reduce((n, d) => n + d.cards.length, 0)}
            />
            <div className={cn(GRID, "mt-4")}>
                {decks.map((d, i) => (
                    <SetCard
                        key={d._id}
                        index={i}
                        icon="albums"
                        title={`Flashcard deck ${i + 1}`}
                        meta={`${d.cards.length} cards · ${d.reviewed_count} reviewed`}
                        badge={d.is_completed ? "Completed" : "New"}
                        onClick={() => onOpen(d)}
                    />
                ))}
            </div>
        </>
    );
}

/* ───────────── status screens ───────────── */

function ErrorState({ message, onBack }: { message: string; onBack: () => void }) {
    return (
        <div className="flex flex-col items-center py-16 text-center max-w-md mx-auto space-y-4">
            <Mascot variant="dissapointed.png" size="lg" />
            <h3 className="text-xl font-bold text-carbon-900">Could not generate assessment</h3>
            <p className="text-sm text-carbon-500">{message}</p>
            <Button onClick={onBack}>Back to dashboard</Button>
        </div>
    );
}

function LoadingState({ generating }: { generating: boolean }) {
    return (
        <div className="flex flex-col items-center py-20 gap-4 text-center max-w-sm mx-auto">
            <Mascot variant="working.gif" size="xl" style={{ width: 140, height: 140 }} />
            <div>
                <h3 className="text-lg font-extrabold text-carbon-900">
                    {generating ? "Generating your assessment..." : "Loading assessment..."}
                </h3>
                <p className="text-xs text-carbon-500 mt-1">
                    {generating
                        ? "Creating tailored multiple-choice questions and flashcard review cards for this sprint level."
                        : "Preparing your study material..."}
                </p>
            </div>
        </div>
    );
}

export function Assessment() {
    const [params, setParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { refreshPreps } = useAppContext();

    const tab: Tab = params.get("tab") === "flashcards" ? "flashcards" : "quizzes";
    const requestedAssessmentId = params.get("assessmentId");
    const requestedDayId = params.get("sprintDayId");
    const fromLevel = Boolean(params.get("sprintId")) || Boolean(requestedDayId);

    const [quizzes, setQuizzes] = useState<AssessmentSet[] | null>(null);
    const [decks, setDecks] = useState<FlashcardDeck[] | null>(null);
    const [activeQuiz, setActiveQuiz] = useState<AssessmentSet | null>(null);
    const [activeDeck, setActiveDeck] = useState<FlashcardDeck | null>(null);
    const [runMode, setRunMode] = useState<RunMode>("standalone-quiz");
    const [generating, setGenerating] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);

    const refresh = useCallback(() => {
        getAssessments().then(setQuizzes);
        getFlashcardDecks().then(setDecks);
    }, []);

    const openQuiz = useCallback((a: AssessmentSet) => {
        setActiveQuiz(a);
        setRunMode(fromLevel ? "combined" : "standalone-quiz");
    }, [fromLevel]);

    const handleExit = useCallback(() => {
        if (fromLevel) return navigate("/dashboard");
        setActiveQuiz(null);
        setActiveDeck(null);
    }, [fromLevel, navigate]);

    const handleLevelComplete = useCallback(async () => {
        try { await refreshPreps(); } catch (e) { console.error(e); }
        navigate("/dashboard");
    }, [navigate, refreshPreps]);

    const switchTab = (t: Tab) => {
        setActiveQuiz(null);
        setActiveDeck(null);
        setParams(t === "quizzes" ? {} : { tab: t });
    };

    useEffect(() => { refresh(); }, [refresh]);

    // opened with a sprintDayId: load or generate that day's assessment
    useEffect(() => {
        if (!requestedDayId || activeQuiz) return;
        setGenerating(true);
        setGenerationError(null);
        openSprintDayAssessment(requestedDayId)
            .then((assessment: AssessmentSet) => { openQuiz(assessment); refresh(); })
            .catch((err: unknown) => setGenerationError(err instanceof Error ? err.message : "Failed to load assessment."))
            .finally(() => setGenerating(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requestedDayId]);

    // arrived from the dashboard with the assessment already in router state
    useEffect(() => {
        const fromState = (location.state as { assessment?: AssessmentSet } | null)?.assessment;
        if (fromState && !activeQuiz) openQuiz(fromState);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state, fromLevel]);

    // opened with ?assessmentId=
    useEffect(() => {
        if (!requestedAssessmentId || !quizzes || activeQuiz) return;
        const selected = quizzes.find((q) => q._id === requestedAssessmentId);
        if (selected) openQuiz(selected);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quizzes, requestedAssessmentId, fromLevel]);

    const groups = useMemo(() => groupBySprint(quizzes ?? []), [quizzes]);
    const matchedDeck = activeQuiz && decks ? findMatchingDeck(activeQuiz, decks) : null;
    const showCombined = runMode === "combined" && activeQuiz !== null;
    const loading = generating || (tab === "quizzes" ? !quizzes : !decks);

    const renderBody = () => {
        if (showCombined) {
            return (
                <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-8">
                    <SprintBanner
                        assessment={activeQuiz!}
                        note="Quiz + flashcards"
                    />

                    <main className="flex-1 min-w-0 flex justify-center w-full">
                        <CombinedRunner
                            quiz={activeQuiz!}
                            deck={matchedDeck}
                            onExit={handleExit}
                            onLevelComplete={handleLevelComplete}
                        />
                    </main>
                </div>
            );
        }
        if (tab === "quizzes") {
            return activeQuiz ? (
                <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-8">
                    <SprintBanner assessment={activeQuiz} />

                    <main className="flex-1 min-w-0 flex justify-center w-full">
                        <QuizRunner
                            quiz={activeQuiz}
                            onExit={handleExit}
                        />
                    </main>
                </div>
            ) : (
                <QuizList quizzes={quizzes!} groups={groups} onOpen={openQuiz} />
            );
        }
        return activeDeck ? (
            <DeckRunner deck={activeDeck} onExit={handleExit} />
        ) : (
            <DeckList
                decks={decks!}
                onOpen={(d) => { setActiveDeck(d); setRunMode("standalone-deck"); }}
            />
        );
    };

    return (
        <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
            <div className="flex-1 overflow-y-auto safe-area-bottom">
                <div className="w-full px-6 md:px-12 py-6 md:py-8 pb-16 space-y-8">
                    {/* Header */}
                    <div className="bg-lavender-100 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between shadow-pop border border-chrome-accent/50 gap-6">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-extrabold text-deep-emerald mb-2 tracking-tight">Assessment</h1>
                            <p className="text-base md:text-lg text-forest-emerald/80 font-medium">
                                Test your knowledge with quizzes and flashcards.
                            </p>
                        </div>
                        {!showCombined && (
                            <div className="flex gap-2 bg-white/60 p-1.5 rounded-2xl border border-white">
                                {TABS.map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => switchTab(t.id)}
                                        aria-pressed={tab === t.id}
                                        className={cn(
                                            "px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-colors",
                                            tab === t.id
                                                ? "bg-chrome text-on-chrome shadow-sm"
                                                : "text-cocoa hover:text-carbon-900 hover:bg-white/60"
                                        )}
                                    >
                                        <Icon name={t.icon} /> {t.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {generationError ? (
                        <ErrorState message={generationError} onBack={handleExit} />
                    ) : loading ? (
                        <LoadingState generating={generating} />
                    ) : (
                        <AnimatePresence mode="wait">
                            <motion.div key={tab + (activeQuiz?._id ?? activeDeck?._id ?? "") + runMode} {...fade}>
                                {renderBody()}
                            </motion.div>
                        </AnimatePresence>
                    )}
                </div>
            </div>
        </div>
    );
}