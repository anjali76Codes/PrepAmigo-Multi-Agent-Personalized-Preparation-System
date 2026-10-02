import { cn } from '../../utils/utils';
import { Icon } from './Icon';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  tone?: 'default' | 'inverse';
}

export function Avatar({ className, src, fallback, size = 'md', tone = 'default', ...props }: AvatarProps) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-lg',
  };

  return (
    <div
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full',
        tone === 'inverse' ? 'bg-chrome-border' : 'bg-surface-muted',
        sizes[size],
        className
      )}
      {...props}
    >
      {src ? (
        <img
          src={src}
          className="aspect-square h-full w-full object-cover"
          alt={fallback || 'Avatar'}
        />
      ) : (
        <div className={cn("flex h-full w-full items-center justify-center font-medium", tone === 'inverse' ? 'text-on-chrome-muted' : 'text-carbon-500')}>
          {fallback ? (
            fallback.substring(0, 2).toUpperCase()
          ) : (
            <Icon name="person-outline" className="h-1/2 w-1/2" />
          )}
        </div>
      )}
    </div>
  );
}
