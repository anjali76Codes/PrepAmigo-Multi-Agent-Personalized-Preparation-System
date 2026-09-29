import { useState, useRef, useEffect } from 'react';
import { IconButton } from '../ui/IconButton';
import { cn } from '../../lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function ChatInput({ onSend, disabled, placeholder = "Message PrepAmigo...", className }: ChatInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
  };

  return (
    <div className={cn("flex flex-col gap-2 w-full", className)}>
      <form 
        onSubmit={handleSubmit} 
        className={cn(
          "relative flex flex-col bg-white rounded-[2rem] border shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all",
          text.length === 0 ? "p-4" : "p-3",
          disabled ? "border-border/50 opacity-80" : "border-border hover:border-chrome-accent/30 focus-within:border-chrome-accent focus-within:ring-4 focus-within:ring-chrome-accent/10"
        )}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className="w-full bg-transparent px-3 py-2 text-carbon-900 placeholder:text-carbon-500/70 text-base leading-relaxed outline-none resize-none overflow-y-auto min-h-[40px] max-h-[150px] scrollbar-thin"
        />
        <div className="flex justify-end mt-2 px-1">
          <IconButton
            type="submit"
            icon="arrow-up"
            variant="primary"
            disabled={!text.trim() || disabled}
            isLoading={disabled}
            className="w-10 h-10 rounded-full bg-chrome-accent hover:bg-chrome-accent/90 disabled:bg-surface-muted disabled:text-carbon-400 text-white shadow-sm transition-all"
          />
        </div>
      </form>
      <div className="text-center mt-2">
        <span className="text-xs font-medium text-carbon-500 opacity-80">PrepAmigo uses mock data in this demo.</span>
      </div>
    </div>
  );
}
