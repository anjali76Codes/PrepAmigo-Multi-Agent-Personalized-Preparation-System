import { motion } from "framer-motion";
import { Icon } from "../ui/Icon";
import { cn } from "../../utils/utils";

// ─── Slash Templates ─────────────────────────────────────────────────────────

export const SLASH_TEMPLATES = [
    {
        id: "role-only",
        label: "I know the role",
        hint: "Not sure which company yet",
        icon: "briefcase-outline",
        template: "I am preparing for a [Role] position in [Timeline] days.",
    },
    {
        id: "company-only",
        label: "I know the company",
        hint: "Help me figure out what to prep",
        icon: "business-outline",
        template: "I have an interview at [Company] in [Timeline] days, help me figure out what to prep.",
    },
    {
        id: "both",
        label: "I know both",
        hint: "Most accurate roadmap",
        icon: "rocket-outline",
        template: "I am preparing for a [Role] at [Company] in [Timeline] days.",
    },
] as const;

export type SlashTemplate = (typeof SLASH_TEMPLATES)[number];

// Same look as the file / voice buttons
export const MUTED_BTN =
    "bg-surface-muted/90 text-carbon-700 hover:bg-surface-muted hover:text-carbon-900 border border-border/80 shadow-2xs";

// ─── Pieces ──────────────────────────────────────────────────────────────────

function TemplatePreview({ text, active }: { text: string; active: boolean }) {
    return (
        <p className="text-xs mt-1.5 leading-relaxed text-carbon-700">
            {text.split(/(\[[^\]]+\])/g).map((part, i) =>
                part.startsWith("[") ? (
                    <span
                        key={i}
                        className={cn(
                            "px-1.5 py-0.5 mx-0.5 rounded-md font-medium",
                            active ? "bg-chrome text-on-chrome" : "bg-lavender-100 text-chrome"
                        )}
                    >
                        {part.slice(1, -1)}
                    </span>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </p>
    );
}

function Kbd({ children }: { children: React.ReactNode }) {
    return (
        <kbd className="px-1.5 py-0.5 rounded-md bg-white border border-border text-[10px] font-medium text-carbon-700">
            {children}
        </kbd>
    );
}

// ─── Picker ──────────────────────────────────────────────────────────────────

export function TemplatePicker({
    activeIndex,
    onHover,
    onPick,
}: {
    activeIndex: number;
    onHover: (i: number) => void;
    onPick: (t: SlashTemplate) => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-3 left-0 right-0 z-50 bg-surface border border-border rounded-3xl shadow-pop overflow-hidden"
        >
            <div className="px-5 pt-4 pb-2">
                <div className="text-sm font-semibold text-carbon-900">Start with a template</div>
                <div className="text-xs text-carbon-700">Pick one, then fill in the highlighted blanks.</div>
            </div>

            <div className="p-2 space-y-1">
                {SLASH_TEMPLATES.map((tpl, i) => {
                    const active = i === activeIndex;
                    return (
                        <button
                            key={tpl.id}
                            type="button"
                            onMouseEnter={() => onHover(i)}
                            onMouseDown={(e) => {
                                e.preventDefault(); // keep textarea focused
                                onPick(tpl);
                            }}
                            className="relative w-full text-left px-3 py-3 rounded-2xl cursor-pointer"
                        >
                            {active && (
                                <motion.span
                                    layoutId="tpl-active"
                                    className="absolute inset-0 rounded-2xl bg-lavender-100 border border-border"
                                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                                />
                            )}
                            <div className="relative flex items-start gap-3">
                                <div
                                    className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors",
                                        MUTED_BTN,
                                        active && "text-carbon-900"
                                    )}
                                >
                                    <Icon name={tpl.icon} className="text-lg" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-semibold text-carbon-900">{tpl.label}</span>
                                        <span className="text-[11px] text-carbon-500 hidden sm:block">{tpl.hint}</span>
                                    </div>
                                    <TemplatePreview text={tpl.template} active={active} />
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="px-5 py-2.5 bg-lavender-50 border-t border-border flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-carbon-700 select-none">
                <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
                <span className="flex items-center gap-1.5"><Kbd>Enter</Kbd> select</span>
                <span className="flex items-center gap-1.5"><Kbd>Tab</Kbd> next blank</span>
                <span className="flex items-center gap-1.5"><Kbd>Esc</Kbd> close</span>
            </div>
        </motion.div>
    );
}