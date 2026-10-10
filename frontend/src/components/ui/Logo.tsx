import { cn } from '../../utils/utils';
import { Mascot } from './Mascot';

export interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  compact?: boolean;
  tone?: 'default' | 'inverse';
  size?: number;
}

export function Logo({ className, compact = false, tone = 'default', size = 60, ...props }: LogoProps) {
  const isInverse = tone === 'inverse';
  return (
    <div className={cn('flex items-center gap-2 select-none', className)} {...props}>
      <div
        style={{ width: size, height: size }}
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-full shadow-pop overflow-hidden",
          isInverse ? "bg-chrome text-chrome" : "bg-soft-rose text-white"
        )}
      >
        <Mascot variant="nosy.png" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </div>
      {!compact && (
        <span className={cn("font-bold tracking-tight text-xl", isInverse ? "text-on-chrome" : "text-carbon-900")}>
          PrepAmigo
        </span>
      )}
    </div>
  );
}
