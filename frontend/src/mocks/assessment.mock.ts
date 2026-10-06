import { MOCK_SPRINT_DAYS } from "./interviewPlan.mock";

export type Assessment = {
    _id: string;
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

export const getFlashcardDecks = async (): Promise<FlashcardDeck[]> => {
    try {
        const response = await apiFetch<{ success: boolean; data: FlashcardDeck[] }>("/api/flashcards");
        return response.data || [];
    } catch (e) {
        console.error("Failed to fetch flashcards", e);
        return [];
    }
};

export const getDayTitle = (id: string) => {
    return MOCK_SPRINT_DAYS.find((d) => d._id === id)?.topic_title ?? "Practice set";
};