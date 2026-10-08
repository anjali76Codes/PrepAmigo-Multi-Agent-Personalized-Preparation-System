import { motion } from "framer-motion";
import { Mascot } from "../ui/Mascot";
import { Button, fade } from "./shared";

interface Props {
    title: string;
    sub: string;
    onExit: () => void;
    /** omit to hide the "Try again" button */
    onAgain?: () => void;
    exitLabel?: string;
    mascot?: string;
}

export function Result({ title, sub, onExit, onAgain, exitLabel = "Back to list", mascot = "Motivated.png" }: Props) {
    return (
        <motion.div
            {...fade}
            className="max-w-xl mx-auto bg-lavender-100 border border-border rounded-3xl p-8 sm:p-12 text-center space-y-5 shadow-card"
        >
            <Mascot variant={mascot} size="xl" style={{ width: 160, height: 160, margin: "0 auto" }} />
            <h2 className="text-2xl sm:text-3xl font-extrabold text-carbon-900">{title}</h2>
            <p className="text-carbon-500 text-base sm:text-lg">{sub}</p>
            <div className="flex justify-center gap-3 pt-2">
                {onAgain && <Button onClick={onAgain}>Try again</Button>}
                <Button variant="ghost" onClick={onExit}>
                    {exitLabel}
                </Button>
            </div>
        </motion.div>
    );
}