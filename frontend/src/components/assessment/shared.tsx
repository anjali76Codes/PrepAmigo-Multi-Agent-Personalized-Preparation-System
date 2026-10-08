import type { ButtonHTMLAttributes, ReactNode } from "react";
import { motion } from "framer-motion";
import { Icon } from "../ui/Icon";
import { cn } from "../../utils/utils";

/* ───────────── constants ───────────── */

export const fade = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.2 },
};

export const LETTERS = ["A", "B", "C", "D"];

export const RATINGS = [
    { label: "Hard", value: 1 },
    { label: "Okay", value: 3 },
    { label: "Easy", value: 5 },
];

/* ───────────── building blocks ───────────── */

/** The white rounded card every runner puts its content in. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <motion.div
            {...fade}
            className={cn("bg-surface border border-border/80 rounded-3xl p-6 sm:p-8 shadow-card space-y-6", className)}
        >
            {children}
        </motion.div>
    );
}

export function Badge({ children }: { children: ReactNode }) {
    return (
        <span className="px-3 py-1 rounded-full bg-lavender-100 border border-border text-xs font-bold text-chrome capitalize">
            {children}
        </span>
    );
}

export function ProgressBar({ value, total }: { value: number; total: number }) {
    const pct = total ? Math.min(100, (value / total) * 100) : 0;
    return (
        <div
            className="h-2.5 rounded-full bg-lavender-100 overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={value}
        >
            <motion.div
                className="h-full bg-chrome rounded-full"
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.4 }}
            />
        </div>
    );
}

export function Back({ onClick, label }: { onClick: () => void; label: string }) {
    return (
        <button onClick={onClick} className="flex items-center gap-2 text-sm font-bold text-chrome hover:underline">
            <Icon name="arrow-back" /> {label}
        </button>
    );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "ghost" | "soft";
};

const BUTTON_VARIANTS = {
    primary: "bg-chrome text-on-chrome hover:bg-chrome-hover shadow-xs hover:shadow-pop",
    ghost: "bg-surface border border-border text-chrome hover:bg-lavender-100",
    soft: "bg-lavender-100 border border-border text-chrome hover:bg-chrome hover:text-on-chrome",
};

/** One button for the whole feature (Next, Try again, Back to list, ratings...). */
export function Button({ variant = "primary", className, ...props }: ButtonProps) {
    return (
        <button
            {...props}
            className={cn(
                "px-6 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed",
                BUTTON_VARIANTS[variant],
                className
            )}
        />
    );
}

/** Top row of a quiz question or flashcard: badge + tag on the left, hint on the right. */
export function CardHeader({ badge, tag, hint }: { badge: ReactNode; tag?: ReactNode; hint: string }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-4">
            <div className="flex items-center gap-2">
                <Badge>{badge}</Badge>
                {tag && (
                    <span className="text-xs font-medium text-carbon-500 bg-bg px-2.5 py-1 rounded-full border border-border/60">
                        {tag}
                    </span>
                )}
            </div>
            <span className="text-xs font-medium text-rosewood">{hint}</span>
        </div>
    );
}