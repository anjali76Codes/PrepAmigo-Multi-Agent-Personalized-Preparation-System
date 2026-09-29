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
      <Card variant="default" className="p-6 text-center">
        <p className="text-carbon-500 text-sm">No plan changes yet.</p>
      </Card>
    );
  }

  return (
    <Card variant="default" className="p-6">
      <h3 className="text-lg font-semibold mb-6 text-carbon-900">Plan History</h3>
      <div className="space-y-6">
        {planUpdates.map((update, idx) => (
          <div key={update.id} className="relative flex gap-4">
            {idx !== planUpdates.length - 1 && (
              <div className="absolute left-[15px] top-8 bottom-[-24px] w-px bg-border" />
            )}
            <div className="w-8 h-8 rounded-full bg-navy-100 text-forest-700 flex items-center justify-center shrink-0 border border-forest-700/20 relative z-10">
              <Icon name="git-commit-outline" />
            </div>
            <div>
              <p className="text-sm font-medium text-carbon-900">{update.message}</p>
              {update.reason && (
                <p className="text-xs text-amber-600 mt-1 bg-amber-100 px-2 py-1 rounded inline-block border border-amber-600/20">
                  Reason: {update.reason}
                </p>
              )}
              <p className="text-xs text-carbon-500 mt-2">{new Date(update.timestamp).toLocaleDateString()}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
