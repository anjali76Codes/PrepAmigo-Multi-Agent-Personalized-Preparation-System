import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface LoaderProps {
  fullScreen?: boolean;
  message?: string;
  submessage?: string;
}

export function PlatformLoader({ 
  fullScreen = false, 
  message = "Loading...",
  submessage = "Getting things ready"
}: LoaderProps = {}) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-50",
      fullScreen ? "fixed inset-0" : "absolute inset-0 rounded-[inherit]"
    )}>
      <div className="flex flex-col items-center gap-6">
        {/* Placeholder for the mascot running animation */}
        <div className="relative w-32 h-32 flex items-center justify-center bg-surface-muted rounded-full shadow-sm border border-border">
          {/* Replace this div or img with the actual Lottie or Gif mascot animation */}
          <motion.div
            animate={{ y: [0, -15, 0] }}
            transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }}
            className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-xs border border-border"
          >
            <span className="text-3xl"></span>
          </motion.div>
          
          {/* Floor shadow effect */}
          <motion.div 
            animate={{ scale: [1, 0.8, 1], opacity: [0.15, 0.05, 0.15] }}
            transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }}
            className="absolute -bottom-4 w-20 h-2 bg-carbon-900 rounded-full blur-sm" 
          />
        </div>

        <div className="text-center space-y-1">
          <motion.h3 
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="text-lg font-bold text-carbon-900 tracking-tight"
          >
            {message}
          </motion.h3>
          {submessage && (
            <p className="text-xs text-carbon-500 font-medium">
              {submessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
