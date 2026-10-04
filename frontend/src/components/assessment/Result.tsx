import { motion } from "framer-motion";
import { Mascot } from "../ui/Mascot";
import { fade } from "./shared";

interface Props {
    title: string;
    sub: string;
    onAgain: () => void;
    onExit: () => void;
}

export function Result({ title, sub, onAgain, onExit }: Props) {
    return (
        <motion.div {...fade} className="bg-lavender-100 border border-border rounded-3xl p-12 text-center space-y-5 shadow-xs">
            <Mascot variant="Motivated.png" size="xl" style={{ width: 180, height: 180, margin: "0 auto" }} />
            <h2 className="text-3xl font-extrabold text-carbon-900">{title}</h2>
            <p className="text-carbon-500 text-lg">{sub}</p>
            <div className="flex justify-center gap-3 pt-2">
                <button onClick={onAgain} className="px-6 py-3 rounded-xl bg-chrome text-on-chrome font-bold text-sm hover:bg-chrome-hover transition-colors">
                    Try again
                </button>
                <button onClick={onExit} className="px-6 py-3 rounded-xl bg-surface border border-border text-chrome font-bold text-sm hover:bg-white transition-colors">
                    Back to list
                </button>
            </div>
        </motion.div>
    );
}