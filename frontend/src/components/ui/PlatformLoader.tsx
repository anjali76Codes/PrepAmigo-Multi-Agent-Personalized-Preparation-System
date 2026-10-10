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
        <Mascot
          variant="working.gif"
          size="xl"
          style={{ width: 150, height: 150 }}
          className="object-contain drop-shadow-md"
        />

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