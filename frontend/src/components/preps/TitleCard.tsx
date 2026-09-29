import type { Title } from '../../data/mockData';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

export function TitleCard({ titles }: { titles: Title[] }) {
  return (
    <Card className="p-6 bg-surface border-border h-full">
      <h3 className="text-lg font-bold text-primary-text mb-6">Equipped Title</h3>
      {titles.length > 0 ? (
        <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center gap-3">
          <Icon name="ribbon-outline" className="text-2xl text-primary" />
          <span className="text-xl font-bold text-primary tracking-wide uppercase">
            {titles[0].name}
          </span>
        </div>
      ) : (
        <div className="text-center py-8 text-secondary-text">
          No titles earned yet.
        </div>
      )}
      <div className="mt-6 text-sm text-center">
        <button className="text-accent hover:underline font-medium">Change Title</button>
      </div>
    </Card>
  );
}
