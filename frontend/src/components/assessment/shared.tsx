import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Icon } from "../ui/Icon";

export const fade = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.2 },
};

export function Badge({ children }: { children: ReactNode }) {
    return (
        <span className="px-3 py-1 rounded-full bg-lavender-100 border border-border text-xs font-bold text-chrome capitalize">
            {children}
        </span>
    );
}

export function ProgressBar({ value, total }: { value: number; total: number }) {
    return (
        <div className="h-2.5 rounded-full bg-lavender-100 overflow-hidden">
            <motion.div
                className="h-full bg-chrome rounded-full"
                animate={{ width: `${(value / total) * 100}%` }}
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