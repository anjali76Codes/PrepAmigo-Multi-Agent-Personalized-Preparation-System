import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Icon } from '../components/ui/Icon';
import { getAppPreferences, saveAppPreferences, type AppPreferences } from '../lib/preferences';

export function Settings() {
  const shouldReduceMotion = useReducedMotion();
  const [preferences, setPreferences] = useState<AppPreferences>(getAppPreferences);
  const updatePreferences = (updates: Partial<AppPreferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...updates };
      saveAppPreferences(next);
      return next;
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <div className="bg-bg shrink-0 z-10 sticky top-0 px-4 md:px-8 py-8 md:py-12 border-b border-border">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-extrabold text-carbon-900 mb-2 tracking-tight">Settings</h1>
          <p className="text-lg text-carbon-500">Manage your application preferences.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 relative safe-area-bottom">
        <motion.div
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto space-y-8 pb-12"
        >


          {/* Context & Resume Baseline */}
          <div className="bg-white rounded-[2rem] p-8 border border-border shadow-sm space-y-5">
            <h3 className="text-2xl font-bold text-carbon-900 flex items-center gap-3">
              <Icon name="options-outline" className="text-chrome-accent" />
              App customizations
            </h3>
            <div className="grid md:grid-cols-2 gap-5">
              <label className="space-y-2 text-sm font-bold text-carbon-900">
                Calendar week starts on
                <select
                  value={preferences.calendarWeekStart}
                  onChange={(event) => updatePreferences({ calendarWeekStart: event.target.value as AppPreferences["calendarWeekStart"] })}
                  className="w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm font-medium outline-none focus:border-chrome"
                >
                  <option value="monday">Monday</option>
                  <option value="sunday">Sunday</option>
                </select>
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-border bg-bg p-4 text-sm font-semibold text-carbon-800">
                <input
                  type="checkbox"
                  checked={preferences.showCalendarTaskCounts}
                  onChange={(event) => updatePreferences({ showCalendarTaskCounts: event.target.checked })}
                  className="h-4 w-4 accent-[var(--color-chrome)]"
                />
                Show completed / total task counts on calendar days
              </label>
            </div>
            <p className="text-xs text-carbon-500">These preferences are saved on this device.</p>
          </div>


        </motion.div>
      </div>
    </div>
  );
}
