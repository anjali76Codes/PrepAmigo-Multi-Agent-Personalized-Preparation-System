import { cn } from '../../lib/utils';

export interface IconProps extends React.HTMLAttributes<HTMLElement> {
  name: string;
  className?: string;
}

export function Icon({ name, className, ...props }: IconProps) {
  return (
    <ion-icon
      name={name}
      className={cn('text-current inline-block', className)}
      {...props}
    />
  );
}
