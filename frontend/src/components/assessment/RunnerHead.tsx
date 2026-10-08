import { Back, ProgressBar } from "./shared";

interface Props {
    backLabel: string;
    onBack: () => void;
    /** e.g. "Question 3 of 10" */
    label: string;
    /** how many items are finished */
    value: number;
    total: number;
}

export function RunnerHeader({ backLabel, onBack, label, value, total }: Props) {
    const percent = total ? Math.round((value / total) * 100) : 0;
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Back onClick={onBack} label={backLabel} />
                <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-surface border border-border text-carbon-700 shadow-xs">
                        {label}
                    </span>
                    <span className="text-xs font-bold text-cocoa">{percent}%</span>
                </div>
            </div>
            <ProgressBar value={value} total={total} />
        </div>
    );
}