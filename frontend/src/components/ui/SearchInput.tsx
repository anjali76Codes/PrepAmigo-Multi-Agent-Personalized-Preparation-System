import React from 'react';
import { cn } from '../../lib/utils';
import { Icon } from './Icon';

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (value: string) => void;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, onSearch, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-secondary-text">
          <Icon name="search-outline" className="h-4 w-4" />
        </div>
        <input
          type="search"
          className={cn(
            'flex h-10 w-full rounded-md border border-border bg-surface pl-10 pr-3 py-2 text-sm text-primary-text ring-offset-background placeholder:text-muted-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
          ref={ref}
          {...props}
          onChange={(e) => {
            props.onChange?.(e);
            onSearch?.(e.target.value);
          }}
        />
      </div>
    );
  }
);
SearchInput.displayName = 'SearchInput';
