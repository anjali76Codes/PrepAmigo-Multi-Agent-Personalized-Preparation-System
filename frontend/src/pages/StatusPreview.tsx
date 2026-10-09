import { useState } from "react";
import { PageStatus, type StatusKind } from "../components/ui/PageStatus";

const KINDS: StatusKind[] = ["loading", "server", "not-found", "generic"];

export function StatusPreview() {
    const [kind, setKind] = useState<StatusKind>("loading");

    return (
        <div className="flex h-full flex-1 flex-col">
            <div className="flex flex-wrap gap-2 p-4">
                {KINDS.map((k) => (
                    <button
                        key={k}
                        onClick={() => setKind(k)}
                        className={`rounded-full border px-4 py-2 text-sm font-bold ${kind === k ? "bg-expresso text-on-chrome" : "bg-surface text-carbon-700"
                            }`}
                    >
                        {k}
                    </button>
                ))}
            </div>

            <PageStatus
                kind={kind}
                onRetry={kind === "loading" ? undefined : () => alert("retry clicked")}
                actionLabel="Go back"
                onAction={kind === "loading" ? undefined : () => alert("action clicked")}
            />
        </div>
    );
}