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
            'flex h-10 w-full appearance-none rounded-control border border-border bg-surface pl-3 pr-10 py-2 text-sm text-carbon-900 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-danger-600 focus-visible:ring-danger-600',
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-carbon-500">
          <Icon name="chevron-down-outline" className="h-4 w-4" />
        </div>
      </div>
    );
  }
);
Select.displayName = 'Select';
