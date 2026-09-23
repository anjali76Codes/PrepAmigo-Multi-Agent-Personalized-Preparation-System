import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'outline';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-surface-elevated text-primary-text',
    primary: 'bg-primary/20 text-accent border border-primary/30',
    secondary: 'bg-border text-secondary-text',
    outline: 'text-secondary-text border border-border',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-accent',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
