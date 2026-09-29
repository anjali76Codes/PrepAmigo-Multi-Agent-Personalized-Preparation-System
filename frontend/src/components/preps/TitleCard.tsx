import type { Title } from '../../data/mockData';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

export function TitleCard({ titles }: { titles: Title[] }) {
  return (
    <Card className="p-6 bg-[var(--color-surface)] border-[var(--color-border)] h-full">
      <h3 className="text-lg font-bold text-[var(--color-forest-700)]-text mb-6">Equipped Title</h3>
      {titles.length > 0 ? (
        <div className="p-4 bg-[var(--color-navy-900)]/10 border border-primary/20 rounded-[var(--radius-card)] flex items-center justify-center gap-3">
          <Icon name="ribbon-outline" className="text-2xl text-[var(--color-forest-700)]" />
          <span className="text-xl font-bold text-[var(--color-forest-700)] tracking-wide uppercase">
            {titles[0].name}
          </span>
        </div>
      ) : (
        <div className="text-center py-8 text-[var(--color-navy-500)]">
          No titles earned yet.
        </div>
      )}
      <div className="mt-6 text-sm text-center">
        <button className="text-[var(--color-forest-700)] hover:underline font-medium">Change Title</button>
      </div>
    </Card>
  );
}
