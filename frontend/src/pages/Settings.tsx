import { motion, useReducedMotion } from 'framer-motion';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';

export function Settings() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <div className="bg-bg shrink-0 z-10 sticky top-0 px-4 md:px-8 py-8 md:py-12 border-b border-border">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-extrabold text-carbon-900 mb-2 tracking-tight">Settings</h1>
          <p className="text-lg text-carbon-500">Manage your account and preferences.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 relative safe-area-bottom">
        <motion.div
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto space-y-8 pb-12"
        >
          <div className="bg-white rounded-[2rem] p-8 border border-border shadow-sm">
            <h3 className="text-2xl font-bold text-carbon-900 mb-8 flex items-center gap-3">
              <Icon name="person" className="text-chrome-accent" />
              Account Info
            </h3>
            
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-navy-100 flex items-center justify-center text-navy-900 text-3xl font-bold">
                  JD
                </div>
                <div>
                  <h4 className="font-bold text-carbon-900 text-lg">Jane Doe</h4>
                  <p className="text-carbon-500">jane@example.com</p>
                </div>
                <Button variant="outline" className="ml-auto">Edit Profile</Button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-carbon-900 mb-2">Timezone</label>
                  <select className="w-full bg-bg border border-border rounded-control px-4 py-2 text-carbon-900">
                    <option>Pacific Time (PT)</option>
                    <option>Eastern Time (ET)</option>
                    <option>UTC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-carbon-900 mb-2">Study Days</label>
                  <div className="flex gap-2">
                    {['M','T','W','T','F','S','S'].map((day, i) => (
                      <button key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                        i < 5 ? 'bg-forest-100 text-forest-700' : 'bg-surface text-carbon-500 border border-border'
                      }`}>
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-carbon-900 mb-2">Target Deadline</label>
                  <input type="date" defaultValue="2026-11-15" className="w-full bg-bg border border-border rounded-control px-4 py-2 text-carbon-900" />
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-[2rem] p-8 border border-border shadow-sm">
            <h3 className="text-2xl font-bold text-carbon-900 mb-8 flex items-center gap-3">
              <Icon name="cog" className="text-chrome-accent" />
              Agent Preferences
            </h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-carbon-900">Reschedule Preference</h4>
                  <p className="text-sm text-carbon-500 mt-1">How should the Planner handle missed tasks?</p>
                </div>
                <select className="bg-bg border border-border rounded-control px-4 py-2 text-carbon-900 text-sm">
                  <option>Auto-suggest new dates</option>
                  <option>Always ask me</option>
                  <option>Push everything back</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-carbon-900">Reminder Times</h4>
                  <p className="text-sm text-carbon-500 mt-1">When to send daily digests</p>
                </div>
                <input type="time" defaultValue="09:00" className="bg-bg border border-border rounded-control px-4 py-2 text-carbon-900 text-sm" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-[2rem] p-8 border border-border shadow-sm">
            <h3 className="text-2xl font-bold text-carbon-900 mb-8 flex items-center gap-3">
              <Icon name="document-text" className="text-chrome-accent" />
              Context & Baseline
            </h3>
            
            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-carbon-900 mb-2">Resume</h4>
                <div className="border-2 border-dashed border-border rounded-card p-6 text-center hover:border-forest-700/50 transition-colors cursor-pointer bg-bg">
                  <Icon name="cloud-upload-outline" className="text-3xl text-carbon-500 mb-2" />
                  <p className="text-carbon-900 font-medium">Re-upload Resume</p>
                  <p className="text-xs text-carbon-500 mt-1">PDF or DOCX up to 5MB</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-carbon-900 mb-2">Self Assessment</h4>
                <textarea 
                  className="w-full h-32 bg-bg border border-border rounded-card p-4 text-sm text-carbon-900 resize-none focus:outline-none focus:border-forest-700"
                  defaultValue="I have 5 years of frontend experience heavily focused on React and Node.js. Lacking formalized DSA and large-scale system design practice."
                />
              </div>
              
              <Button variant="primary" className="w-full">Save Changes & Recalibrate</Button>
            </div>
          </div>        </motion.div>
      </div>
    </div>
  );
}
