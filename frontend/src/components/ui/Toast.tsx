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
    default: 'bg-[var(--color-surface)]-elevated border-[var(--color-border)] text-[var(--color-forest-700)]-text',
    success: 'bg-[var(--color-surface)] border-success/30 text-[var(--color-forest-700)]-text',
    error: 'bg-[var(--color-surface)] border-error/30 text-[var(--color-forest-700)]-text',
    warning: 'bg-[var(--color-surface)] border-warning/30 text-[var(--color-forest-700)]-text',
    info: 'bg-[var(--color-surface)] border-info/30 text-[var(--color-forest-700)]-text',
  };

  const icons = {
    default: null,
    success: <Icon name="checkmark-circle-outline" className="h-5 w-5 text-success mt-0.5" />,
    error: <Icon name="warning-outline" className="h-5 w-5 text-[var(--color-danger-600)] mt-0.5" />,
    warning: <Icon name="alert-circle-outline" className="h-5 w-5 text-[var(--color-amber-600)] mt-0.5" />,
    info: <Icon name="information-circle-outline" className="h-5 w-5 text-info mt-0.5" />,
  };

  return (
    <div
      className={cn(
        'pointer-events-auto relative flex w-full max-w-sm items-start gap-3 rounded-[var(--radius-control)] border p-4 shadow-[var(--shadow-pop)] transition-all',
        variants[variant],
        className
      )}
      {...props}
    >
      {icons[variant]}
      <div className="flex-1">
        <h4 className="text-sm font-semibold">{title}</h4>
        {description && <p className="mt-1 text-sm text-[var(--color-navy-500)]">{description}</p>}
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
