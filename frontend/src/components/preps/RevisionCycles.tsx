import { Icon } from '../ui/Icon';

export function RevisionCycles({ }: { sprintId: string }) {
  return (
    <div className="bg-[var(--color-forest-700)]/5 rounded-[var(--radius-card)] p-4 border border-accent/20">
      <h4 className="text-sm font-semibold text-[var(--color-forest-700)] flex items-center gap-2 mb-2">
        <Icon name="sync-outline" />
        Revision Cycle Scheduled
      </h4>
      <p className="text-xs text-[var(--color-navy-500)]">
        Topics from this sprint will appear in your flashcard deck and weekly quiz in 3 days.
      </p>
    </div>
  );
}
