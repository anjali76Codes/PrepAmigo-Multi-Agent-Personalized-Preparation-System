import React, { useEffect } from 'react';
import { cn } from '../../lib/utils';
import { IconButton } from './IconButton';

export interface ModalProps extends React.HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Modal({ className, isOpen, onClose, title, children, ...props }: ModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          'relative z-50 w-full max-w-lg rounded-xl border border-border bg-surface-elevated p-6 shadow-xl transition-all',
          className
        )}
        role="dialog"
        aria-modal="true"
        {...props}
      >
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          <IconButton
            icon="close-outline"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute right-4 top-4"
          />
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
