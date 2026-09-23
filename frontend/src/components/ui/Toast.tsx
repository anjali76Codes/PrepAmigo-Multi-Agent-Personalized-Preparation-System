import React from 'react';
import { cn } from '../../lib/utils';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
  onClose?: () => void;
}

export function Toast({ className, variant = 'default', title, description, onClose, ...props }: ToastProps) {
  const variants = {
    default: 'bg-surface-elevated border-border text-primary-text',
    success: 'bg-surface border-success/30 text-primary-text',
    error: 'bg-surface border-error/30 text-primary-text',
    warning: 'bg-surface border-warning/30 text-primary-text',
    info: 'bg-surface border-info/30 text-primary-text',
  };

  const icons = {
    default: null,
    success: <Icon name="checkmark-circle-outline" className="h-5 w-5 text-success mt-0.5" />,
    error: <Icon name="warning-outline" className="h-5 w-5 text-error mt-0.5" />,
    warning: <Icon name="alert-circle-outline" className="h-5 w-5 text-warning mt-0.5" />,
    info: <Icon name="information-circle-outline" className="h-5 w-5 text-info mt-0.5" />,
  };

  return (
    <div
      className={cn(
        'pointer-events-auto relative flex w-full max-w-sm items-start gap-3 rounded-lg border p-4 shadow-lg transition-all',
        variants[variant],
        className
      )}
      {...props}
    >
      {icons[variant]}
      <div className="flex-1">
        <h4 className="text-sm font-semibold">{title}</h4>
        {description && <p className="mt-1 text-sm text-secondary-text">{description}</p>}
      </div>
      {onClose && (
        <IconButton
          icon="close-outline"
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="-mt-1 -mr-1"
        />
      )}
    </div>
  );
}
