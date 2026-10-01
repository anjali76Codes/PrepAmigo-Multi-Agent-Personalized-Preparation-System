import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

export function StreakCalendar({ streak }: { streak: number }) {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  // Mock recent 7 days activity
  const activeDays = [false, false, true, true, true, true, true]; 

  return (
    <Card variant="default" className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-bold text-carbon-900">Activity</h3>
          <p className="text-sm text-carbon-500">Current streak: {streak} days</p>
        </div>
        <div className="bg-beige-100 text-beige-600 px-3 py-1 rounded-full flex items-center gap-1 text-sm font-medium">
          <Icon name="flame" /> {streak}
        </div>
      </div>
      
      <div className="flex justify-between items-center px-2">
        {days.map((day, idx) => (
          <div key={idx} className="flex flex-col items-center gap-2">
            <span className="text-xs text-carbon-500 font-medium">{day}</span>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
              activeDays[idx] ? 'bg-carbon-900 text-white shadow-card shadow-navy-700/20' : 'bg-bg border border-border text-carbon-500/30'
            }`}>
              {activeDays[idx] ? '•' : ''}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
