import { motion, useReducedMotion } from 'framer-motion';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';

export function Settings() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-bg)] h-full overflow-hidden">
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0 z-10 sticky top-0 px-4 md:px-8 py-6">
        <h1 className="text-3xl font-bold text-[var(--color-forest-700)]-text mb-2">Settings</h1>
        <p className="text-[var(--color-navy-500)]">Manage your learning preferences and schedules.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 relative safe-area-bottom">
        <motion.div
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto space-y-8 pb-12"
        >
          <Card className="p-6 bg-[var(--color-surface)] border-[var(--color-border)]">
            <h3 className="text-lg font-bold text-[var(--color-forest-700)]-text mb-6 flex items-center gap-2">
              <Icon name="time-outline" className="text-[var(--color-forest-700)]" />
              Study Schedule
            </h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-[var(--color-forest-700)]-text mb-2">Hours per day</label>
                <input type="range" min="1" max="8" defaultValue="2" className="w-full accent-primary" />
                <div className="flex justify-between text-xs text-[var(--color-navy-500)] mt-1">
                  <span>1 hr</span>
                  <span>4 hrs</span>
                  <span>8+ hrs</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--color-forest-700)]-text mb-2">Study Days</label>
                <div className="flex gap-2">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                    <button key={idx} className={`w-10 h-10 rounded-full font-medium transition-colors ${
                      idx > 0 && idx < 6 ? 'bg-[var(--color-navy-900)] text-white shadow-[var(--shadow-card)] shadow-primary/20' : 'bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-navy-500)] hover:border-primary/50'
                    }`}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-forest-700)]-text mb-2">Target Deadline</label>
                <input type="date" defaultValue="2026-11-15" className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-control)] px-4 py-2 text-[var(--color-forest-700)]-text" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-[var(--color-surface)] border-[var(--color-border)]">
            <h3 className="text-lg font-bold text-[var(--color-forest-700)]-text mb-6 flex items-center gap-2">
              <Icon name="cog-outline" className="text-[var(--color-forest-700)]" />
              Agent Preferences
            </h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-[var(--color-forest-700)]-text">Reschedule Preference</h4>
                  <p className="text-sm text-[var(--color-navy-500)] mt-1">How should the Planner handle missed tasks?</p>
                </div>
                <select className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-control)] px-4 py-2 text-[var(--color-forest-700)]-text text-sm">
                  <option>Auto-suggest new dates</option>
                  <option>Always ask me</option>
                  <option>Push everything back</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-[var(--color-forest-700)]-text">Reminder Times</h4>
                  <p className="text-sm text-[var(--color-navy-500)] mt-1">When to send daily digests</p>
                </div>
                <input type="time" defaultValue="09:00" className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-control)] px-4 py-2 text-[var(--color-forest-700)]-text text-sm" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-[var(--color-surface)] border-[var(--color-border)]">
            <h3 className="text-lg font-bold text-[var(--color-forest-700)]-text mb-6 flex items-center gap-2">
              <Icon name="document-text-outline" className="text-[var(--color-forest-700)]" />
              Context & Baseline
            </h3>
            
            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-[var(--color-forest-700)]-text mb-2">Resume</h4>
                <div className="border-2 border-dashed border-[var(--color-border)] rounded-[var(--radius-card)] p-6 text-center hover:border-primary/50 transition-colors cursor-pointer bg-[var(--color-bg)]">
                  <Icon name="cloud-upload-outline" className="text-3xl text-[var(--color-navy-500)] mb-2" />
                  <p className="text-[var(--color-forest-700)]-text font-medium">Re-upload Resume</p>
                  <p className="text-xs text-[var(--color-navy-500)] mt-1">PDF or DOCX up to 5MB</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-[var(--color-forest-700)]-text mb-2">Self Assessment</h4>
                <textarea 
                  className="w-full h-32 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-card)] p-4 text-sm text-[var(--color-forest-700)]-text resize-none"
                  defaultValue="I have 5 years of frontend experience heavily focused on React and Node.js. Lacking formalized DSA and large-scale system design practice."
                />
              </div>
              
              <Button className="w-full">Save Changes & Recalibrate</Button>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
