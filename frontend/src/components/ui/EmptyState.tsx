import { cn } from '../../utils/utils';
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
      className={cn('flex flex-col items-center justify-center rounded-card border border-border bg-surface border-dashed p-8 text-center', className)}
      {...props}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-carbon-500 mb-4">
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold text-carbon-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-carbon-500 max-w-sm mb-4">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}
