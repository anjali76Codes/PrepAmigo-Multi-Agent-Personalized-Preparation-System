import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "./Button";

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "neutral" | "navy" | "forest" | "amber" | "danger" | "warning";
  styleType?: "solid" | "soft";
}

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "neutral", styleType = "soft", ...props }, ref) => {
    const base = "inline-flex items-center rounded-badge px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
    
    const variants = {
      solid: {
        default: "bg-carbon-900 text-white",
        neutral: "bg-surface-muted text-carbon-700",
        navy: "bg-navy-900 text-white",
        forest: "bg-forest-700 text-white",
        amber: "bg-amber-600 text-white",
        warning: "bg-amber-600 text-white",
        danger: "bg-danger-600 text-white",
      },
      soft: {
        default: "bg-carbon-100 text-carbon-900",
        neutral: "bg-surface-muted text-carbon-500",
        navy: "bg-navy-100 text-navy-900",
        forest: "bg-forest-100 text-forest-800",
        amber: "bg-amber-100 text-amber-600",
        warning: "bg-amber-100 text-amber-600",
        danger: "bg-danger-100 text-danger-600",
      }
    };

    return (
      <div ref={ref} className={cn(base, variants[styleType][variant], className)} {...props} />
    );
  }
);
Badge.displayName = "Badge";
