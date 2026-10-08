import type { Title } from '../../data/mockData';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

export function TitleCard({ titles }: { titles: Title[] }) {
  return (
    <Card variant="default" className="p-6 h-full">
      <h3 className="text-lg font-bold text-carbon-900 mb-6">Equipped Title</h3>
      {titles.length > 0 ? (
        <div className="p-4 bg-soft-rose border border-expresso/20 rounded-card flex items-center justify-center gap-3">
          <Icon name="ribbon-outline" className="text-2xl text-expresso" />
          <span className="text-xl font-bold text-expresso tracking-wide uppercase">
            {titles[0].name}
          </span>
        </div>
      ) : (
        <div className="text-center py-8 text-carbon-500">
          No titles earned yet.
        </div>
      )}
      <div className="mt-6 text-sm text-center">
        <button className="text-expresso hover:underline font-medium">Change Title</button>
      </div>
    </Card>
  );
}
