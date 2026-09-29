import type { ResourcePack as ResourcePackType } from '../../data/mockData';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

interface ResourcePackProps {
  pack: ResourcePackType;
}

export function ResourcePack({ pack }: ResourcePackProps) {
  return (
    <Card variant="default" className="p-6">
      <h3 className="text-xl font-bold text-carbon-900 mb-6 flex items-center gap-2">
        <Icon name="folder-open-outline" className="text-forest-700" />
        {pack.topic}
      </h3>
      <div className="space-y-8">
        {pack.groups.map((group, idx) => (
          <div key={idx}>
            <h4 className="text-sm font-semibold text-carbon-500 uppercase tracking-wider mb-4 border-b border-border pb-2">
              {group.purpose}
            </h4>
            <div className="grid gap-4">
              {group.items.map(item => (
                <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="block group">
                  <div className="p-4 rounded-card border border-border bg-bg group-hover:border-forest-700/40 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-carbon-900 group-hover:text-forest-700 transition-colors flex items-center gap-2">
                        <Icon name={item.type === 'video' ? 'play-circle-outline' : item.type === 'article' ? 'document-text-outline' : 'book-outline'} />
                        {item.title}
                      </div>
                      <span className="text-xs bg-surface px-2 py-1 rounded-control text-carbon-500">
                        {item.estimatedMinutes}m
                      </span>
                    </div>
                    <p className="text-sm text-carbon-500">{item.whyThisOne}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
