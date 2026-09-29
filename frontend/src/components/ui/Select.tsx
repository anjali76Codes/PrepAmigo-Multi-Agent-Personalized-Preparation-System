import React from "react";
import { cn } from '../../lib/utils';
import { Icon } from './Icon';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          className={cn(
            'flex h-10 w-full appearance-none rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] pl-3 pr-10 py-2 text-sm text-[var(--color-forest-700)]-text ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-error focus-visible:ring-error',
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--color-navy-500)]">
          <Icon name="chevron-down-outline" className="h-4 w-4" />
        </div>
      </div>
    );
  }
);
Select.displayName = 'Select';
