import type { Assessment } from "../../mocks/assessment.mock";
import { Mascot } from "../ui/Mascot";
import { getLevelLabel, getSprintLabel } from "./Groupassessments";

export function SprintBanner({
    assessment,
    note,
}: {
    assessment: Assessment;
    note?: string;
}) {
    return (
        <aside className="w-full lg:w-64 xl:w-72 shrink-0">
            <div className="sticky top-6 rounded-3xl border border-border bg-lavender-100 p-5 shadow-pop overflow-hidden">
                <div className="flex flex-col min-h-[220px]">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-carbon-500">
                            {getSprintLabel(assessment, "Sprint assessment")}
                        </p>

                        <p className="mt-2 text-lg font-extrabold text-carbon-900 leading-tight">
                            {getLevelLabel(assessment, "Assessment")}
                        </p>

                        {note && (
                            <span className="inline-flex mt-3 rounded-full bg-white/70 border border-white px-2.5 py-1 text-[11px] font-bold text-rosewood">
                                {note}
                            </span>
                        )}
                    </div>

                    <div className="mt-auto flex justify-center pt-6">
                        <Mascot
                            variant="working.png"
                            size="lg"
                            className="w-32 h-32 object-contain"
                        />
                    </div>
                </div>
            </div>
        </aside>
    );
}