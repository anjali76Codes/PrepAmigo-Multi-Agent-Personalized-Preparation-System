import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

export function MissedTaskBanner({ count }: { count: number }) {
  return (
    <Card className="p-4 bg-[var(--color-amber-600)]/10 border-warning/30 flex items-center gap-4 text-[var(--color-amber-600)]">
      <div className="w-10 h-10 rounded-full bg-[var(--color-amber-600)]/20 flex items-center justify-center shrink-0">
        <Icon name="warning-outline" className="text-xl" />
      </div>
      <div>
        <h4 className="font-semibold">You have {count} missed task{count > 1 ? 's' : ''}</h4>
        <p className="text-sm opacity-90 mt-1">Don't let them pile up! The Planner agent recommends rescheduling them into your upcoming sprint.</p>
      </div>
    </Card>
  );
}
