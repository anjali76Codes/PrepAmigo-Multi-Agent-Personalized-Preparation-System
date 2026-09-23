import React from 'react';
import { cn } from '../../lib/utils';
import { Icon } from '../ui/Icon';

export function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex w-full justify-end my-6 px-4 md:px-0">
      <div className="bg-elevated text-primary-text px-5 py-3.5 rounded-3xl rounded-br-sm max-w-[85%] md:max-w-[75%] border border-border shadow-sm text-[15px] leading-relaxed">
        {content}
      </div>
    </div>
  );
}

export function KajuMessage({ children, isThinking }: { children: React.ReactNode, isThinking?: boolean }) {
  return (
    <div className="flex w-full justify-start my-6 px-4 md:px-0 gap-4">
      <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow-primary mt-1">
        <Icon name="sparkles" className="text-white text-sm" />
      </div>
      <div className="flex-1 text-primary-text text-[15px] leading-relaxed max-w-[90%] md:max-w-[85%]">
        {isThinking ? (
          <div className="flex items-center gap-2 text-secondary-text h-8 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-accent/50"></span>
            <span className="w-2 h-2 rounded-full bg-accent/50 animation-delay-200"></span>
            <span className="w-2 h-2 rounded-full bg-accent/50 animation-delay-400"></span>
            <span className="text-sm font-medium ml-2">kaju is thinking...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

export function SuggestedPrompt({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-surface border border-border hover:border-accent/50 hover:bg-elevated px-4 py-3 rounded-full text-sm text-secondary-text hover:text-primary-text transition-all duration-300 w-full sm:w-auto"
    >
      "{text}"
    </button>
  );
}
