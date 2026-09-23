import React, { useEffect } from 'react';
import { cn } from '../../lib/utils';
import { IconButton } from './IconButton';

export interface DrawerProps extends React.HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Drawer({ className, isOpen, onClose, title, children, ...props }: DrawerProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          'relative z-50 h-full w-full max-w-md border-l border-border bg-surface-elevated p-6 shadow-xl transition-transform',
          className
        )}
        role="dialog"
        aria-modal="true"
        {...props}
      >
        <div className="mb-6 flex items-center justify-between">
          {title && <h2 className="text-xl font-semibold">{title}</h2>}
          <IconButton
            icon="close-outline"
            variant="ghost"
            size="sm"
            onClick={onClose}
          />
        </div>
        <div className="h-full overflow-y-auto pb-10">{children}</div>
      </div>
    </div>
  );
}
