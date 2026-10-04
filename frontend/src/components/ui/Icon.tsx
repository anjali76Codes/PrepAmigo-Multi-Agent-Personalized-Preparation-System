import { cn } from '../../utils/utils';

export interface IconProps extends React.HTMLAttributes<HTMLElement> {
  name: string;
  className?: string;
  tone?: 'default' | 'inverse';
}

export function Icon({ name, className, tone = 'default', ...props }: IconProps) {
  return (
    <ion-icon
      name={name}
      className={cn('inline-block pointer-events-none select-none', tone === 'inverse' ? 'text-on-chrome' : 'text-current', className)}
      {...props}
    />
  );
}
