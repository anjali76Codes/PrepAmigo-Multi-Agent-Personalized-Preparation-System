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
    default: 'bg-surface shadow-pop border-border text-carbon-900',
    success: 'bg-surface border-navy-700/30 text-carbon-900',
    error: 'bg-surface border-danger-600/30 text-carbon-900',
    warning: 'bg-surface border-beige-600/30 text-carbon-900',
    info: 'bg-surface border-navy-500/30 text-carbon-900',
  };

  const icons = {
    default: null,
    success: <Icon name="checkmark-circle-outline" className="h-5 w-5 text-navy-700 mt-0.5" />,
    error: <Icon name="warning-outline" className="h-5 w-5 text-danger-600 mt-0.5" />,
    warning: <Icon name="alert-circle-outline" className="h-5 w-5 text-beige-600 mt-0.5" />,
    info: <Icon name="information-circle-outline" className="h-5 w-5 text-navy-500 mt-0.5" />,
  };

  return (
    <div
      className={cn(
        'pointer-events-auto relative flex w-full max-w-sm items-start gap-3 rounded-control border p-4 shadow-pop transition-all',
        variants[variant],
        className
      )}
      {...props}
    >
      {icons[variant]}
      <div className="flex-1">
        <h4 className="text-sm font-semibold">{title}</h4>
        {description && <p className="mt-1 text-sm text-carbon-500">{description}</p>}
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
