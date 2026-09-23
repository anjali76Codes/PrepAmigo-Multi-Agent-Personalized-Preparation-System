import React from 'react';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { cn } from '../../lib/utils';

export function AffectedItems({ items }: { items: any[] }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="flex flex-col">
      <h3 className="text-sm font-bold uppercase tracking-wider text-secondary-text mb-4">Affected Items</h3>
      <div className="space-y-3">
        {items.map(item => (
          <Card key={item.id} className={cn(
            "p-4 rounded-2xl flex items-start gap-4",
            item.status === 'error' ? "bg-error/5 border-error/20" : "bg-warning/5 border-warning/20"
          )}>
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
              item.status === 'error' ? "bg-error/10 text-error" : "bg-warning/10 text-warning"
            )}>
              <Icon name={item.status === 'error' ? 'close-circle-outline' : 'warning-outline'} className="text-xl" />
            </div>
            <div>
              <h4 className={cn(
                "font-bold text-sm",
                item.status === 'error' ? "text-error" : "text-warning"
              )}>
                {item.title}
              </h4>
              <p className="text-sm text-secondary-text mt-1">{item.description}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
