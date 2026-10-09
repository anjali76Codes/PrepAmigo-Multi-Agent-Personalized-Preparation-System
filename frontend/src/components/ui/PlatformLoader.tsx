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

const RUN = { repeat: Infinity, duration: 1, ease: "easeInOut" as const };

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
        <div className="relative flex flex-col items-center">
          <motion.div
            animate={reduce ? undefined : { y: [0, -14, 0], rotate: [-3, 3, -3] }}
            transition={RUN}
          >
            <Mascot
              variant="Running.png"
              size="xl"
              style={{ width: 150, height: 150 }}
              className="object-contain drop-shadow-md"
            />
          </motion.div>

          {/* floor shadow: shrinks and fades as the mascot jumps */}
          <motion.div
            className="mt-1 h-2.5 w-20 rounded-full bg-carbon-900/20 blur-[2px]"
            animate={reduce ? undefined : { scaleX: [1, 0.7, 1], opacity: [0.9, 0.45, 0.9] }}
            transition={RUN}
          />
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