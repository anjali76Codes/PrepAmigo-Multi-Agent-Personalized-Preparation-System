import React from "react";
import { cn } from '../../lib/utils';
import { Icon } from './Icon';

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (value: string) => void;
  tone?: 'default' | 'inverse';
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, onSearch, tone = 'default', ...props }, ref) => {
    return (
      <div className="relative w-full">
        <div className={cn("pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3", tone === 'inverse' ? 'text-on-chrome-muted' : 'text-carbon-500')}>
          <Icon name="search-outline" className="h-4 w-4" />
        </div>
        <input
          type="search"
          className={cn(
            'flex h-10 w-full rounded-control py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            tone === 'inverse'
              ? 'bg-chrome-hover border border-chrome-border pl-10 pr-3 text-on-chrome placeholder:text-on-chrome-muted focus-visible:ring-chrome-accent'
              : 'bg-surface border border-border pl-10 pr-3 text-carbon-900 placeholder:text-carbon-500 focus-visible:ring-forest-700',
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
