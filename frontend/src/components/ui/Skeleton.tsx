import { cn } from '../../lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-[var(--radius-control)] bg-[var(--color-surface)]-elevated', className)}
      {...props}
    />
  );
}
