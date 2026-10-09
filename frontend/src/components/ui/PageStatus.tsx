import { motion, useReducedMotion } from "framer-motion";
import { Mascot, type MascotVariant } from "./Mascot";
import { Button } from "./Button";
import { cn } from "../../utils/utils";

export type StatusKind = "loading" | "server" | "not-found" | "generic";

const KINDS: Record<StatusKind, { mascot: MascotVariant; title: string; description: string }> = {
    loading: {
        mascot: "working.gif",
        title: "Loading...",
        description: "Hang tight, getting things ready.",
    },
    server: {
        mascot: "Embarassment.png",
        title: "Our server tripped up",
        description: "Something went wrong on our side. Please try again in a moment.",
    },
    "not-found": {
        mascot: "sad.png",
        title: "Page not found",
        description: "We couldn't find the page you're looking for.",
    },
    generic: {
        mascot: "dissapointed.png",
        title: "Something went wrong",
        description: "An unexpected error occurred.",
    },
};

interface PageStatusProps {
    kind: StatusKind;
    title?: string;
    description?: string;
    /** shows a "Try again" button */
    onRetry?: () => void;
    /** optional secondary action, e.g. "Back to dashboard" */
    actionLabel?: string;
    onAction?: () => void;
    /** cover the whole screen (only for errors where nothing else can render) */
    fullScreen?: boolean;
    className?: string;
}

export function PageStatus({
    kind,
    title,
    description,
    onRetry,
    actionLabel,
    onAction,
    fullScreen = false,
    className,
}: PageStatusProps) {
    const reduce = useReducedMotion();
    const base = KINDS[kind];
    const isLoading = kind === "loading";

    return (
        <div
            role={isLoading ? "status" : "alert"}
            aria-live={isLoading ? "polite" : "assertive"}
            className={cn(
                "flex w-full flex-1 items-center justify-center p-6",
                fullScreen ? "fixed inset-0 z-50 bg-bg" : "h-full min-h-[50vh]",
                className
            )}
        >
            <motion.div
                initial={{ opacity: 0, y: reduce ? 0 : 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="flex max-w-sm flex-col items-center gap-4 text-center"
            >
                <Mascot variant={base.mascot} size="xl" style={{ width: 140, height: 140 }} />

                <div>
                    <h3 className="text-lg font-extrabold text-carbon-900">{title ?? base.title}</h3>
                    <p className="mt-1 text-sm text-carbon-500">{description ?? base.description}</p>
                </div>

                {(onRetry || onAction) && (
                    <div className="flex flex-wrap justify-center gap-2 pt-1">
                        {onRetry && (
                            <Button variant="accent" onClick={onRetry} className="px-6 font-bold">
                                Try again
                            </Button>
                        )}
                        {onAction && (
                            <Button variant="ghost" onClick={onAction} className="px-6 font-bold text-chrome">
                                {actionLabel ?? "Go back"}
                            </Button>
                        )}
                    </div>
                )}
            </motion.div>
        </div>
    );
}

export const PageLoader = (props: Omit<PageStatusProps, "kind">) => <PageStatus kind="loading" {...props} />;
export const PageError = (props: Omit<PageStatusProps, "kind"> & { kind?: Exclude<StatusKind, "loading"> }) => (
    <PageStatus kind="generic" {...props} />
);