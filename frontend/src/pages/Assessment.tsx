import { useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import { useLocation, useSearchParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "../components/ui/Icon";
import { Mascot } from "../components/ui/Mascot";
import { cn } from "../utils/utils";
import {
    getAssessments, getFlashcardDecks, openSprintDayAssessment,
    type Assessment as AssessmentSet, type FlashcardDeck,
} from "../mocks/assessment.mock";
import { Button, fade } from "../components/assessment/shared";
// import { Hero } from "../components/assessment/Hero";
import { SprintBanner } from "../components/assessment/SprintBanner";
import { QuizRunner } from "../components/assessment/QuizRunner";
import { DeckRunner } from "../components/assessment/DeckRunner";
import { CombinedRunner } from "../components/assessment/CombinedRunner";
import { findMatchingDeck, groupBySprint, type SprintGroup } from "../components/assessment/Groupassessments";
import { useAppContext } from "../context/AppContext";
import { Card } from "../components/ui/Card";
import { Button as Butt } from "../components/ui/Button";
import { FeedbackPanel, type Feedback } from "../components/assessment/FeedbackPanel";

type Tab = "quizzes" | "flashcards";
type RunMode = "standalone-quiz" | "standalone-deck" | "combined";

const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "quizzes", label: "Quizzes", icon: "bulb" },
    { id: "flashcards", label: "Flashcards", icon: "albums" },
];

const GRID = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10";
const MotionCard = motion.create(Card);

/* ───────────── shared header stats ───────────── */

function AssessmentStat({
    label,
    value,
    icon,
}: {
    label: string;
    value: string | number;
    icon: string;
}) {
    return (
        <div className="min-w-0 rounded-2xl border border-border bg-surface px-3 py-3 sm:px-4">
            <div className="flex items-center gap-2 text-chrome">
                <Icon name={icon} className="shrink-0 text-base" />
                <span className="truncate text-[10px] font-bold uppercase tracking-wide text-carbon-500 sm:text-xs">
                    {label}
                </span>
            </div>

            <p className="mt-1 text-xl font-extrabold text-carbon-900 sm:text-2xl">
                {value}
            </p>
        </div>
    );
}

function AssessmentHeader({
    tab,
    onSwitchTab,
    quizzes,
    decks,
    active,
}: {
    tab: Tab;
    onSwitchTab: (tab: Tab) => void;
    quizzes: AssessmentSet[] | null;
    decks: FlashcardDeck[] | null;
    active: boolean;
}) {
    const isQuiz = tab === "quizzes";
    const total = isQuiz ? quizzes?.length ?? 0 : decks?.length ?? 0;

    const completed = isQuiz
        ? quizzes?.filter((q) => q.is_completed).length ?? 0
        : decks?.filter((d) => d.is_completed).length ?? 0;

    const items = isQuiz
        ? quizzes?.reduce((n, q) => n + q.questions.length, 0) ?? 0
        : decks?.reduce((n, d) => n + d.cards.length, 0) ?? 0;

    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
        <MotionCard
            layout
            variant="default"
            transition={{ duration: 0.3, ease: "easeInOut" }}
            style={{ borderRadius: 24 }} // keeps rounded-3xl from distorting during the layout animation
            className={cn(
                "flex flex-col gap-6 rounded-3xl bg-lavender-100 transition-all",
                active ? "p-4 md:px-8" : "p-6 md:p-8"
            )}
        >
            <div className="flex flex-col gap-6 md:flex-row md:items-center">
                {/* Title (always visible) */}
                <div className="min-w-0 flex-1">
                    <AnimatePresence initial={false}>
                        {!active && (
                            <motion.div
                                key="back"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                className="overflow-hidden"
                            >
                                <Link to="/dashboard" className="inline-flex">
                                    <Butt
                                        variant="outline"
                                        size="sm"
                                        className="-ml-3 mb-3 gap-1.5 border-none font-bold text-chrome hover:bg-surface/50"
                                    >
                                        <Icon name="arrow-back" />
                                        Dashboard
                                    </Butt>
                                </Link>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <h1 className="text-2xl font-extrabold text-carbon-900 md:text-3xl">
                        Assessment
                    </h1>

                    <p className="mt-1 text-sm text-carbon-500 md:text-base">
                        {active
                            ? "Stay focused, you've got this!"
                            : "Practise with quizzes and flashcards to strengthen your skills."}
                    </p>
                </div>

                {/* Stats + tabs (list view only) */}
                <AnimatePresence initial={false}>
                    {!active && (
                        <motion.div
                            key="stats"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="flex shrink-0 flex-col gap-3 overflow-hidden"
                        >
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <AssessmentStat
                                    label={isQuiz ? "Quizzes" : "Decks"}
                                    value={total}
                                    icon={isQuiz ? "help-circle" : "albums"}
                                />
                                <AssessmentStat
                                    label="Completed"
                                    value={`${completed}/${total}`}
                                    icon="checkmark-circle-outline"
                                />
                                <AssessmentStat
                                    label={isQuiz ? "Questions" : "Cards"}
                                    value={items}
                                    icon={isQuiz ? "list-outline" : "copy-outline"}
                                />
                                <AssessmentStat
                                    label="Progress"
                                    value={`${progress}%`}
                                    icon="pie-chart-outline"
                                />
                            </div>

                            <div className="flex w-full gap-1 rounded-full border border-border bg-surface p-1.5 sm:w-fit sm:self-end">
                                {TABS.map((t) => {
                                    const isActiveTab = tab === t.id;
                                    return (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => onSwitchTab(t.id)}
                                            aria-pressed={isActiveTab}
                                            className={cn(
                                                "relative isolate flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-colors sm:flex-none",
                                                isActiveTab
                                                    ? "bg-expresso text-on-chrome shadow-sm"
                                                    : "text-cocoa hover:bg-lavender-100 hover:text-carbon-900"
                                            )}
                                        >
                                            <Icon name={t.icon} className="text-xl" />
                                            {t.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Mascot (always visible) */}
                <div className="hidden shrink-0 items-center justify-center sm:flex transition-all ease-in-out">
                    <Mascot
                        size={active ? "md" : "lg"}
                        variant="working.png"
                        className={cn("rounded-full border border-border bg-surface p-2", active && "size-24")}
                    />
                </div>
            </div>
        </MotionCard>
    );
}
/* ───────────── list views ───────────── */

function QuizList({
    groups, onOpen,
}: {
    groups: SprintGroup[];
    onOpen: (a: AssessmentSet) => void;
}) {
    return (
        <>
            {/* <Hero
                tab="quizzes"
                total={quizzes.length}
                completed={quizzes.filter((q) => q.is_completed).length}
                items={quizzes.reduce((n, q) => n + q.questions.length, 0)}
            /> */}

            <div className="space-y-10">
                {groups.map((sprint) => (
                    <section key={sprint.label} className="mt-8 space-y-6">
                        <div className="flex items-center gap-3 border-b border-border/60 pb-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-expresso text-on-chrome">
                                <img src="/assets/icons/badge1.png" alt="badge" className="h-8 w-8" />
                            </div>
                            <div>
                                <h2 className="text-lg font-extrabold text-deep-emerald">{sprint.label}</h2>
                                <p className="text-sm text-carbon-500">
                                    {sprint.levels.reduce((n, level) => n + level.items.length, 0)} assessments available
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
                            {sprint.levels.flatMap((level) =>
                                level.items.map(({ assessment: a, locked }, i) => {
                                    const count = a.questions.length;
                                    const duration = Math.max(3, Math.round(count * 1.5));
                                    const status = a.is_completed ? "Completed" : locked ? "Locked" : "Ready to start";

                                    return (
                                        <MotionCard
                                            key={a._id}
                                            variant={locked ? "muted" : "chrome"}
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.25, delay: i * 0.04 }}
                                            whileHover={locked ? undefined : { y: -4, scale: 1.01 }}
                                            whileTap={locked ? undefined : { scale: 0.99 }}
                                            onClick={() => { if (!locked) onOpen(a); }}
                                            role="button"
                                            tabIndex={locked ? -1 : 0}
                                            aria-disabled={locked}
                                            onKeyDown={(e) => {
                                                if (!locked && (e.key === "Enter" || e.key === " ")) {
                                                    e.preventDefault();
                                                    onOpen(a);
                                                }
                                            }}
                                            className={cn(
                                                "group flex min-h-[20vh] flex-col justify-between gap-5 rounded-3xl border border-white/60 p-5 shadow-card transition-shadow duration-200",
                                                locked
                                                    ? "cursor-not-allowed bg-chrome-accent text-chrome opacity-65"
                                                    : "cursor-pointer bg-soft-rose hover:shadow-pop"
                                            )}
                                        >
                                            <div>
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <div className={cn(
                                                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                                                            locked ? "bg-bg text-carbon-500" : "bg-deep-emerald text-on-chrome"
                                                        )}>
                                                            <Icon name={locked ? "lock-closed-outline" : "bulb-outline"} className="text-xl" />
                                                        </div>
                                                        <h4 className="text-base font-extrabold text-carbon-900">{level.label}</h4>
                                                    </div>
                                                    <span className={cn(
                                                        "shrink-0 rounded-full px-3 py-1 text-[11px] font-bold",
                                                        a.is_completed ? "bg-forest-emerald text-on-chrome" :
                                                            locked ? "bg-carbon-900 text-bg" : "bg-white/60 text-deep-emerald"
                                                    )}>
                                                        {status}
                                                    </span>
                                                </div>

                                                <p className="mt-3 text-md text-deep-emerald">
                                                    {locked
                                                        ? "Complete the previous level to unlock this assessment."
                                                        : a.is_completed
                                                            ? "You've completed this quiz. Open it to practise again."
                                                            : "Check your understanding and strengthen your skills."}
                                                </p>
                                            </div>

                                            <div className="flex items-center justify-between gap-3 border-t border-carbon-900/10 pt-4">
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-chrome">
                                                    <span className="inline-flex items-center gap-1.5"><Icon name="help-circle" />{count} questions</span>
                                                    <span className="inline-flex items-center gap-1.5"><Icon name="time-outline" />~{duration} min</span>
                                                </div>
                                                <span className={cn(
                                                    "shrink-0 text-sm font-extrabold transition-transform",
                                                    locked ? "text-carbon-400" : "text-deep-emerald group-hover:translate-x-1"
                                                )}>
                                                    <Icon name={locked ? "lock-closed-outline" : "arrow-forward-outline"} />
                                                </span>
                                            </div>
                                        </MotionCard>
                                    );
                                })
                            )}
                        </div>
                    </section>
                ))}
            </div>
        </>
    );
}

function DeckList({
    decks, onOpen,
}: {
    decks: FlashcardDeck[];
    onOpen: (d: FlashcardDeck) => void;
}) {
    return (
        <>
            {/* <Hero
                tab="flashcards"
                total={decks.length}
                completed={decks.filter((d) => d.is_completed).length}
                items={decks.reduce((n, d) => n + d.cards.length, 0)}
            /> */}

            <div className={cn(GRID, "mt-6")}>
                {decks.map((deck, i) => {
                    const total = deck.cards.length;
                    const reviewed = deck.reviewed_count ?? 0;
                    const progress = total > 0 ? Math.min(100, Math.round((reviewed / total) * 100)) : 0;
                    const status = deck.is_completed ? "Completed" : reviewed > 0 ? "In progress" : "Not started";

                    return (
                        <MotionCard
                            key={deck._id}
                            variant="chrome"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, delay: i * 0.04 }}
                            whileHover={{ y: -4, scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => onOpen(deck)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    onOpen(deck);
                                }
                            }}
                            className="group flex min-h-[30vh] cursor-pointer flex-col justify-between gap-10 rounded-3xl border border-white/60 bg-soft-rose p-5 shadow-card transition-shadow duration-200 hover:shadow-pop"
                        >
                            <div>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-deep-emerald text-on-chrome">
                                            <Icon name="albums" className="text-xl" />
                                        </div>
                                        <h3 className="text-base font-extrabold text-carbon-900">Flashcard deck {i + 1}</h3>
                                    </div>
                                    <span className={cn(
                                        "shrink-0 rounded-full px-3 py-1 text-[11px] font-bold",
                                        deck.is_completed ? "bg-forest-emerald text-on-chrome" :
                                            reviewed > 0 ? "bg-white/60 text-deep-emerald" : "bg-carbon-900 text-bg"
                                    )}>
                                        {status}
                                    </span>
                                </div>

                                <p className="mt-3 text-md text-deep-emerald">
                                    {deck.is_completed
                                        ? "You've completed this deck. Revisit the cards to refresh your memory."
                                        : reviewed > 0
                                            ? "Keep going! Review the remaining cards to complete this deck."
                                            : "Review key concepts and practise active recall at your own pace."}
                                </p>
                            </div>

                            <div>
                                <div className="mb-2 flex items-center justify-between gap-3 text-sm font-medium text-chrome">
                                    <span className="inline-flex items-center gap-1.5"><Icon name="albums" />{reviewed}/{total} cards reviewed</span>
                                    <span className="font-bold">{progress}%</span>
                                </div>
                                <div
                                    className="h-2 overflow-hidden rounded-full bg-carbon-900/10"
                                    role="progressbar"
                                    aria-label="Flashcard review progress"
                                    aria-valuenow={progress}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                >
                                    <motion.div
                                        className="h-full rounded-full bg-deep-emerald"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress}%` }}
                                        transition={{ duration: 0.6, delay: i * 0.05 }}
                                    />
                                </div>
                                <div className="mt-4 flex items-center justify-between gap-3 border-t border-carbon-900/10 pt-4">
                                    <span className="text-sm font-medium text-chrome">
                                        {total} {total === 1 ? "card" : "cards"}
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-sm font-extrabold text-deep-emerald transition-transform group-hover:translate-x-1">
                                        {deck.is_completed ? "Review again" : "Start learning"}
                                        <Icon name="arrow-forward-outline" />
                                    </span>
                                </div>
                            </div>
                        </MotionCard>
                    );
                })}
            </div>
        </>
    );
}

/* ───────────── status screens ───────────── */

function ErrorState({ message, onBack }: { message: string; onBack: () => void }) {
    return (
        <div className="mx-auto flex max-w-md flex-col items-center space-y-4 py-16 text-center">
            <Mascot variant="dissapointed.png" size="lg" />
            <h3 className="text-xl font-bold text-carbon-900">Could not generate assessment</h3>
            <p className="text-sm text-carbon-500">{message}</p>
            <Button onClick={onBack}>Back to dashboard</Button>
        </div>
    );
}

function LoadingState({ generating }: { generating: boolean }) {
    return (
        <div className="mx-auto flex max-w-sm flex-col items-center gap-4 py-20 text-center">
            <Mascot variant="working.gif" size="xl" style={{ width: 140, height: 140 }} />
            <div>
                <h3 className="text-lg font-extrabold text-carbon-900">
                    {generating ? "Generating your assessment..." : "Loading assessment..."}
                </h3>
                <p className="mt-1 text-xs text-carbon-500">
                    {generating
                        ? "Creating tailored questions and flashcards for this sprint level."
                        : "Preparing your study material..."}
                </p>
            </div>
        </div>
    );
}

function SessionLayout({ banner, children, feedback }: {
    banner: ReactNode; children: ReactNode; feedback: Feedback;
}) {
    return (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[auto_minmax(0,1fr)_20rem] lg:gap-8">
            {banner}
            <main className="flex min-w-0 justify-center">{children}</main>
            <FeedbackPanel feedback={feedback} />
        </div>
    );
}
/* ───────────── main page ───────────── */

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
    const [feedback, setFeedback] = useState<Feedback>(null);

    // clear stale feedback whenever the session changes
    useEffect(() => { setFeedback(null); }, [activeQuiz?._id, activeDeck?._id]);


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

    useEffect(() => {
        const fromState = (location.state as { assessment?: AssessmentSet } | null)?.assessment;
        if (fromState && !activeQuiz) openQuiz(fromState);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state, fromLevel]);

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
    const isSessionActive = showCombined || activeQuiz !== null || activeDeck !== null;

    const renderBody = () => {
        if (showCombined) {
            return (
                <SessionLayout
                    banner={<SprintBanner assessment={activeQuiz!} note="Quiz + flashcards" />}
                    feedback={feedback}
                >
                    <CombinedRunner
                        quiz={activeQuiz!}
                        deck={matchedDeck}
                        onExit={handleExit}
                        onLevelComplete={handleLevelComplete}
                        onFeedback={setFeedback}
                    />
                </SessionLayout>
            );
        }

        if (tab === "quizzes") {
            return activeQuiz ? (
                <SessionLayout banner={<SprintBanner assessment={activeQuiz} />} feedback={feedback}>
                    <QuizRunner quiz={activeQuiz} onExit={handleExit} onFeedback={setFeedback} />
                </SessionLayout>
            ) : (
                <QuizList groups={groups} onOpen={openQuiz} />
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
        <div className="flex h-full flex-1 flex-col overflow-hidden bg-bg text-carbon-700">
            <div className="safe-area-bottom flex-1 overflow-y-auto">
                <div className="w-full space-y-8 px-6 py-6 pb-16 md:px-12 md:py-8">
                    <AssessmentHeader
                        tab={tab}
                        onSwitchTab={switchTab}
                        quizzes={quizzes}
                        decks={decks}
                        active={isSessionActive}

                    />

                    {generationError ? (
                        <ErrorState message={generationError} onBack={handleExit} />
                    ) : loading ? (
                        <LoadingState generating={generating} />
                    ) : (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={tab + (activeQuiz?._id ?? activeDeck?._id ?? "") + runMode}
                                {...fade}
                            >
                                {renderBody()}
                            </motion.div>
                        </AnimatePresence>
                    )}
                </div>
            </div>
        </div>
    );
}