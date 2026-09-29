import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface RescheduleDialogProps {
  taskId: string;
  onClose: () => void;
  onConfirm: (newDate: string) => void;
}

export function RescheduleDialog({ onClose, onConfirm }: RescheduleDialogProps) {
  // Suggest a date (e.g. tomorrow)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const suggestedDate = tomorrow.toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-[var(--color-bg)]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 bg-[var(--color-surface)] shadow-[var(--shadow-pop)]">
        <h3 className="text-lg font-bold text-[var(--color-forest-700)]-text mb-4">Reschedule Task</h3>
        <p className="text-[var(--color-navy-500)] mb-6">
          The Planner agent suggests moving this task to tomorrow. This will push your subsequent tasks back by one day to maintain your workload balance.
        </p>
        
        <div className="bg-[var(--color-bg)] rounded-[var(--radius-control)] p-4 border border-[var(--color-border)] mb-6">
          <label className="text-sm font-medium text-[var(--color-forest-700)]-text block mb-2">New Date</label>
          <input 
            type="date" 
            defaultValue={suggestedDate}
            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-control)] px-3 py-2 text-[var(--color-forest-700)]-text"
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm(new Date(suggestedDate).toISOString())}>Confirm Reschedule</Button>
        </div>
      </Card>
    </div>
  );
}
