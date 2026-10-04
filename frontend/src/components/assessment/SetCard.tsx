import { motion } from "framer-motion";
import { Icon } from "../ui/Icon";
import { Badge, fade } from "./shared";

interface Props {
    title: string;
    meta: string;
    badge: string;
    icon: string;
    index: number;
    onClick: () => void;
}

export function SetCard({ title, meta, badge, icon, index, onClick }: Props) {
    return (
        <motion.button
            {...fade}
            transition={{ delay: index * 0.06 }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className="text-left bg-surface border border-border rounded-3xl p-7 shadow-xs hover:border-chrome transition-colors flex flex-col gap-5 min-h-[190px]"
        >
            <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-chrome text-on-chrome flex items-center justify-center">
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