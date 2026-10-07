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
    return (
        <motion.button
            {...fade}
            transition={{ delay: index * 0.06 }}
            whileHover={!locked ? { y: -4 } : undefined}
            whileTap={!locked ? { scale: 0.98 } : undefined}
            onClick={locked ? undefined : onClick}
            disabled={locked}
            className={cn(
                "text-left border rounded-3xl p-7 shadow-xs flex flex-col gap-5 min-h-[190px] transition-colors w-full",
                locked
                    ? "bg-bg/60 border-border opacity-60 cursor-not-allowed"
                    : "bg-surface border-border hover:border-chrome cursor-pointer"
            )}
        >
            <div className="flex items-center justify-between">
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", locked ? "bg-carbon-200 text-carbon-400" : "bg-chrome text-on-chrome")}>
                    <Icon name={icon} className="text-2xl" />
                </div>
                <Badge>{badge}</Badge>
            </div>
            <div>
                <div className="font-bold text-lg md:text-xl text-carbon-900 leading-snug">{title}</div>
                <div className="text-base text-navy-300 mt-2">{meta}</div>
            </div>
        </motion.button>
    );
}