import { cn } from '../../lib/utils';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: 'success' | 'warning' | 'error' | 'info' | 'default';
}

export function StatusBadge({ className, status, children, ...props }: StatusBadgeProps) {
  const variants = {
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-[var(--color-amber-600)]/10 text-[var(--color-amber-600)] border-warning/20',
    error: 'bg-[var(--color-danger-600)]/10 text-[var(--color-danger-600)] border-error/20',
    info: 'bg-info/10 text-info border-info/20',
    default: 'bg-[var(--color-surface)]-elevated text-[var(--color-navy-500)] border-[var(--color-border)]',
  };
  
  const dotColors = {
    success: 'bg-success',
    warning: 'bg-[var(--color-amber-600)]',
    error: 'bg-[var(--color-danger-600)]',
    info: 'bg-info',
    default: 'bg-secondary-text',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        variants[status],
        className
      )}
      {...props}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', dotColors[status])} aria-hidden="true" />
      {children}
    </div>
  );
}
