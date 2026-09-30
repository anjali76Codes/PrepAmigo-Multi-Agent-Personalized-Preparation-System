import { useState, useRef, useEffect } from "react";
import { IconButton } from "../ui/IconButton";
import { Icon } from "../ui/Icon";
import { cn } from "../../lib/utils";

interface OptionCategory {
  id: string;
  label: string;
  options: { label: string; prompt: string; icon?: string }[];
}

const PREP_OPTIONS: OptionCategory[] = [
  {
    id: "track",
    label: "Target Track",
    options: [
      {
        label: "Frontend SDE",
        prompt:
          "I am preparing for a Senior Frontend Engineer role focusing on React and Web Performance in 30 days",
        icon: "code-slash",
      },
      {
        label: "Backend & Cloud",
        prompt:
          "I have a Backend Engineer interview covering Distributed Systems, Java Spring Boot & AWS",
        icon: "server",
      },
      {
        label: "DSA & Algorithms",
        prompt:
          "I need a 45-day structured DSA roadmap from beginner to advanced graphs and dynamic programming",
        icon: "git-network",
      },
      {
        label: "System Design",
        prompt:
          "Build me an intensive System Design prep plan covering High-Scale Architecture and CAP theorem",
        icon: "layers",
      },
    ],
  },
  {
    id: "timeline",
    label: "Timeline",
    options: [
      {
        label: "2-Week Sprint",
        prompt:
          "I have an urgent interview in 2 weeks, create a fast-paced crash course",
        icon: "flash",
      },
      {
        label: "30-Day Plan",
        prompt: "I have 30 days to prepare with 2 hours daily study time",
        icon: "calendar",
      },
      {
        label: "45-Day Mastery",
        prompt: "I have 45 days to prepare for SDE at Company X",
        icon: "rocket",
      },
    ],
  },
  {
    id: "focus",
    label: "Goal Mode",
    options: [
      {
        label: "⚡ Build Full Roadmap",
        prompt:
          "I want a complete personalized roadmap tailored to my target company requirements",
        icon: "trail-sign",
      },
      {
        label: "🎯 Fix Weak Areas",
        prompt:
          "I scored badly on my DSA quiz, adjust my plan to focus on my weak topics",
        icon: "fitness",
      },
      {
        label: "🧠 Daily Flashcards",
        prompt:
          "Give me revision cards for system design and core interview patterns",
        icon: "albums",
      },
    ],
  },
];

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  showOptions?: boolean;
}

export function ChatInput({
  onSend,
  disabled,
  placeholder = "Message PrepAmigo...",
  className,
  showOptions = true,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("track");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
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
    setText("");
    setSelectedOption(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
  };

  const handleSelectOption = (label: string, promptText: string) => {
    setSelectedOption(label);
    setText(promptText);
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
    }
  };

  const currentCategoryObj = PREP_OPTIONS.find((c) => c.id === activeCategory);

  return (
    <div className={cn("flex flex-col gap-3 w-full", className)}>
      <form
        onSubmit={handleSubmit}
        className={cn(
          "relative flex flex-col bg-white rounded-[2rem] border shadow-[0_12px_40px_rgba(24,18,43,0.06)] transition-all",
          "p-3 md:p-3.5",
          disabled
            ? "border-border/50 opacity-80"
            : "border-border hover:border-chrome-accent/40 focus-within:border-chrome-accent focus-within:ring-4 focus-within:ring-chrome-accent/15",
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
          className="w-full bg-transparent px-2 py-0.5 text-carbon-900 placeholder:text-carbon-500/70 text-sm md:text-base leading-relaxed outline-none resize-none overflow-y-auto min-h-[36px] max-h-[120px] scrollbar-thin"
        />

        {/* Action Bottom Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 mt-1 border-t border-border/40">
          {/* Specific Mode / Category Picker inside the chatbox */}
          {showOptions && (
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full">
              {PREP_OPTIONS.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 shrink-0",
                    activeCategory === cat.id
                      ? "bg-navy-900 text-white shadow-sm"
                      : "bg-surface-muted/80 text-carbon-500 hover:bg-surface-muted hover:text-carbon-900",
                  )}
                >
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <IconButton
              type="submit"
              icon="arrow-up"
              variant="primary"
              disabled={!text.trim() || disabled}
              isLoading={disabled}
              className="w-10 h-10 rounded-full bg-navy-900 hover:bg-navy-700 disabled:bg-surface-muted disabled:text-carbon-400 text-white shadow-md transition-all flex items-center justify-center"
            />
          </div>
        </div>

        {/* Specific Option Pills under the toolbar inside the chatbox */}
        {showOptions && currentCategoryObj && (
          <div className="flex flex-wrap gap-1.5 pt-2.5 mt-2 border-t border-border/20">
            {currentCategoryObj.options.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => handleSelectOption(opt.label, opt.prompt)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-full transition-all flex items-center gap-1.5 border text-left",
                  selectedOption === opt.label
                    ? "bg-forest-100 text-forest-800 border-forest-700/30 font-semibold shadow-xs"
                    : "bg-bg/60 hover:bg-forest-100/60 text-carbon-700 border-border/70 hover:border-forest-700/20",
                )}
              >
                {opt.icon && (
                  <Icon name={opt.icon} className="text-xs text-forest-700" />
                )}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        )}
      </form>

      <div className="flex items-center justify-center gap-2 text-xs text-carbon-500/80">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-forest-700"></span>
        <span>Adaptive Multi-Agent Reasoning Engine active</span>
      </div>
    </div>
  );
}
