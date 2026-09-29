import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "./Button";

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "neutral" | "navy" | "forest" | "amber" | "danger";
  styleType?: "solid" | "soft";
}

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "neutral", styleType = "soft", ...props }, ref) => {
    const base = "inline-flex items-center rounded-[var(--radius-badge)] px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
    
    const variants = {
      solid: {
        neutral: "bg-[var(--color-surface-muted)] text-[var(--color-navy-700)]",
        navy: "bg-[var(--color-navy-900)] text-white",
        forest: "bg-[var(--color-forest-700)] text-white",
        amber: "bg-[var(--color-amber-600)] text-white",
        danger: "bg-[var(--color-danger-600)] text-white",
      },
      soft: {
        neutral: "bg-[var(--color-surface-muted)] text-[var(--color-navy-500)]",
        navy: "bg-[var(--color-navy-100)] text-[var(--color-navy-900)]",
        forest: "bg-[var(--color-forest-100)] text-[var(--color-forest-800)]",
        amber: "bg-[var(--color-amber-100)] text-[var(--color-amber-600)]",
        danger: "bg-[var(--color-danger-100)] text-[var(--color-danger-600)]",
      }
    };

    return (
      <div ref={ref} className={cn(base, variants[styleType][variant], className)} {...props} />
    );
  }
);
Badge.displayName = "Badge";
