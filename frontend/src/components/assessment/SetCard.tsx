import { motion } from "framer-motion";
import { Icon } from "../ui/Icon";
import { Badge, fade } from "./shared";
import { cn } from "../../utils/utils";

interface Props {
    title: string;
    meta: string;
    badge: string;
    icon: string;
    index: number;
    onClick?: () => void;
    locked?: boolean;
}

export function SetCard({ title, meta, badge, icon, index, onClick, locked }: Props) {
    const completed = badge.toLowerCase().includes("completed");

    return (
        <motion.button
            {...fade}
            transition={{ delay: index * 0.04 }}
            whileHover={!locked ? { y: -2 } : undefined}
            whileTap={!locked ? { scale: 0.99 } : undefined}
            onClick={locked ? undefined : onClick}
            disabled={locked}
            className={cn(
                "group text-left border rounded-2xl p-5 flex flex-col justify-between gap-4 min-h-[140px] w-full transition-all duration-150",
                locked
                    ? "bg-surface-muted/60 border-border/70 opacity-60 cursor-not-allowed"
                    : "bg-surface border-border/80 shadow-xs hover:border-chrome/50 hover:shadow-card cursor-pointer"
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div
                    className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                        locked
                            ? "bg-surface-muted text-rosewood"
                            : completed
                                ? "bg-sky-100 text-sky-500"
                                : "bg-lavender-100 text-chrome group-hover:bg-chrome group-hover:text-on-chrome"
                    )}
                >
                    <Icon name={icon} className="text-xl" />
                </div>
                <Badge>{badge}</Badge>
            </div>

            <div>
                <div className="font-bold text-base text-carbon-900 group-hover:text-deep-emerald leading-snug tracking-tight line-clamp-1">
                    {title}
                </div>
                <div className="text-xs text-carbon-500 mt-1 flex items-center gap-1.5 font-medium">
                    <Icon name="time-outline" className="text-xs opacity-70" />
                    <span>{meta}</span>
                </div>
            </div>
        </motion.button>
    );
}