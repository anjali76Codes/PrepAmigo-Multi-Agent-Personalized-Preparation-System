import { Icon } from '../ui/Icon';

export function RevisionCycles({ }: { sprintId: string }) {
  return (
    <div className="bg-lavender-100 rounded-card p-4 border border-chrome-border/20">
      <h4 className="text-sm font-semibold text-chrome flex items-center gap-2 mb-2">
        <Icon name="sync-outline" />
        Revision Cycle Scheduled
      </h4>
      <p className="text-xs text-carbon-500">
        Topics from this sprint will appear in your flashcard deck and weekly quiz in 3 days.
      </p>
    </div>
  );
}
