import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import type { Notification } from '../../data/mockData';

interface PlanUpdateTimelineProps {
  updates: Notification[];
}

export function PlanUpdateTimeline({ updates }: PlanUpdateTimelineProps) {
  const planUpdates = updates.filter(u => u.type === 'plan-update');

  if (planUpdates.length === 0) {
    return (
      <Card className="p-6 bg-[var(--color-surface)] border-[var(--color-border)] text-center">
        <p className="text-[var(--color-navy-500)] text-sm">No plan changes yet.</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-[var(--color-surface)] border-[var(--color-border)]">
      <h3 className="text-lg font-semibold mb-6 text-[var(--color-forest-700)]-text">Plan History</h3>
      <div className="space-y-6">
        {planUpdates.map((update, idx) => (
          <div key={update.id} className="relative flex gap-4">
            {idx !== planUpdates.length - 1 && (
              <div className="absolute left-[15px] top-8 bottom-[-24px] w-px bg-border" />
            )}
            <div className="w-8 h-8 rounded-full bg-[var(--color-navy-900)]/10 text-[var(--color-forest-700)] flex items-center justify-center shrink-0 border border-primary/20 relative z-10">
              <Icon name="git-commit-outline" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-forest-700)]-text">{update.message}</p>
              {update.reason && (
                <p className="text-xs text-[var(--color-amber-600)] mt-1 bg-[var(--color-amber-600)]/10 px-2 py-1 rounded inline-block border border-warning/20">
                  Reason: {update.reason}
                </p>
              )}
              <p className="text-xs text-[var(--color-navy-500)] mt-2">{new Date(update.timestamp).toLocaleDateString()}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
