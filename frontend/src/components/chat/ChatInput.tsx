import React, { useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Icon } from '../ui/Icon';

export interface ChatInputProps extends React.FormHTMLAttributes<HTMLFormElement> {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading?: boolean;
}

export function ChatInput({ value, onChange, onSubmit, isLoading, className, ...props }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'inherit';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(scrollHeight, 120) + 'px';
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isLoading) {
        onSubmit(e);
      }
    }
  };

  return (
    <form 
      onSubmit={onSubmit} 
      className={cn(
        'relative flex items-end bg-elevated border border-border rounded-3xl transition-all duration-300 focus-within:ring-1 focus-within:ring-accent/50 focus-within:border-accent shadow-lg p-2',
        className
      )}
      {...props}
    >
      <button 
        type="button" 
        className="shrink-0 p-2 text-secondary-text hover:text-primary-text transition-colors h-10 w-10 flex items-center justify-center rounded-full hover:bg-surface"
        aria-label="Attach file"
      >
        <Icon name="add-outline" className="text-xl" />
      </button>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="What changed with your trip?"
        className="flex-1 max-h-[120px] bg-transparent border-none outline-none text-base text-primary-text placeholder:text-muted-text resize-none py-2.5 px-2 overflow-y-auto"
        rows={1}
        disabled={isLoading}
      />

      <button 
        type="submit" 
        disabled={!value.trim() || isLoading}
        className="shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-accent text-background disabled:opacity-50 disabled:bg-surface disabled:text-secondary-text transition-all hover:bg-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent"
      >
        {isLoading ? (
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <Icon name="arrow-up-outline" className="text-lg" />
        )}
      </button>
    </form>
  );
}
