import React from 'react';
import { cn } from '../../lib/utils';
import { Icon } from './Icon';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ className, icon = 'folder-open-outline', title, description, action, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center rounded-xl border border-border bg-surface border-dashed p-8 text-center', className)}
      {...props}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-elevated text-secondary-text mb-4">
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold text-primary-text mb-1">{title}</h3>
      {description && <p className="text-sm text-secondary-text max-w-sm mb-4">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}
