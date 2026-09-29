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
    <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card variant="elevated" className="w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-carbon-900 mb-4">Reschedule Task</h3>
        <p className="text-carbon-500 mb-6">
          The Planner agent suggests moving this task to tomorrow. This will push your subsequent tasks back by one day to maintain your workload balance.
        </p>
        
        <div className="bg-bg rounded-control p-4 border border-border mb-6">
          <label className="text-sm font-medium text-carbon-900 block mb-2">New Date</label>
          <input 
            type="date" 
            defaultValue={suggestedDate}
            className="w-full bg-surface border border-border rounded-control px-3 py-2 text-carbon-900"
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
