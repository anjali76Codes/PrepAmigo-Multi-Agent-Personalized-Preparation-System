import { cn } from '../../lib/utils';

export interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  compact?: boolean;
}

export function Logo({ className, compact = false, ...props }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2 select-none', className)} {...props}>
      <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-soft-primary">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 text-white"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>
      {!compact && (
        <span className="font-bold tracking-tight text-xl bg-gradient-to-r from-primary-text to-secondary-text bg-clip-text text-transparent">
          PrepAmigo
        </span>
      )}
    </div>
  );
}
