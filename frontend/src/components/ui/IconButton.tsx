import React from 'react';
import { cn } from '../../lib/utils';
import { Icon } from './Icon';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, icon, variant = 'ghost', size = 'md', isLoading, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50';
    
    const variants = {
      primary: 'bg-primary text-primary-text hover:bg-primary-hover shadow-glow-primary hover:shadow-glow-accent',
      secondary: 'bg-surface-elevated text-primary-text hover:bg-border border border-border',
      ghost: 'hover:bg-surface-elevated text-secondary-text hover:text-primary-text',
      danger: 'bg-error/10 text-error hover:bg-error/20 border border-error/20',
    };
    
    const sizes = {
      sm: 'h-8 w-8 text-lg',
      md: 'h-10 w-10 text-xl',
      lg: 'h-12 w-12 text-2xl',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <svg className="animate-spin h-1/2 w-1/2 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <Icon name={icon} />
        )}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
