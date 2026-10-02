import { cn } from '../../utils/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-control bg-surface-muted', className)}
      {...props}
    />
  );
}
