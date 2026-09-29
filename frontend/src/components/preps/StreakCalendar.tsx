import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

export function StreakCalendar({ streak }: { streak: number }) {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  // Mock recent 7 days activity
  const activeDays = [false, false, true, true, true, true, true]; 

  return (
    <Card className="p-6 bg-surface border-border">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-bold text-primary-text">Activity</h3>
          <p className="text-sm text-secondary-text">Current streak: {streak} days</p>
        </div>
        <div className="bg-warning/10 text-warning px-3 py-1 rounded-full flex items-center gap-1 text-sm font-medium">
          <Icon name="flame" /> {streak}
        </div>
      </div>
      
      <div className="flex justify-between items-center px-2">
        {days.map((day, idx) => (
          <div key={idx} className="flex flex-col items-center gap-2">
            <span className="text-xs text-secondary-text font-medium">{day}</span>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
              activeDays[idx] ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-background border border-border text-secondary-text/30'
            }`}>
              {activeDays[idx] ? '•' : ''}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
