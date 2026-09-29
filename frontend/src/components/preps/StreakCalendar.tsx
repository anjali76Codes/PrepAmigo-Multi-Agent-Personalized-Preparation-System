import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

export function StreakCalendar({ streak }: { streak: number }) {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  // Mock recent 7 days activity
  const activeDays = [false, false, true, true, true, true, true]; 

  return (
    <Card className="p-6 bg-[var(--color-surface)] border-[var(--color-border)]">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-bold text-[var(--color-forest-700)]-text">Activity</h3>
          <p className="text-sm text-[var(--color-navy-500)]">Current streak: {streak} days</p>
        </div>
        <div className="bg-[var(--color-amber-600)]/10 text-[var(--color-amber-600)] px-3 py-1 rounded-full flex items-center gap-1 text-sm font-medium">
          <Icon name="flame" /> {streak}
        </div>
      </div>
      
      <div className="flex justify-between items-center px-2">
        {days.map((day, idx) => (
          <div key={idx} className="flex flex-col items-center gap-2">
            <span className="text-xs text-[var(--color-navy-500)] font-medium">{day}</span>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
              activeDays[idx] ? 'bg-[var(--color-navy-900)] text-white shadow-[var(--shadow-card)] shadow-primary/20' : 'bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-navy-500)]/30'
            }`}>
              {activeDays[idx] ? '•' : ''}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
