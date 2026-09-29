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
          "relative flex flex-col bg-surface rounded-card border shadow-card transition-colors",
          text.length === 0 ? "p-3" : "p-2", // empty state padding
          disabled ? "border-border/50 opacity-80" : "border-border focus-within:border-violet-500/50 focus-within:ring-1 focus-within:ring-violet-500/50"
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
          className="w-full bg-transparent px-2 py-2 text-ink placeholder:text-plum-700 outline-none resize-none overflow-y-auto min-h-[40px] max-h-[150px]"
        />
        <div className="flex justify-end mt-1">
          <IconButton
            type="submit"
            icon="send"
            variant="primary"
            disabled={!text.trim() || disabled}
            isLoading={disabled}
            className="w-10 h-10 rounded-card shrink-0"
          />
        </div>
      </form>
      <div className="text-center mt-1">
        <span className="text-xs text-plum-700 opacity-80">PrepAmigo uses mock data in this demo.</span>
      </div>
    </div>
  );
}
