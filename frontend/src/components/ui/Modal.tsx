import { useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mascot, type MascotVariant } from "./Mascot";

interface Props {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    mascot?: MascotVariant;
    children?: ReactNode; // action buttons
}

export function Modal({ open, onClose, title, description, mascot, children }: Props) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-carbon-900/50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label={title}
                        onClick={(e) => e.stopPropagation()}
                        initial={{ opacity: 0, scale: 0.92, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 8 }}
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        className="w-full max-w-md bg-surface border border-border rounded-3xl shadow-pop p-8 text-center space-y-3"
                    >
                        {mascot && <Mascot variant={mascot} size="xl" className="mx-auto" style={{ width: 140, height: 140 }} />}
                        <h2 className="text-2xl font-extrabold text-carbon-900">{title}</h2>
                        {description && <p className="text-carbon-500 leading-relaxed">{description}</p>}
                        {children && <div className="flex flex-wrap justify-center gap-3 pt-3">{children}</div>}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}