import type { Badge } from '../../data/mockData';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

export function BadgeGrid({ badges }: { badges: Badge[] }) {
  return (
    <Card variant="default" className="p-6 h-full">
      <h3 className="text-lg font-bold text-carbon-900 mb-6">Badges</h3>
      {badges.length > 0 ? (
        <div className="grid grid-cols-3 gap-4">
          {badges.map(badge => (
            <div key={badge.id} className="flex flex-col items-center text-center p-3 rounded-card bg-bg border border-border">
              <div className="w-12 h-12 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center mb-2">
                <Icon name={badge.icon} className="text-2xl" />
              </div>
              <span className="text-xs font-medium text-carbon-900">{badge.name}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-carbon-500">
          No badges earned yet. Keep learning!
        </div>
      )}
    </Card>
  );
}
