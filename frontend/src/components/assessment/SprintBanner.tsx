import { motion, useReducedMotion } from "framer-motion";
import type { Assessment } from "../../mocks/assessment.mock";
import { Mascot } from "../ui/Mascot";
import { Icon } from "../ui/Icon";
import { getLevelLabel, getSprintLabel } from "./Groupassessments";

const FLOAT = { duration: 3.2, repeat: Infinity, ease: "easeInOut" as const };

export function SprintBanner({
    assessment,
    note,
}: {
    assessment: Assessment;
    note?: string;
}) {
    const reduce = useReducedMotion();
    const count = assessment.questions.length;
    const duration = Math.max(3, Math.round(count * 1.5));

    return (
        <aside className="w-full shrink-0 self-start lg:sticky lg:top-6 lg:w-64 xl:w-72">
            <div className="relative overflow-hidden rounded-3xl border border-border bg-lavender-100 p-5 shadow-pop">
                {/* decorative blobs */}
                <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/50 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-12 -left-10 h-40 w-40 rounded-full bg-soft-rose/70 blur-2xl" />

                <div className="relative flex min-h-[280px] flex-col">
                    {/* header */}
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="flex h-10 w-10 p-1 items-center justify-center rounded-full bg-expresso text-on-chrome">
                                <img src="/assets/icons/badge1.png" className="text-sm" />
                            </span>
                            <p className="text-sm font-bold uppercase text-carbon-500">
                                {getSprintLabel(assessment, "Sprint assessment")}
                            </p>
                        </div>

                        <p className="mt-3 text-xl font-extrabold text-carbon-900">
                            {getLevelLabel(assessment, "Assessment")}
                        </p>

                        {note && (
                            <span className="mt-3 inline-flex rounded-full border border-white bg-white/70 px-2.5 py-1 text-[11px] font-bold text-rosewood">
                                {note}
                            </span>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-chrome">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/80 px-2.5 py-1">
                                <Icon name="help-circle" /> {count} questions
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/80 px-2.5 py-1">
                                <Icon name="time-outline" /> ~{duration} min
                            </span>
                        </div>
                    </div>

                    {/* floating mascot */}
                    <div className="mt-auto flex flex-col items-center pt-6">
                        <motion.div
                            animate={reduce ? undefined : { y: [0, -12, 0], rotate: [-1.5, 1.5, -1.5] }}
                            transition={FLOAT}
                        >
                            <Mascot
                                variant="Motivated.png"
                                size="lg"
                                className="h-32 w-32 object-contain drop-shadow-md"
                            />
                        </motion.div>
                    </div>
                </div>
            </div>
        </aside>
    );
}