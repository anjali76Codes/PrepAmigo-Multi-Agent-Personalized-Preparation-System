import { useState } from 'react';
import { Icon } from '../ui/Icon';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 bg-[var(--color-surface)] p-2 rounded-[var(--radius-card)] border border-[var(--color-border)] shadow-[var(--shadow-card)] focus-within:border-primary/50 transition-colors">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        placeholder="Type a message or select a suggestion..."
        className="flex-1 bg-transparent px-4 py-2 text-[var(--color-forest-700)]-text placeholder:text-[var(--color-navy-500)] outline-none"
      />
      <button
        type="submit"
        disabled={!text.trim() || disabled}
        className="w-10 h-10 rounded-[var(--radius-card)] bg-[var(--color-navy-900)] text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--color-navy-900)]/90 transition-colors shrink-0"
      >
        <Icon name="send" />
      </button>
    </form>
  );
}
