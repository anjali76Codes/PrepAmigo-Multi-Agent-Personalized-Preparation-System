import { Assessment, Plan, PlanProgress, Sprint, SprintDay, User } from '../models/index.js';
import { config } from '../config/env.js';

interface VoiceIntentResponse {
  intentType: 'personal_data' | 'navigation' | 'general_knowledge';
  spokenAnswer: string;
  navigationTarget: string | null;
  dayNumber: number | null;
  sprintNumber: number | null;
  forwardToResearchAgent?: boolean;
}

const RESPONSE_FORMAT = {
  type: 'object',
  properties: {
    intentType: { type: 'string', enum: ['personal_data', 'navigation', 'general_knowledge'] },
    spokenAnswer: { type: 'string' },
    navigationTarget: {
      type: ['string', 'null'],
      enum: ['plan', 'plan_day', 'plan_sprint', 'progress', 'gaps', 'readiness', 'resources', 'profile', 'assessment', 'interview_prep', 'calendar', null],
    },
    dayNumber: { type: ['integer', 'null'] },
    sprintNumber: { type: ['integer', 'null'] },
  },
  required: ['intentType', 'spokenAnswer', 'navigationTarget', 'dayNumber', 'sprintNumber'],
  additionalProperties: false,
};

export class VoiceAssistantService {
  async processVoiceInput(userId: string, transcript: string) {
    // 1. Fetch user live state
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    const plans = await Plan.find({ user_id: userId }).sort({ createdAt: -1 }).lean();
    plans.sort((a, b) => {
      const aIsActive = a.status === 'pending' || a.status === 'in_progress';
      const bIsActive = b.status === 'pending' || b.status === 'in_progress';
      return Number(bIsActive) - Number(aIsActive);
    });
    const planIds = plans.map((item) => item._id);
    const [sprints, progressRecords] = planIds.length
      ? await Promise.all([
          Sprint.find({ plan_id: { $in: planIds } }).sort({ sprint_number: 1 }).lean(),
          PlanProgress.find({ user_id: userId, plan_id: { $in: planIds } }).lean(),
        ])
      : [[], []];
    const sprintIds = sprints.map((item) => item._id);
    const [days, assessments] = sprintIds.length
      ? await Promise.all([
          SprintDay.find({ sprint_id: { $in: sprintIds } }).sort({ day_number: 1 }).lean(),
          Assessment.find({ user_id: userId, sprint_id: { $in: sprintIds } }).lean(),
        ])
      : [[], []];

    const sprintById = new Map(sprints.map((item) => [String(item._id), item]));
    const sprintsByPlan = new Map<string, typeof sprints>();
    for (const sprint of sprints) {
      const key = String(sprint.plan_id);
      sprintsByPlan.set(key, [...(sprintsByPlan.get(key) ?? []), sprint]);
    }
    const daysBySprint = new Map<string, typeof days>();
    for (const day of days) {
      const key = String(day.sprint_id);
      daysBySprint.set(key, [...(daysBySprint.get(key) ?? []), day]);
    }
    const assessmentsByPlan = new Map<string, typeof assessments>();
    for (const assessment of assessments) {
      const sprint = sprintById.get(String(assessment.sprint_id));
      if (!sprint) continue;
      const key = String(sprint.plan_id);
      assessmentsByPlan.set(key, [...(assessmentsByPlan.get(key) ?? []), assessment]);
    }
    const progressByPlan = new Map(progressRecords.map((item) => [String(item.plan_id), item]));
    const candidatePlans = plans.map((item) => {
      const planSprints = sprintsByPlan.get(String(item._id)) ?? [];
      const planDayCount = planSprints.reduce(
        (count, sprint) => count + (daysBySprint.get(String(sprint._id))?.length ?? 0),
        0,
      );
      const completedDayCount = planSprints.reduce(
        (count, sprint) =>
          count + (daysBySprint.get(String(sprint._id)) ?? []).filter((day) => day.status === 'completed').length,
        0,
      );
      const availableAssessments = (assessmentsByPlan.get(String(item._id)) ?? []).length;
      const progress = progressByPlan.get(String(item._id));
      let roadmapOrdinal = 0;

      return {
        name: item.plan_name,
        company: item.company,
        role: item.role,
        status: item.status,
        total_days: item.total_days,
        start_date: item.start_date,
        end_date: item.end_date,
        completion_percent: item.completion_percent,
        completed_days: completedDayCount,
        days_with_topics: planDayCount,
        stored_progress: progress
          ? {
              xp_points: progress.xp_points,
              completed_day_count: progress.completed_day_count,
              streak_count: progress.streak_count,
              longest_streak: progress.longest_streak,
            }
          : null,
        available_assessments: availableAssessments,
        assessment_results: (assessmentsByPlan.get(String(item._id)) ?? []).map((assessment) => {
          const sprint = sprintById.get(String(assessment.sprint_id));
          return {
            sprint: sprint?.sprint_number,
            sprint_name: sprint?.sprint_name,
            assessment_number: assessment.assessment_number,
            completed: assessment.is_completed,
            score: assessment.is_completed ? assessment.score : null,
            attempted_questions: assessment.attempted_questions,
            correct_answers: assessment.correct_answers,
            total_questions: assessment.questions.length,
          };
        }),
        sprints: planSprints.map((sprint) => ({
          number: sprint.sprint_number,
          title: sprint.sprint_name,
          total_days: sprint.total_days,
          status: sprint.status,
          days: (daysBySprint.get(String(sprint._id)) ?? []).map((day) => ({
            number: day.day_number,
            roadmap_ordinal: ++roadmapOrdinal,
            topic: day.topic_title,
            status: day.status,
            objectives: day.objectives,
            resources: day.references.map((reference) => ({
              title: reference.title,
              url: reference.url,
            })),
          })),
        })),
      };
    });

    const userDataContext = `
SIGNED-IN CANDIDATE DATA (FACTUAL CONTEXT)
---
Name: ${user.name}
Profile: ${JSON.stringify({
  target_role: user.profile.target_role,
  experience_level: user.profile.experience_level,
  skills: user.profile.skills,
})}
Plans, progress, scheduled days, assessments, and resources: ${JSON.stringify(candidatePlans)}
---
Use only this candidate's data for questions about their profile, preparation, plans, days completed, readiness, skills, resources, or assessments. Answer personal-data questions directly as personal_data; do not classify them as general_knowledge or say that you will ask the Research Agent. Never invent a readiness score or an assessment that is not represented in this context. Clearly say when a value is not tracked or not available.
`;

    const prompt = `
You are the PrepAmigo Voice Assistant.
You are strictly talking to the current user. 
Classify the user's intent into 'personal_data', 'navigation', or 'general_knowledge'. General_knowledge is for questions unrelated to the signed-in candidate's own data.
If the intent is a navigation to a specific day or sprint (e.g., 'today', 'last sprint', 'DSA sprint', 'day 25'), resolve it based on the candidate's active plan data provided. For plan_day navigation, dayNumber MUST be that day's roadmap_ordinal (the overall position across the plan), not its day number within a sprint.
Reject any target outside the allow-list or out of range. 

${userDataContext}
`;

    const response = await fetch(`${config.OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.OLLAMA_MODEL,
        stream: false,
        format: RESPONSE_FORMAT,
        messages: [
          {
            role: 'system',
            content: `${prompt}

Return only the JSON object matching the required response format. For a general plan navigation, set navigationTarget to "plan" and set dayNumber and sprintNumber to null. Only include a dayNumber for "plan_day" and a sprintNumber for "plan_sprint".

Example for "Navigate to the plan":
{"intentType":"navigation","spokenAnswer":"Opening your plan.","navigationTarget":"plan","dayNumber":null,"sprintNumber":null}`,
          },
          { role: 'user', content: transcript },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Ollama request failed (${response.status}): ${errorBody}`);
    }

    const ollamaResponse = await response.json() as {
      message?: { content?: string };
    };
    const responseContent = ollamaResponse.message?.content;
    if (!responseContent) {
      throw new Error('Ollama returned an empty chat response.');
    }

    const result = JSON.parse(responseContent) as VoiceIntentResponse;
    if (
      !['personal_data', 'navigation', 'general_knowledge'].includes(result.intentType) ||
      typeof result.spokenAnswer !== 'string' ||
      !result.spokenAnswer.trim() ||
      (result.navigationTarget !== null && typeof result.navigationTarget !== 'string') ||
      (result.dayNumber !== null && !Number.isInteger(result.dayNumber)) ||
      (result.sprintNumber !== null && !Number.isInteger(result.sprintNumber))
    ) {
      throw new Error('Ollama returned an invalid voice assistant response.');
    }
    
    // Validation
    const allowedTargets = [
      'plan', 'plan_day', 'plan_sprint', 'progress', 'gaps', 'readiness',
      'resources', 'profile', 'assessment', 'interview_prep', 'calendar',
    ];
    if (result.navigationTarget && !allowedTargets.includes(result.navigationTarget)) {
      result.navigationTarget = null;
      result.spokenAnswer = "I'm not sure how to navigate there, but what else can I help you with?";
    }
    const latestPlan = candidatePlans[0];
    if (
      result.dayNumber !== null &&
      latestPlan &&
      (result.dayNumber < 1 || result.dayNumber > latestPlan.total_days)
    ) {
      result.navigationTarget = null;
      result.spokenAnswer = "That day doesn't seem to be in your plan. Could you clarify?";
    }
    if (
      result.sprintNumber !== null &&
      latestPlan &&
      (result.sprintNumber < 1 || result.sprintNumber > latestPlan.sprints.length)
    ) {
      result.navigationTarget = null;
      result.spokenAnswer = "That sprint doesn't seem to be in your plan. Could you clarify?";
    }

    if (result.intentType === 'general_knowledge') {
      result.forwardToResearchAgent = true;
      result.spokenAnswer = "I’m searching for an answer.";
    }

    return result;
  }
}

export const voiceAssistantService = new VoiceAssistantService();
