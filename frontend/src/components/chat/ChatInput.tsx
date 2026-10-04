import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "../../utils/utils";

// ─── Native SVG Icons (reliable, zero flicker, consistent fill/stroke) ────────

function ArrowUpIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={cn("pointer-events-none select-none shrink-0", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );
}

function MicIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={cn("pointer-events-none select-none shrink-0", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function SquareIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={cn("pointer-events-none select-none shrink-0", className)}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}



// ─── Slash Templates ─────────────────────────────────────────────────────────

const SLASH_TEMPLATES = [
  {
    id: "role-only",
    label: "Know the role, not the company",
    template: "I am preparing for a [Role] position in [Timeline] days.",
  },
  {
    id: "company-only",
    label: "Know the company, not the role",
    template:
      "I have an interview at [Company] in [Timeline] days, help me figure out what to prep.",
  },
  {
    id: "both",
    label: "Know both the role and company",
    template:
      "I am preparing for a [Role] at [Company] in [Timeline] days.",
  },
] as const;

// ─── Placeholder Helpers ──────────────────────────────────────────────────────

/** Returns all [placeholder] ranges in a string, ordered by position. */
function getPlaceholders(text: string): Array<{ start: number; end: number }> {
  const regex = /\[[^\]]+\]/g;
  const results: Array<{ start: number; end: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    results.push({ start: match.index, end: match.index + match[0].length });
  }
  return results;
}

/**
 * Selects the next [placeholder] after the current cursor.
 * Wraps around to the first placeholder if nothing is found after cursor.
 * Returns true if a placeholder was selected.
 */
function selectNextPlaceholder(
  textarea: HTMLTextAreaElement,
  text: string
): boolean {
  const cursor = textarea.selectionEnd;
  const all = getPlaceholders(text);
  if (!all.length) return false;
  const after = all.find((p) => p.start >= cursor);
  const target = after ?? all[0];
  textarea.focus();
  textarea.setSelectionRange(target.start, target.end);
  return true;
}

// ─── STT Types ────────────────────────────────────────────────────────────────

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

function createRecognition(): SpeechRecognitionInstance | null {
  const SR =
    (window as unknown as Record<string, unknown>).SpeechRecognition ??
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  if (!SR) return null;
  return new (SR as new () => SpeechRecognitionInstance)();
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  showOptions?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Message PrepAmigo...",
  className,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeTemplateIndex, setActiveTemplateIndex] = useState(0);
  const [sttSupported, setSttSupported] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isRecordingRef = useRef(false);
  /** Text that existed before the user started recording — STT appends to this. */
  const baseTextRef = useRef("");
  /** Accumulated final (committed) STT transcript for the current recording session. */
  const finalTextRef = useRef("");

  // ── Auto-resize textarea ──────────────────────────────────────────────────

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  // ── STT setup ────────────────────────────────────────────────────────────

  useEffect(() => {
    const recognition = createRecognition();
    if (!recognition) return;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (!isRecordingRef.current) return;

      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTextRef.current += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      const combined = (
        baseTextRef.current +
        finalTextRef.current +
        interim
      ).trimStart();
      setText(combined);
      requestAnimationFrame(autoResize);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "no-speech" is normal — user paused or is thinking. Don't stop continuous mode.
      if (event.error === "no-speech") return;
      if (event.error === "aborted" && !isRecordingRef.current) return;
      isRecordingRef.current = false;
      setIsRecording(false);
    };

    recognition.onend = () => {
      // With continuous=true, some browsers fire onend after prolonged silence.
      // If we are still actively recording, restart automatically.
      if (isRecordingRef.current) {
        try {
          recognition.start();
        } catch {
          isRecordingRef.current = false;
          setIsRecording(false);
        }
      }
    };

    recognitionRef.current = recognition;
    setSttSupported(true);

    return () => {
      recognition.abort();
    };
  }, [autoResize]);

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;

    // Stop recording on submit
    if (isRecordingRef.current) {
      isRecordingRef.current = false;
      setIsRecording(false);
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
    }

    onSend(trimmed);
    setText("");
    setShowTemplates(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, disabled, onSend]);

  // ── Recording actions: Start, Pause ───────────────────────────────────────

  const startRecording = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    const current = textareaRef.current?.value ?? text;
    baseTextRef.current = current ? current.trimEnd() + " " : "";
    finalTextRef.current = "";
    isRecordingRef.current = true;
    setIsRecording(true);

    try {
      recognition.start();
    } catch {
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  }, [text]);

  const pauseRecording = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    // Text stays in textarea; focus textarea so user can edit, add, or remove words
    textareaRef.current?.focus();
  }, []);

  // ── Template insertion ────────────────────────────────────────────────────

  const applyTemplate = useCallback(
    (tpl: (typeof SLASH_TEMPLATES)[number]) => {
      setShowTemplates(false);
      setText(tpl.template);
      requestAnimationFrame(() => {
        autoResize();
        if (textareaRef.current) {
          selectNextPlaceholder(textareaRef.current, tpl.template);
          textareaRef.current.focus();
        }
      });
    },
    [autoResize]
  );

  // ── Textarea change ───────────────────────────────────────────────────────

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    autoResize();

    // Show template picker when the only character is "/"
    if (val === "/") {
      setShowTemplates(true);
      setActiveTemplateIndex(0);
    } else {
      setShowTemplates(false);
    }
  };

  // ── Keyboard ──────────────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // ── Template picker navigation ──
    if (showTemplates) {
      if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
        e.preventDefault();
        setActiveTemplateIndex((i) => (i + 1) % SLASH_TEMPLATES.length);
        return;
      }
      if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
        e.preventDefault();
        setActiveTemplateIndex(
          (i) => (i - 1 + SLASH_TEMPLATES.length) % SLASH_TEMPLATES.length
        );
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        applyTemplate(SLASH_TEMPLATES[activeTemplateIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowTemplates(false);
        setText("");
        return;
      }
    }

    // ── TAB — cycle through [placeholders] ──
    if (e.key === "Tab" && !e.shiftKey && textareaRef.current) {
      const moved = selectNextPlaceholder(textareaRef.current, text);
      if (moved) {
        e.preventDefault();
        return;
      }
    }

    // ── Enter — send (no shift, no IME composition) ──
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      !e.nativeEvent.isComposing &&
      !showTemplates
    ) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const hasText = text.trim().length > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={cn("relative flex flex-col w-full", className)}>
      {/* ── Slash-template picker ── */}
      {showTemplates && (
        <div className="absolute bottom-full mb-2 left-0 right-0 z-50 bg-white border border-border rounded-2xl shadow-[0_12px_40px_rgba(24,18,43,0.12)] overflow-hidden">
          <div className="px-4 py-2 bg-navy-50/60 border-b border-border/40 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-navy-500">
              Prompt Templates
            </span>
            <span className="text-[10px] text-carbon-400">
              ↑↓ or Tab to navigate
            </span>
          </div>
          {SLASH_TEMPLATES.map((tpl, i) => (
            <button
              key={tpl.id}
              type="button"
              onMouseEnter={() => setActiveTemplateIndex(i)}
              onMouseDown={(e) => {
                // Prevent textarea blur before we can apply the template
                e.preventDefault();
                applyTemplate(tpl);
              }}
              className={cn(
                "w-full text-left px-4 py-3 transition-colors cursor-pointer",
                i !== SLASH_TEMPLATES.length - 1 && "border-b border-border/40",
                i === activeTemplateIndex
                  ? "bg-navy-100/70 border-l-4 border-navy-900 pl-3"
                  : "hover:bg-surface-muted/40 text-carbon-700 pl-4 border-l-4 border-transparent"
              )}
            >
              <div className="flex items-center justify-between">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    i === activeTemplateIndex ? "text-navy-900" : "text-carbon-800"
                  )}
                >
                  {tpl.label}
                </p>
                {i === activeTemplateIndex && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-navy-900 text-white">
                    Enter ↵
                  </span>
                )}
              </div>
              <p
                className={cn(
                  "text-xs mt-1 font-mono tracking-tight",
                  i === activeTemplateIndex ? "text-navy-700" : "text-carbon-400"
                )}
              >
                {tpl.template}
              </p>
            </button>
          ))}
          <div className="px-4 py-2 text-[10px] text-carbon-400 bg-surface/50 border-t border-border/50 flex items-center justify-between select-none">
            <span>↑↓ / Tab navigate · Enter select · Esc dismiss</span>
            <span>Tab jumps placeholders</span>
          </div>
        </div>
      )}

      {/* ── Main input box ── */}
      <div
        className={cn(
          "relative flex flex-col bg-white rounded-3xl border transition-all duration-150",
          "px-4 pt-3.5 pb-3",
          disabled
            ? "border-border/40 opacity-60 cursor-not-allowed"
            : isFocused
            ? "border-carbon-300 shadow-[0_0_0_4px_rgba(0,0,0,0.05)]"
            : "border-border hover:border-carbon-300/70"
        )}
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            // Small delay so template picker mousedown can fire first
            setTimeout(() => setShowTemplates(false), 150);
          }}
          disabled={disabled}
          placeholder={isRecording ? "Listening… speak now" : placeholder}
          rows={1}
          className={cn(
            "w-full bg-transparent text-carbon-900 text-sm md:text-base leading-relaxed",
            "placeholder:text-carbon-400 outline-none resize-none",
            "min-h-[28px] max-h-[200px] overflow-y-auto",
            disabled && "pointer-events-none"
          )}
        />

        {/* Bottom action bar */}
        <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-border/30">
          {/* Left side: Recording indicator or Template hint */}
          {isRecording ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600 select-none bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              Listening…
            </span>
          ) : (
            /* "/" hint — visible whenever the chatbox is empty and not recording */
            <button
              type="button"
              onClick={() => {
                setText("/");
                setShowTemplates(true);
                setActiveTemplateIndex(0);
                textareaRef.current?.focus();
              }}
              className={cn(
                "flex items-center gap-1.5 text-xs text-carbon-500 hover:text-carbon-900 transition-colors select-none py-1 px-1.5 -ml-1 rounded-lg hover:bg-carbon-100/70 cursor-pointer",
                !text ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
              title="Click or type / for templates"
            >
              <span className="inline-flex items-center justify-center font-mono text-[11px] font-bold w-4 h-4 rounded bg-surface border border-border text-carbon-700 leading-none shadow-2xs">
                /
              </span>
              <span className="font-medium text-xs sm:text-sm text-carbon-600 hover:text-carbon-900">
                Type <span className="font-semibold text-carbon-800">/</span> for templates
              </span>
            </button>
          )}

          {/* Dynamic action button (Mic / Square / Send) */}
          <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
            {isRecording ? (
              /* Pause recording button (Square) */
              <button
                type="button"
                onClick={pauseRecording}
                aria-label="Pause recording"
                title="Pause recording (keep text to edit)"
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-150 shrink-0 bg-carbon-900 text-white hover:bg-carbon-800 active:scale-95 shadow-md cursor-pointer"
              >
                <SquareIcon className="w-4 h-4 text-white" />
              </button>
            ) : hasText ? (
              /* Both buttons: Mic to add more voice, and Send to submit */
              <>
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={disabled || !sttSupported}
                  aria-label="Add voice input"
                  title={
                    !sttSupported
                      ? "Speech recognition is not supported in this browser"
                      : "Add voice input"
                  }
                  className={cn(
                    "w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-150 shrink-0",
                    "bg-surface-muted/90 text-carbon-700 hover:bg-surface-muted hover:text-carbon-900 border border-border/80 active:scale-95 shadow-2xs cursor-pointer",
                    (disabled || !sttSupported) && "opacity-40 pointer-events-none cursor-not-allowed"
                  )}
                >
                  <MicIcon className="w-5 h-5 text-carbon-700" />
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={disabled}
                  aria-label="Send message"
                  title="Send message"
                  className={cn(
                    "w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-150 shrink-0",
                    "bg-carbon-900 text-white hover:bg-carbon-800 active:scale-95 disabled:opacity-40 disabled:pointer-events-none",
                    "shadow-md hover:shadow-lg cursor-pointer"
                  )}
                >
                  <ArrowUpIcon className="w-5 h-5 text-white" />
                </button>
              </>
            ) : (
              /* Mic button (idle, empty box) */
              <button
                type="button"
                onClick={startRecording}
                disabled={disabled || !sttSupported}
                aria-label="Start voice input"
                title={
                  !sttSupported
                    ? "Speech recognition is not supported in this browser"
                    : "Start voice input"
                }
                className={cn(
                  "w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-150 shrink-0",
                  "bg-surface-muted/90 text-carbon-700 hover:bg-surface-muted hover:text-carbon-900 border border-border/80 active:scale-95 shadow-2xs cursor-pointer",
                  (disabled || !sttSupported) && "opacity-40 pointer-events-none cursor-not-allowed"
                )}
              >
                <MicIcon className="w-5 h-5 text-carbon-700" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
