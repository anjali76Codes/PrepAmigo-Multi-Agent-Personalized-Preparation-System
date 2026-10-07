export interface AppPreferences {
  calendarWeekStart: "monday" | "sunday";
  showCalendarTaskCounts: boolean;
}

const STORAGE_KEY = "prepamigo_app_preferences";

export const DEFAULT_PREFERENCES: AppPreferences = {
  calendarWeekStart: "monday",
  showCalendarTaskCounts: true,
};

export function getAppPreferences(): AppPreferences {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!value || typeof value !== "object") return DEFAULT_PREFERENCES;
    const stored = value as Partial<AppPreferences>;
    return {
      calendarWeekStart: stored.calendarWeekStart === "sunday" ? "sunday" : "monday",
      showCalendarTaskCounts: typeof stored.showCalendarTaskCounts === "boolean"
        ? stored.showCalendarTaskCounts
        : DEFAULT_PREFERENCES.showCalendarTaskCounts,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveAppPreferences(preferences: AppPreferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}
