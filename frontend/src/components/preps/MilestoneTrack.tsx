import type { Milestone } from '../../data/mockData';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

export function MilestoneTrack({ milestones }: { milestones: Milestone[] }) {
  return (
    <Card className="p-6 bg-[var(--color-surface)] border-[var(--color-border)]">
      <h3 className="text-lg font-bold text-[var(--color-forest-700)]-text mb-6">Milestone Track</h3>
      <div className="space-y-4 relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
        {milestones.map((m) => (
          <div key={m.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-surface bg-[var(--color-bg)] shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-[var(--shadow-card)] z-10">
              <Icon name={m.unlocked ? 'checkmark-outline' : 'lock-closed-outline'} className={m.unlocked ? 'text-[var(--color-forest-700)] text-xl' : 'text-[var(--color-navy-500)]/50'} />
            </div>
            
            <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-4 rounded-[var(--radius-card)] border transition-colors ${
              m.unlocked ? 'bg-[var(--color-navy-900)]/5 border-primary/20' : 'bg-[var(--color-bg)] border-[var(--color-border)] opacity-75'
            }`}>
              <h4 className={`font-bold ${m.unlocked ? 'text-[var(--color-forest-700)]' : 'text-[var(--color-forest-700)]-text'}`}>{m.title}</h4>
              <p className="text-sm text-[var(--color-navy-500)] mt-1">{m.condition}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
