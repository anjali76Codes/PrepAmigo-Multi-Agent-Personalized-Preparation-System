import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAppContext } from '../context/AppContext';
import { PlanCalendar } from '../components/preps/PlanCalendar';
import { Select } from '../components/ui/Select';

export function Calendar() {
  const shouldReduceMotion = useReducedMotion();
  const [selectedPrepId, setSelectedPrepId] = useState<string>('all');
  
  const { preps: mockPreps } = useAppContext();
  const allEntries = mockPreps.flatMap(p => 
    p.calendarEntries.map(e => ({ ...e, prepTitle: p.title }))
  );
  
  const filteredEntries = selectedPrepId === 'all' 
    ? allEntries 
    : allEntries.filter(e => mockPreps.find(p => p.id === selectedPrepId)?.calendarEntries.some(ce => ce.id === e.id));

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <div className="border-b border-border bg-surface shrink-0 z-10 sticky top-0 px-4 md:px-8 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-carbon-900 mb-2">Global Calendar</h1>
            <p className="text-carbon-500">All your upcoming tasks and deadlines across all preps.</p>
          </div>
          <Select 
            value={selectedPrepId} 
            onChange={(e) => setSelectedPrepId(e.target.value)}
            className="w-full md:w-64"
          >
            <option value="all">All Preps</option>
            {mockPreps.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 relative safe-area-bottom">
        <motion.div
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto pb-12"
        >
          <PlanCalendar entries={filteredEntries} />
        </motion.div>
      </div>
    </div>
  );
}
