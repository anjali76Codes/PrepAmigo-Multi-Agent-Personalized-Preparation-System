import type { Milestone } from '../../data/mockData';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

export function MilestoneTrack({ milestones }: { milestones: Milestone[] }) {
  return (
    <Card className="p-6 bg-surface border-border">
      <h3 className="text-lg font-bold text-primary-text mb-6">Milestone Track</h3>
      <div className="space-y-4 relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
        {milestones.map((m) => (
          <div key={m.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-surface bg-background shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
              <Icon name={m.unlocked ? 'checkmark-outline' : 'lock-closed-outline'} className={m.unlocked ? 'text-primary text-xl' : 'text-secondary-text/50'} />
            </div>
            
            <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-4 rounded-xl border transition-colors ${
              m.unlocked ? 'bg-primary/5 border-primary/20' : 'bg-background border-border opacity-75'
            }`}>
              <h4 className={`font-bold ${m.unlocked ? 'text-primary' : 'text-primary-text'}`}>{m.title}</h4>
              <p className="text-sm text-secondary-text mt-1">{m.condition}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
