import { useEffect, useState, useCallback } from "react";
import { useLocation, useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "../components/ui/Icon";
import { Mascot } from "../components/ui/Mascot";
import { cn } from "../utils/utils";
import {
    getAssessments, getFlashcardDecks, openSprintDayAssessment,
    type Assessment as AssessmentSet, type FlashcardDeck,
} from "../mocks/assessment.mock";
import { fade } from "../components/assessment/shared";
import { Hero } from "../components/assessment/Hero";
import { SetCard } from "../components/assessment/SetCard";
import { QuizRunner } from "../components/assessment/QuizRunner";
import { DeckRunner } from "../components/assessment/DeckRunner";
import { CombinedRunner } from "../components/assessment/CombinedRunner";
import { useAppContext } from "../context/AppContext";

type Tab = "quizzes" | "flashcards";
type RunMode = "standalone-quiz" | "standalone-deck" | "combined";

const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "quizzes", label: "Quizzes", icon: "help-circle" },
    { id: "flashcards", label: "Flashcards", icon: "albums" },
];

/** Find the flashcard deck that covers the same sprint days as a given assessment. */
function findMatchingDeck(assessment: AssessmentSet, decks: FlashcardDeck[]): FlashcardDeck | null {
    if (!assessment.covered_sprint_days?.length) return null;
    const assessmentDaySet = new Set(assessment.covered_sprint_days.map(String));
    return (
        decks.find((d) => d.covered_sprint_days?.some((id) => assessmentDaySet.has(String(id)))) ?? null
    );
}

export function Assessment() {
    const [params, setParams] = useSearchParams();
    const location = useLocation();
    const tab: Tab = params.get("tab") === "flashcards" ? "flashcards" : "quizzes";
    const requestedAssessmentId = params.get("assessmentId");
    const requestedDayId = params.get("sprintDayId");
    const fromLevel = Boolean(params.get("sprintId")) || Boolean(requestedDayId);
    const navigate = useNavigate();

    const [quizzes, setQuizzes] = useState<AssessmentSet[] | null>(null);
    const [decks, setDecks] = useState<FlashcardDeck[] | null>(null);
    const [activeQuiz, setActiveQuiz] = useState<AssessmentSet | null>(null);
    const [activeDeck, setActiveDeck] = useState<FlashcardDeck | null>(null);
    const [runMode, setRunMode] = useState<RunMode>("standalone-quiz");
    const [generating, setGenerating] = useState<boolean>(false);
    const [generationError, setGenerationError] = useState<string | null>(null);

    const { refreshPreps } = useAppContext();

    const handleExit = useCallback(() => {
        if (fromLevel) {
            navigate("/dashboard");
        } else {
            setActiveQuiz(null);
            setActiveDeck(null);
        }
    }, [fromLevel, navigate]);

    const handleLevelComplete = useCallback(async () => {
        try {
            await refreshPreps();
        } catch (e) {
            console.error(e);
        }
        navigate("/dashboard");
    }, [navigate, refreshPreps]);

    const refresh = () => {
        getAssessments().then(setQuizzes);
        getFlashcardDecks().then(setDecks);
    };

    useEffect(refresh, []);

    // If navigated with a sprintDayId, lazily load/generate the assessment with Mascot loader
    useEffect(() => {
        if (!requestedDayId || activeQuiz) return;
        setGenerating(true);
        setGenerationError(null);
        openSprintDayAssessment(requestedDayId)
            .then((assessment: AssessmentSet) => {
                setActiveQuiz(assessment);
                setRunMode(fromLevel ? "combined" : "standalone-quiz");
                refresh();
            })
            .catch((err: unknown) => {
                setGenerationError(err instanceof Error ? err.message : "Failed to load assessment.");
            })
            .finally(() => {
                setGenerating(false);
            });
    }, [requestedDayId]);

    // When coming via dashboard level flow with existing state, open in combined mode
    useEffect(() => {
        const stateAssessment = (location.state as { assessment?: AssessmentSet } | null)?.assessment;
        if (stateAssessment && !activeQuiz) {
            setActiveQuiz(stateAssessment);
            setRunMode(fromLevel ? "combined" : "standalone-quiz");
        }
    }, [location.state, fromLevel]);

    useEffect(() => {
        if (!requestedAssessmentId || !quizzes || activeQuiz) return;
        const selected = quizzes.find((quiz) => quiz._id === requestedAssessmentId);
        if (selected) {
            setActiveQuiz(selected);
            setRunMode(fromLevel ? "combined" : "standalone-quiz");
        }
    }, [quizzes, requestedAssessmentId, fromLevel]);

    const switchTab = (t: Tab) => {
        setActiveQuiz(null);
        setActiveDeck(null);
        setParams(t === "quizzes" ? {} : { tab: t });
    };

    const loading = generating || (tab === "quizzes" ? !quizzes : !decks);

    // Build sprint → level → assessments grouping
    const sprintGroups = new Map<string, Map<string, { assessment: AssessmentSet; locked: boolean }[]>>();
    // Build a map from sprint label to ordered assessments (for locking logic)
    const sprintAssessmentOrder = new Map<string, AssessmentSet[]>();

    (quizzes || []).forEach((quiz, index) => {
        const context = quiz.sprint_context;
        const sprintNumber = context?.sprint_number || quiz.sprint_number;
        const sprintName = context?.sprint_name || quiz.sprint_name;
        const sprintLabel = sprintName
            ? `Sprint ${sprintNumber || "—"} · ${sprintName}`
            : sprintNumber ? `Sprint ${sprintNumber}` : "Your assessments";
        const levelLabel = context?.level || quiz.level || (quiz.level_number ? `Level ${quiz.level_number}` : `Assessment ${index + 1}`);
        const levels = sprintGroups.get(sprintLabel) || new Map<string, { assessment: AssessmentSet; locked: boolean }[]>();
        const sprintOrder = sprintAssessmentOrder.get(sprintLabel) || [];
        sprintOrder.push(quiz);
        sprintAssessmentOrder.set(sprintLabel, sprintOrder);
        levels.set(levelLabel, [...(levels.get(levelLabel) || []), { assessment: quiz, locked: false }]);
        sprintGroups.set(sprintLabel, levels);
    });

    // Apply locking: Q2 is locked if Q1 in the same sprint is not completed
    for (const [sprintLabel, levels] of sprintGroups) {
        const levelEntries = [...levels.entries()];
        let prevCompleted = true;
        for (const [levelLabel, items] of levelEntries) {
            const allCompleted = items.every((it) => it.assessment.is_completed);
            if (!prevCompleted) {
                // Lock all assessments in this level
                items.forEach((it) => { it.locked = true; });
            }
            prevCompleted = allCompleted;
            levels.set(levelLabel, items);
        }
        sprintGroups.set(sprintLabel, levels);
    }

    const matchedDeck = activeQuiz && decks ? findMatchingDeck(activeQuiz, decks) : null;
    const showCombined = runMode === "combined" && activeQuiz !== null;

    return (
        <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
            <div className="flex-1 overflow-y-auto safe-area-bottom">
                <div className="w-full px-6 md:px-12 py-6 md:py-8 pb-16 space-y-8">
                    {/* ── Header ── */}
                    <div className="bg-lavender-100 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between shadow-pop border border-chrome-accent/50 relative overflow-hidden gap-6">
                        <div className="relative z-10">
                            <h1 className="text-2xl md:text-3xl font-extrabold text-deep-emerald mb-2 tracking-tight">Assessment</h1>
                            <p className="text-base md:text-lg text-forest-emerald/80 font-medium">Test your knowledge with quizzes and flashcards.</p>
                        </div>
                        {/* Only show tabs when not in level flow */}
                        {!showCombined && (
                            <div className="relative z-10 flex gap-4 md:gap-6 bg-white/60 p-2 rounded-2xl border border-white">
                                {TABS.map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => switchTab(t.id)}
                                        className={cn(
                                            "relative px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-colors",
                                            tab === t.id ? "bg-chrome text-on-chrome shadow-sm" : "text-navy-400 hover:text-carbon-900 hover:bg-white/50"
                                        )}
                                    >
                                        <Icon name={t.icon} /> {t.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {generationError ? (
                        <div className="flex flex-col items-center py-16 text-center max-w-md mx-auto space-y-4">
                            <Mascot variant="dissapointed.png" size="lg" />
                            <h3 className="text-xl font-bold text-carbon-900">Could not generate assessment</h3>
                            <p className="text-sm text-carbon-500">{generationError}</p>
                            <button
                                onClick={handleExit}
                                className="px-6 py-2.5 rounded-xl bg-chrome text-white font-bold text-sm"
                            >
                                Back to Dashboard
                            </button>
                        </div>
                    ) : loading ? (
                        <div className="flex flex-col items-center py-20 gap-4 text-center max-w-sm mx-auto">
                            <Mascot variant="working.gif" size="xl" style={{ width: 140, height: 140 }} />
                            <div>
                                <h3 className="text-lg font-extrabold text-carbon-900">
                                    {generating ? "Generating your assessment..." : "Loading assessment..."}
                                </h3>
                                <p className="text-xs text-carbon-500 mt-1">
                                    {generating
                                        ? "Creating tailored multiple-choice questions & flashcard review cards for this sprint level."
                                        : "Preparing your study material..."}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <AnimatePresence mode="wait">
                            <motion.div key={tab + (activeQuiz?._id ?? activeDeck?._id ?? "") + runMode} {...fade}>

                                {/* ── Combined (level flow) runner ── */}
                                {showCombined ? (
                                    <>
                                        <div className="mb-4 rounded-2xl border border-border bg-lavender-100 px-4 py-3">
                                            <p className="text-xs font-bold uppercase tracking-wide text-carbon-500">
                                                {activeQuiz.sprint_context?.sprint_name
                                                    ? `Sprint ${activeQuiz.sprint_context.sprint_number || "—"} · ${activeQuiz.sprint_context.sprint_name}`
                                                    : "Sprint assessment"}
                                            </p>
                                            <p className="mt-1 text-sm font-extrabold text-carbon-900">
                                                {activeQuiz.sprint_context?.level || activeQuiz.level || "Assessment"}{" "}
                                                <span className="text-carbon-400 font-semibold text-xs ml-1">Quiz + Flashcards</span>
                                            </p>
                                        </div>
                                        <CombinedRunner
                                            quiz={activeQuiz}
                                            deck={matchedDeck}
                                            onExit={handleExit}
                                            onLevelComplete={handleLevelComplete}
                                        />
                                    </>
                                ) : tab === "quizzes" ? (
                                    /* ── Standalone quiz tab ── */
                                    activeQuiz ? (
                                        <>
                                            <div className="mb-4 rounded-2xl border border-border bg-lavender-100 px-4 py-3">
                                                <p className="text-xs font-bold uppercase tracking-wide text-carbon-500">
                                                    {activeQuiz.sprint_context?.sprint_name
                                                        ? `Sprint ${activeQuiz.sprint_context.sprint_number || "—"} · ${activeQuiz.sprint_context.sprint_name}`
                                                        : params.get("sprintId") ? `Sprint ${params.get("sprintId")}` : "Sprint assessment"}
                                                </p>
                                                <p className="mt-1 text-sm font-extrabold text-carbon-900">
                                                    {activeQuiz.sprint_context?.level || activeQuiz.level || params.get("level") || "Assessment"}
                                                </p>
                                            </div>
                                            <QuizRunner quiz={activeQuiz} onExit={handleExit} />
                                        </>
                                    ) : (
                                        <>
                                            <Hero
                                                tab="quizzes"
                                                total={quizzes!.length}
                                                completed={quizzes!.filter((q) => q.is_completed).length}
                                                items={quizzes!.reduce((n, q) => n + q.questions.length, 0)}
                                            />
                                            {[...sprintGroups.entries()].map(([sprintLabel, levels]) => (
                                                <section key={sprintLabel} className="mt-8 space-y-5">
                                                    <div className="flex items-center gap-2.5 border-b border-border/60 pb-2">
                                                        <Icon name="ribbon-outline" className="text-chrome text-lg" />
                                                        <h2 className="text-base sm:text-lg font-extrabold text-carbon-900 tracking-tight">{sprintLabel}</h2>
                                                    </div>
                                                    {[...levels.entries()].map(([levelLabel, items]) => (
                                                        <div key={levelLabel} className="space-y-2.5">
                                                            <div className="flex items-center justify-between">
                                                                <h3 className="text-xs font-bold uppercase tracking-wider text-carbon-500">{levelLabel}</h3>
                                                                <span className="text-[11px] font-semibold text-carbon-400">{items.length} {items.length === 1 ? 'assessment' : 'assessments'}</span>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                                {items.map(({ assessment: a, locked }, i) => (
                                                                    <div key={a._id} className="relative">
                                                                        <SetCard
                                                                            index={i}
                                                                            icon={locked ? "lock-closed-outline" : "help-circle"}
                                                                            title={levelLabel}
                                                                            meta={locked ? "Complete earlier levels first" : `${a.questions.length} questions · ~${Math.max(3, Math.round(a.questions.length * 1.5))} mins`}
                                                                            badge={a.is_completed ? "Completed" : locked ? "Locked" : "Not started"}
                                                                            onClick={locked ? undefined : () => {
                                                                                setActiveQuiz(a);
                                                                                setRunMode("standalone-quiz");
                                                                            }}
                                                                        />
                                                                        {locked && (
                                                                            <div className="absolute inset-0 rounded-2xl bg-bg/40 backdrop-blur-[1px] flex items-center justify-center cursor-not-allowed">
                                                                                <div className="w-8 h-8 rounded-full bg-white/90 shadow-xs flex items-center justify-center text-carbon-400">
                                                                                    <Icon name="lock-closed-outline" className="text-base" />
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </section>
                                            ))}
                                        </>
                                    )
                                ) : (
                                    /* ── Standalone flashcard tab ── */
                                    activeDeck ? (
                                        <DeckRunner deck={activeDeck} onExit={handleExit} />
                                    ) : (
                                        <>
                                            <Hero
                                                tab="flashcards"
                                                total={decks!.length}
                                                completed={decks!.filter((d) => d.is_completed).length}
                                                items={decks!.reduce((n, d) => n + d.cards.length, 0)}
                                            />
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                                                {decks!.map((d, i) => (
                                                    <SetCard
                                                        key={d._id}
                                                        index={i}
                                                        icon="albums"
                                                        title={`Flashcard Deck ${i + 1}`}
                                                        meta={`${d.cards.length} cards · ${d.reviewed_count} reviewed`}
                                                        badge={d.is_completed ? "Completed" : "New"}
                                                        onClick={() => {
                                                            setActiveDeck(d);
                                                            setRunMode("standalone-deck");
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </>
                                    )
                                )}
                            </motion.div>
                        </AnimatePresence>
                    )}
                </div>
            </div>
        </div>
    );
}