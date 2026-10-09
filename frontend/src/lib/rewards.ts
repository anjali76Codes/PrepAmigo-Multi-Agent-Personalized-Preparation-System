import type { GemRewardData } from "../components/gamification/GemRewardAnimation";
import { buildSprintLevelNodes } from "./sprintLevels";

export const XP_PER_LEVEL_DAY = 20;
export const CREDITS_PER_LEVEL_DAY = 2;

export const ASSESSMENT_XP = 30;
export const ASSESSMENT_CREDITS = 3;

export const SPRINT_BONUS_XP = 100;
export const SPRINT_BONUS_CREDITS = 10;

export const REWARD_STORAGE_KEY = "prep-amigo:xp-reward";

export function queueReward(reward: GemRewardData) {
    sessionStorage.setItem(REWARD_STORAGE_KEY, JSON.stringify(reward));
}

/** The last node of a sprint is its final assessment, so finishing it completes the sprint. */
export function isFinalSprintNode(sprintDays: any[], nodeId: string): boolean {
    const nodes = buildSprintLevelNodes(sprintDays);
    return nodes[nodes.length - 1]?.id === nodeId;
}