import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

export function StreakCalendar({
  streak,
  activityDays,
}: {
  streak: number;
  activityDays?: boolean[];
}) {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const activeDays = activityDays && activityDays.length === 7
    ? activityDays
    : [false, false, false, false, false, streak > 1, streak > 0];

  return (
    <Card variant="default" className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-xl font-bold text-carbon-900 flex items-center gap-2">
            <Icon name="calendar-outline" className="text-chrome" />
            Learning Activity
          </h3>
          <p className="text-xs text-carbon-500 mt-0.5">
            Current streak: <span className="font-bold text-carbon-900">{streak} days</span>
          </p>
        </div>
        <div className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full flex items-center gap-1.5 text-xs font-bold shadow-2xs">
          <Icon name="flame" className="text-amber-600" /> {streak} Day Streak
        </div>
      </div>

      <div className="flex justify-between items-center px-2">
        {days.map((day, idx) => (
          <div key={idx} className="flex flex-col items-center gap-2">
            <span className="text-xs text-carbon-500 font-bold">{day}</span>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${
                activeDays[idx]
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20 scale-105'
                  : 'bg-bg border border-border text-carbon-300'
              }`}
            >
              {activeDays[idx] ? <Icon name="checkmark" /> : '·'}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
