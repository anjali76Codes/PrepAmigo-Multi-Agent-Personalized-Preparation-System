import { motion, useReducedMotion } from "framer-motion";
import { Mascot } from "./Mascot";
import { cn } from "../../utils/utils";

interface LoaderProps {
  /** cover the whole screen (default). Pass false to just fill the parent. */
  fullScreen?: boolean;
  message?: string;
  submessage?: string;
  className?: string;
}

export function PlatformLoader({
  fullScreen = true,
  message = "Loading...",
  submessage = "Getting things ready",
  className,
}: LoaderProps = {}) {
  const reduce = useReducedMotion();

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-center bg-bg p-6",
        fullScreen ? "fixed inset-0 z-50" : "h-full w-full flex-1 min-h-[50vh]",
        className
      )}
    >
      <div className="flex flex-col items-center gap-5">
        <div className="relative flex items-center justify-center">
          <div className="w-20 h-20 rounded-full border-4 border-carbon-200 border-t-amber-500 animate-spin" />
          <div className="absolute inset-2 rounded-full overflow-hidden flex items-center justify-center bg-bg p-1">
            <Mascot
              variant="nosy.png"
              size="md"
              className="w-12 h-12 object-contain drop-shadow-sm"
              loading="eager"
            />
          </div>
        </div>

        <div className="space-y-1 text-center">
          <motion.h3
            animate={reduce ? undefined : { opacity: [0.55, 1, 0.55] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="text-lg font-extrabold tracking-tight text-carbon-900"
          >
            {message}
          </motion.h3>
          {submessage && <p className="text-xs font-medium text-carbon-500">{submessage}</p>}
        </div>
      </div>
    </div>
  );
}