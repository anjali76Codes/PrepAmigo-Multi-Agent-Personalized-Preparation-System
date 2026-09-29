import { Icon } from '../ui/Icon';

export function RevisionCycles({ }: { sprintId: string }) {
  return (
    <div className="bg-accent/5 rounded-xl p-4 border border-accent/20">
      <h4 className="text-sm font-semibold text-accent flex items-center gap-2 mb-2">
        <Icon name="sync-outline" />
        Revision Cycle Scheduled
      </h4>
      <p className="text-xs text-secondary-text">
        Topics from this sprint will appear in your flashcard deck and weekly quiz in 3 days.
      </p>
    </div>
  );
}
