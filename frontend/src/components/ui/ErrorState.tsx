import React from 'react';
import { cn } from '../../lib/utils';
import { Icon } from './Icon';
import { Button } from './Button';

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({ className, title = 'Something went wrong', description = 'An error occurred while loading this content. Please try again.', onRetry, ...props }: ErrorStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center rounded-xl border border-error/20 bg-error/5 p-8 text-center', className)}
      {...props}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error/10 text-error mb-4">
        <Icon name="warning-outline" className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold text-primary-text mb-1">{title}</h3>
      <p className="text-sm text-secondary-text max-w-sm mb-4">{description}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          <Icon name="refresh-outline" className="mr-2" />
          Try Again
        </Button>
      )}
    </div>
  );
}
