import { apiFetch } from "./client";
import type { Prep, Sprint } from "../../data/mockData";

export interface ApiReference {
  type: "video" | "article" | "documentation" | "problem" | "course" | "book" | string;
  title: string;
  url: string;
  source?: string;
  description?: string;
  is_required?: boolean;
}

export interface ApiSprintDay {
  _id: string;
  sprint_id: string;
  day_number: number;
  scheduled_date: string;
  topic_title: string;
  topic_description?: string;
  objectives: string[];
  estimated_minutes?: number;
  references: ApiReference[];
  status: "pending" | "in_progress" | "completed";
  completed_at?: string | null;
}

export interface ApiSprint {
  _id: string;
  plan_id: string;
  sprint_number: number;
  sprint_name: string;
  start_date: string;
  end_date: string;
  total_days: number;
  completion_percent: number;
  status: "pending" | "in_progress" | "completed";
  sprint_days: ApiSprintDay[];
}

export interface ApiPlan {
  _id: string;
  user_id: string;
  plan_name: string;
  company: string;
  role: string;
  total_days: number;
  start_date: string;
  end_date: string;
  completion_percent: number;
  status: "pending" | "in_progress" | "completed";
  sprints: ApiSprint[];
  createdAt?: string;
  updatedAt?: string;
}

export function apiPlanToPrep(plan: ApiPlan): Prep {
  const sprints: Sprint[] = (plan.sprints || []).map((s) => ({
    id: s._id || `sprint-${s.sprint_number}`,
    title: s.sprint_name,
    focus: s.sprint_name,
    days: (s.sprint_days || []).map((d) => ({
      id: d._id,
      dayNumber: d.day_number,
      topic: d.topic_title,
      objective: d.objectives?.[0] || d.topic_description || "Study key concepts and practice.",
      objectives: d.objectives || [],
      estimatedMinutes: d.estimated_minutes || 60,
      references: (d.references || []).map((r) => r.title || r.url),
      rawReferences: d.references || [],
      practiceTask: d.objectives?.[1]
        ? {
            id: `task-${d._id || d.day_number}`,
            type: "coding",
            title: d.objectives[1],
            status: d.status === "completed" ? "completed" : "pending",
          }
        : null,
      status: d.status === "completed" ? "done" : d.status === "in_progress" ? "today" : "upcoming",
      date: d.scheduled_date || new Date().toISOString(),
    })),
  }));

  const allDays = sprints.flatMap((s) => s.days);
  const calendarEntries = allDays.map((d, idx) => ({
    id: `cal-${plan._id}-${idx + 1}`,
    title: `${d.topic}`,
    date: d.date,
    type: (d.status === "done" ? "due" : "reminder") as "due" | "reminder",
  }));

  return {
    id: plan._id,
    title: plan.plan_name || `${plan.company} ${plan.role} Preparation`,
    durationDays: plan.total_days || 30,
    isActive: plan.status === "in_progress",
    learningContext: {
      id: `lc-${plan._id}`,
      targetRole: plan.role,
      companyInfo: {
        name: plan.company,
        industry: "Tech",
        description: `Preparation program for ${plan.company}`,
        culture: ["Fast-paced", "Collaborative", "Impact-driven"],
      },
      jobRequirements: [
        { id: `req-1`, category: "technical", skill: plan.role, importance: "critical" },
      ],
      interviewPatterns: [
        { round: "Technical Screen", focus: "Problem solving & core skills", format: "45-60 mins" },
        { round: "System Design / Deep Dive", focus: "Architecture & practical decisions", format: "60 mins" },
      ],
      candidateSkills: [],
      resumeSummary: `Targeting ${plan.role} at ${plan.company}.`,
      knowledgeGaps: sprints.map((s, idx) => ({
        id: `gap-${idx + 1}`,
        skill: s.title,
        impactScore: Math.max(90 - idx * 8, 40),
        hoursAllocated: (s.days || []).length * 2,
      })),
      deadline: plan.end_date || new Date(Date.now() + 30 * 86400000).toISOString(),
      completedTopics: allDays.filter((d) => d.status === "done").map((d) => d.topic),
      resources: [],
      progress: {
        xp: Math.round((plan.completion_percent || 0) * 10),
        streak: 1,
        level: 1,
        badges: [],
        titles: [{ id: "t-1", name: "Candidate" }],
        milestones: [],
        skillLevels: [],
        learningVelocity: "1.0x",
      },
      constraints: [],
    },
    roadmap: { sprints },
    calendarEntries,
    assessments: {
      quizzes: [],
      flashcardDecks: [],
      tasks: [],
    },
  };
}

export const plansApi = {
  list: () => apiFetch<{ success: boolean; count: number; data: ApiPlan[] }>("/api/plans"),
  get: (id: string) => apiFetch<{ success: boolean; data: ApiPlan }>(`/api/plans/${id}`),
  summary: (id: string) => apiFetch<{ success: boolean; data: any }>(`/api/plans/${id}/summary`),
  startDay: (dayId: string) =>
    apiFetch<{ success: boolean; data: any }>(`/api/sprint-days/${dayId}/start`, { method: "PATCH" }),
  completeDay: (dayId: string) =>
    apiFetch<{ success: boolean; data: any }>(`/api/sprint-days/${dayId}/complete`, { method: "PATCH" }),
  getUserProgress: () => apiFetch<{ success: boolean; data: any }>("/api/user/progress"),
};
