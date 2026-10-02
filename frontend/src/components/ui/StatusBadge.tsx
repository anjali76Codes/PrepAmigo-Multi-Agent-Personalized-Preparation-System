import { cn } from '../../utils/utils';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: 'success' | 'warning' | 'error' | 'info' | 'default';
}

export function StatusBadge({ className, status, children, ...props }: StatusBadgeProps) {
  const variants = {
    success: 'bg-navy-100 text-navy-800 border-navy-700/20',
    warning: 'bg-beige-100 text-beige-600 border-beige-600/20',
    error: 'bg-danger-100 text-danger-600 border-danger-600/20',
    info: 'bg-navy-100 text-navy-900 border-navy-500/20',
    default: 'bg-surface-muted text-carbon-500 border-border',
  };
  
  const dotColors = {
    success: 'bg-navy-700',
    warning: 'bg-beige-600',
    error: 'bg-danger-600',
    info: 'bg-navy-500',
    default: 'bg-carbon-500',
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
