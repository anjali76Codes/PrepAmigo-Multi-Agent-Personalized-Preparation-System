import { cn } from '../../utils/utils';
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
      className={cn('flex flex-col items-center justify-center rounded-card border border-danger-600/20 bg-danger-100 p-8 text-center', className)}
      {...props}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-600/10 text-danger-600 mb-4">
        <Icon name="warning-outline" className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold text-carbon-900 mb-1">{title}</h3>
      <p className="text-sm text-carbon-500 max-w-sm mb-4">{description}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <Icon name="refresh-outline" className="mr-2" />
          Try Again
        </Button>
      )}
    </div>
  );
}
