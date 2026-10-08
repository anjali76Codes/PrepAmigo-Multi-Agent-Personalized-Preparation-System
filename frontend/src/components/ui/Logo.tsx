import { cn } from '../../utils/utils';
import { Mascot } from './Mascot';

export interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  compact?: boolean;
  tone?: 'default' | 'inverse';
}

export function Logo({ className, compact = false, tone = 'default', ...props }: LogoProps) {
  const isInverse = tone === 'inverse';
  return (
    <div className={cn('flex items-center gap-2 select-none', className)} {...props}>
      <div className={cn("relative flex h-15 w-15 items-center justify-center rounded-full shadow-pop overflow-hidden", isInverse ? "bg-chrome text-chrome" : "bg-soft-rose text-white")}>
        {/* <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 text-current"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg> */}
        <Mascot variant="nosy.png" style={{ width: "auto", height: "auto" }} />
      </div>
      {!compact && (
        <span className={cn("font-bold tracking-tight text-xl", isInverse ? "text-on-chrome" : "text-carbon-900")}>
          PrepAmigo
        </span>
      )}
    </div>
  );
}
