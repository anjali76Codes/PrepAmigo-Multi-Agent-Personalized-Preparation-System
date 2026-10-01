import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "./Button";

export interface MascotProps extends HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl";
  mood?: "idle" | "cheer" | "think";
}

export const Mascot = forwardRef<HTMLDivElement, MascotProps>(
  ({ className, size = "md", mood = "idle", ...props }, ref) => {
    const sizeMap = {
      sm: "w-8 h-8",
      md: "w-16 h-16",
      lg: "w-32 h-32",
      xl: "w-48 h-48",
    };

    return (
      <div
        ref={ref}
        className={cn("inline-flex items-center justify-center rounded-full bg-navy-100 text-navy-700", sizeMap[size], className)}
        {...props}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full fill-current" preserveAspectRatio="xMidYMid meet">
          <circle cx="50" cy="50" r="40" className="opacity-20" />
          {/* Eyes based on mood */}
          {mood === "idle" && (
            <>
              <circle cx="35" cy="45" r="5" />
              <circle cx="65" cy="45" r="5" />
            </>
          )}
          {mood === "cheer" && (
            <>
              <path d="M 30 45 Q 35 35 40 45" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none" />
              <path d="M 60 45 Q 65 35 70 45" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none" />
              <path d="M 40 60 Q 50 75 60 60" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none" />
            </>
          )}
          {mood === "think" && (
            <>
              <circle cx="35" cy="40" r="5" />
              <circle cx="65" cy="45" r="5" />
              <path d="M 45 65 L 55 65" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </>
          )}
        </svg>
      </div>
    );
  }
);
Mascot.displayName = "Mascot";
