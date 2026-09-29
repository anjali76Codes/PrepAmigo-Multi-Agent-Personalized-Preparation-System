import { Alert } from '../ui/Alert';

export function MissedTaskBanner({ count }: { count: number }) {
  return (
    <Alert variant="warning" icon="warning-outline">
      <div>
        <h4 className="font-semibold">You have {count} missed task{count > 1 ? 's' : ''}</h4>
        <p className="text-sm opacity-90 mt-1">Don't let them pile up! The Planner agent recommends rescheduling them into your upcoming sprint.</p>
      </div>
    </Alert>
  );
}
