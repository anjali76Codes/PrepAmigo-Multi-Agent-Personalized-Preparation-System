import { MOCK_SPRINT_DAYS } from "./interviewPlan.mock";

export type Assessment = {
    _id: string;
    sprint_id?: string;
    sprint_name?: string;
    sprint_number?: number;
    level?: string;
    level_number?: number;
    assessment_number?: number;
    sprint_context?: {
        sprint_id?: string;
        sprint_name?: string;
        sprint_number?: number;
        level?: string;
        plan_id?: string;
        plan_name?: string;
        company?: string;
        role?: string;
    };
    covered_sprint_days: string[];
    questions: any[];
    score: number;
    attempted_questions: number;
    correct_answers: number;
    wrong_answers: number;
    total_attempts: number;
    is_completed: boolean;
    createdAt: string;
    updatedAt: string;
};

export type FlashcardDeck = {
    _id: string;
    covered_sprint_days: string[];
    cards: any[];
    reviewed_count: number;
    total_attempts: number;
    is_completed: boolean;
    createdAt: string;
    updatedAt: string;
};

import { apiFetch } from "../lib/api/client";

export const getAssessments = async (): Promise<Assessment[]> => {
    try {
        const response = await apiFetch<{ success: boolean; data: Assessment[] }>("/api/assessments");
        return response.data || [];
    } catch (e) {
        console.error("Failed to fetch assessments", e);
        return [];
    }
};

export const openSprintDayAssessment = async (dayId: string): Promise<Assessment> => {
    const response = await apiFetch<{ success: boolean; data: Assessment }>(
        `/api/sprint-days/${encodeURIComponent(dayId)}/assessment`,
    );
    return response.data;
};

export const getFlashcardDecks = async (): Promise<FlashcardDeck[]> => {
    try {
        const response = await apiFetch<{ success: boolean; data: FlashcardDeck[] }>("/api/flashcards");
        return response.data || [];
    } catch (e) {
        console.error("Failed to fetch flashcards", e);
        return [];
    }
};

/** Save a finished quiz: one answer letter (or null) per question, in order. Best effort. */
export const submitAssessmentAttempt = async (assessmentId: string, answers: (string | null)[]): Promise<boolean> => {
    try {
        const response = await apiFetch<{ newly_awarded?: boolean }>(
            `/api/assessments/${assessmentId}/attempt`,
            { method: "POST", body: JSON.stringify({ answers }) },
        );
        return response.newly_awarded === true;
    } catch (e) {
        console.error("Failed to save the quiz attempt", e);
        return false;
    }
};

/** Save a finished deck: one rating (1 Hard, 3 Okay, 5 Easy, or null) per card, in order. Best effort. */
export const submitFlashcardReview = async (deckId: string, ratings: (number | null)[]): Promise<void> => {
    try {
        await apiFetch(`/api/flashcards/${deckId}/review`, { method: "POST", body: JSON.stringify({ ratings }) });
    } catch (e) {
        console.error("Failed to save the flashcard review", e);
    }
};

export const getDayTitle = (id: string) => {
    return MOCK_SPRINT_DAYS.find((d) => d._id === id)?.topic_title ?? "Practice set";
};