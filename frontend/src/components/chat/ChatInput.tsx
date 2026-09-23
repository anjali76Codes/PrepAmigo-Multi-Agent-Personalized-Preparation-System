import React, { useRef, useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { Icon } from '../ui/Icon';

export interface ChatInputProps
  extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'onChange' | 'onSubmit'> {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading?: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  className,
  ...props
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'inherit';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(scrollHeight, 200) + 'px';
    }
  }, [value]);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMenuOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      if ((value.trim() || attachments.length > 0) && !isLoading) {
        onSubmit(e);
        // Clear attachments on submit (assuming parent handles it or this is just for show)
        setAttachments([]);
      }
    }
  };

  const handleMenuToggle = () => {
    if (!isLoading) {
      setIsMenuOpen((prev) => !prev);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
    setIsMenuOpen(false);
    // Reset input value so the same file can be selected again
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <form
      onSubmit={(e) => {
        onSubmit(e);
        if (!isLoading) {
          setAttachments([]);
        }
      }}
      className={cn(
        'relative flex flex-col w-full',
        'bg-black/70 backdrop-blur-xl',
        'border-4 border-white/10',
        'rounded-[1.5rem]',
        'shadow-lg',
        'transition-all',
        'focus-within:border-primary/50',
        'focus-within:ring-2',
        'focus-within:ring-primary/30',
        'p-2',
        className
      )}
      {...props}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        multiple
        onChange={handleFileSelect}
      />
      <input
        type="file"
        ref={imageInputRef}
        className="hidden"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
      />

      {/* Attachments Display */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-2 pb-1">
          {attachments.map((file, idx) => (
            <div key={idx} className="flex items-center gap-1.5 bg-surface/80 border border-white/10 rounded-lg px-2 py-1.5 shadow-sm">
              <Icon name={file.type.startsWith('image/') ? 'image-outline' : 'document-text-outline'} className="text-secondary-text text-sm" />
              <span className="truncate max-w-[120px] text-xs font-medium text-primary-text">{file.name}</span>
              <button
                type="button"
                onClick={() => removeAttachment(idx)}
                className="text-secondary-text hover:text-white transition-colors ml-1 h-4 w-4 flex items-center justify-center rounded-full hover:bg-white/10"
              >
                <Icon name="close-outline" className="text-xs" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="What changed with your trip?"
        className="
          w-full
          max-h-[200px]
          bg-transparent
          border-none
          outline-none
          text-white/70
          sm:text-lg
          text-primary-text
          placeholder:text-muted-text
          resize-none
          py-2
          px-3
          overflow-y-auto
        "
        rows={1}
        disabled={isLoading}
      />

      {/* Bottom controls */}
      <div className="flex items-center justify-between px-1 pt-2">
        {/* Attachment button + menu */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={handleMenuToggle}
            disabled={isLoading}
            aria-label="Add attachment"
            aria-expanded={isMenuOpen}
            className={cn(
              'group',
              'h-9 w-9',
              'flex items-center justify-center',
              'rounded-full',
              'transition-all duration-200',
              'focus:outline-none',
              'focus-visible:ring-2',
              'focus-visible:ring-primary/40',
              isMenuOpen
                ? 'bg-white/10 text-primary-text rotate-45'
                : 'text-secondary-text hover:text-primary-text hover:bg-white/5',
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Icon
              name="add-outline"
              className="text-xl transition-transform duration-200"
            />
          </button>

          {/* Attachment menu */}
          {isMenuOpen && (
            <div
              className="
                absolute
                bottom-[calc(100%+0.75rem)]
                left-0
                w-52
                p-1.5
                rounded-2xl
                shadow-2xl
                z-50
                origin-bottom-left
                animate-in
                fade-in
                zoom-in-95
                slide-in-from-bottom-2
                duration-150
                bg-black
              "
            >
              {/* Menu header */}
              <div className="px-3 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-text">
                  Add to trip
                </span>
              </div>

              {/* Document */}
              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                className="
                  w-full
                  flex items-center gap-3
                  rounded-xl
                  px-3 py-2.5
                  text-left
                  transition-colors
                  hover:bg-white/10
                  group
                "
              >
                <span
                  className="
                    h-9 w-9
                    shrink-0
                    rounded-lg
                    bg-white/5
                    border border-white/5
                    flex items-center justify-center
                    text-secondary-text
                    group-hover:text-primary-text
                    group-hover:bg-white/10
                    transition-colors
                  "
                >
                  <Icon
                    name="document-text-outline"
                    className="text-lg"
                  />
                </span>

                <span className="flex flex-col">
                  <span className="text-sm font-medium text-primary-text">
                    Document
                  </span>
                  <span className="text-xs text-muted-text">
                    PDF, DOCX, TXT
                  </span>
                </span>
              </button>

              {/* Photo */}
              <button
                type="button"
                onClick={() => {
                  imageInputRef.current?.click();
                }}
                className="
                  w-full
                  flex items-center gap-3
                  rounded-xl
                  px-3 py-2.5
                  text-left
                  transition-colors
                  hover:bg-white/10
                  group
                "
              >
                <span
                  className="
                    h-9 w-9
                    shrink-0
                    rounded-lg
                    bg-white/5
                    border border-white/5
                    flex items-center justify-center
                    text-secondary-text
                    group-hover:text-primary-text
                    group-hover:bg-white/10
                    transition-colors
                  "
                >
                  <Icon
                    name="image-outline"
                    className="text-lg"
                  />
                </span>

                <span className="flex flex-col">
                  <span className="text-sm font-medium text-primary-text">
                    Photo
                  </span>
                  <span className="text-xs text-muted-text">
                    JPG, PNG, WEBP
                  </span>
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={(!value.trim() && attachments.length === 0) || isLoading}
          className={cn(
            'shrink-0',
            'h-9 w-9',
            'flex items-center justify-center',
            'rounded-full',
            'transition-all duration-200',
            'focus:outline-none',
            'focus-visible:ring-2',
            'focus-visible:ring-primary/40',
            (value.trim() || attachments.length > 0) && !isLoading
              ? 'bg-primary text-white hover:bg-primary/90 hover:scale-105 shadow-sm'
              : 'bg-white/5 text-secondary-text cursor-not-allowed'
          )}
        >
          {isLoading ? (
            <Icon
              name="sync-outline"
              className="animate-spin text-lg"
            />
          ) : (
            <Icon
              name="arrow-up-outline"
              className="text-lg"
            />
          )}
        </button>
      </div>
    </form>
  );
}