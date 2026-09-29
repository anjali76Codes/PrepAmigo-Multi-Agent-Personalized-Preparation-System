import { useState } from 'react';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';

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
    <form onSubmit={handleSubmit} className="flex gap-2 bg-surface p-2 rounded-card border border-border shadow-card focus-within:border-forest-700/50 transition-colors">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        placeholder="Type a message or select a suggestion..."
        className="flex-1 bg-transparent px-4 py-2 text-carbon-900 placeholder:text-carbon-500 outline-none"
      />
      <Button
        type="submit"
        variant="primary"
        disabled={!text.trim() || disabled}
        className="w-10 h-10 p-0 flex items-center justify-center shrink-0 rounded-card"
      >
        <Icon name="send" />
      </Button>
    </form>
  );
}
