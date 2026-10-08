import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { Icon } from "../ui/Icon";
import { cn } from "../../utils/utils";
import type { FlashcardDeck } from "../../mocks/assessment.mock";
import { Badge, Button, RATINGS } from "./shared";

export type Card = FlashcardDeck["cards"][number];

const face: CSSProperties = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" };

const SIZES = {
    lg: { box: "h-80 md:h-[26rem] p-10 gap-5", front: "text-2xl md:text-3xl", back: "text-xl md:text-2xl" },
    md: { box: "h-60 sm:h-64 p-6 sm:p-8 gap-3", front: "text-lg sm:text-xl", back: "text-base sm:text-lg" },
};

interface FlipCardProps {
    card: Card;
    flipped: boolean;
    onFlip: () => void;
    size?: keyof typeof SIZES;
    /** show the category badge on the front (the combined runner shows it in its own header) */
    showCategory?: boolean;
}

export function FlipCard({ card, flipped, onFlip, size = "lg", showCategory = false }: FlipCardProps) {
    const s = SIZES[size];
    const faceBase = cn("absolute inset-0 rounded-3xl shadow-card flex flex-col items-center justify-center text-center", s.box);

    return (
        <div style={{ perspective: 1400 }}>
            <motion.div
                role="button"
                tabIndex={0}
                aria-pressed={flipped}
                aria-label={flipped ? "Showing answer. Press to see the question" : "Showing question. Press to reveal the answer"}
                onClick={onFlip}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onFlip();
                    }
                }}
                animate={{ rotateX: flipped ? 180 : 0 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                style={{ transformStyle: "preserve-3d" }}
                className="relative cursor-pointer outline-offset-4"
            >
                {/* invisible spacer so the card keeps its height */}
                <div className={cn("invisible", s.box)} />

                {/* front */}
                <div style={face} className={cn(faceBase, "bg-surface border border-border")}>
                    {showCategory && <Badge>{card.category}</Badge>}
                    <p className={cn("font-bold text-carbon-900 leading-snug", s.front)}>{card.front}</p>
                    <span className="text-sm font-semibold text-rosewood flex items-center gap-1.5">
                        <Icon name="refresh" /> Tap to reveal
                    </span>
                </div>

                {/* back */}
                <div style={{ ...face, transform: "rotateX(180deg)" }} className={cn(faceBase, "bg-chrome text-on-chrome")}>
                    <span className="text-xs font-semibold text-on-chrome-muted">Answer</span>
                    <p className={cn("font-medium leading-relaxed", s.back)}>{card.back}</p>
                    <div className="flex flex-wrap justify-center gap-1.5">
                        {card.tags.map((t: string) => (
                            <span
                                key={t}
                                className="px-2.5 py-0.5 rounded-full bg-chrome-hover border border-chrome-border text-xs text-on-chrome-muted"
                            >
                                {t}
                            </span>
                        ))}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

export function RatingButtons({ onRate }: { onRate: (value: number) => void }) {
    return (
        <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="text-sm text-rosewood font-semibold">How well did you know it?</span>
            {RATINGS.map((r) => (
                <Button key={r.label} variant="soft" onClick={() => onRate(r.value)} className="rounded-full px-5">
                    {r.label}
                </Button>
            ))}
        </div>
    );
}