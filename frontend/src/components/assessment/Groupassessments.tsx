import type { Assessment, FlashcardDeck } from "../../mocks/assessment.mock";

export type LevelItem = { assessment: Assessment; locked: boolean };
export type LevelGroup = { label: string; items: LevelItem[] };
export type SprintGroup = { label: string; levels: LevelGroup[] };

export function getSprintLabel(a: Assessment, fallback = "Your assessments"): string {
    const number = a.sprint_context?.sprint_number || a.sprint_number;
    const name = a.sprint_context?.sprint_name || a.sprint_name;
    if (name) return `Sprint ${number || "—"} · ${name}`;
    if (number) return `Sprint ${number}`;
    return fallback;
}

export function getLevelLabel(a: Assessment, fallback?: string): string {
    if (a.sprint_context?.level) return a.sprint_context.level;
    if (a.level) return a.level;
    if (a.assessment_number) return `Q${a.assessment_number}`;
    if (a.level_number) return `Q${a.level_number}`;
    return fallback || "Q1";
}

/**
 * sprint → level → assessments.
 * A level is locked until every assessment in the previous level of the same sprint is completed.
 */
export function groupBySprint(quizzes: Assessment[]): SprintGroup[] {
    const sprints = new Map<string, Map<string, Assessment[]>>();

    quizzes.forEach((quiz, i) => {
        const sprint = getSprintLabel(quiz);
        const level = getLevelLabel(quiz, `Q${quiz.assessment_number || (i % 2 + 1)}`);
        const levels = sprints.get(sprint) ?? new Map<string, Assessment[]>();
        levels.set(level, [...(levels.get(level) ?? []), quiz]);
        sprints.set(sprint, levels);
    });

    return [...sprints].map(([label, levels]) => {
        let previousDone = true;
        return {
            label,
            levels: [...levels].map(([levelLabel, list]) => {
                const locked = !previousDone;
                previousDone = list.every((q) => q.is_completed);
                return { label: levelLabel, items: list.map((assessment) => ({ assessment, locked })) };
            }),
        };
    });
}

/** The flashcard deck that covers the same sprint days as a given assessment. */
export function findMatchingDeck(assessment: Assessment, decks: FlashcardDeck[]): FlashcardDeck | null {
    if (!assessment.covered_sprint_days?.length) return null;
    const days = new Set(assessment.covered_sprint_days.map(String));
    return decks.find((d) => d.covered_sprint_days?.some((id) => days.has(String(id)))) ?? null;
}