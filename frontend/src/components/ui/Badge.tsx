import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "./Button";

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "neutral" | "navy" | "forest" | "amber" | "danger" | "warning" | "sunny" | "coral";
  styleType?: "solid" | "soft";
  tone?: "default" | "inverse";
}

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "neutral", styleType = "soft", tone = "default", ...props }, ref) => {
    const base = "inline-flex items-center rounded-badge px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

    const variants = {
      solid: {
        default: tone === 'inverse' ? "bg-chrome-accent text-chrome" : "bg-carbon-900 text-white",
        neutral: tone === 'inverse' ? "bg-chrome-hover text-on-chrome" : "bg-surface-muted text-carbon-700",
        navy: "bg-deep-emerald text-white",
        forest: "bg-expresso text-white",
        amber: "bg-beige-600 text-white",
        warning: "bg-beige-600 text-white",
        danger: "bg-danger-600 text-white",
        sunny: "bg-beige-500 text-deep-emerald",
        coral: "bg-coral-500 text-deep-emerald",
      },
      soft: {
        default: "bg-carbon-100 text-carbon-900",
        neutral: "bg-surface-muted text-carbon-500",
        navy: "bg-soft-rose text-deep-emerald",
        forest: "bg-soft-rose text-forest-emerald",
        amber: "bg-beige-100 text-beige-600",
        warning: "bg-beige-100 text-beige-600",
        danger: "bg-danger-100 text-danger-600",
        sunny: "bg-beige-100 text-beige-800",
        coral: "bg-coral-100 text-coral-800",
      }
    };

    return (
      <div ref={ref} className={cn(base, variants[styleType][variant], className)} {...props} />
    );
  }
);
Badge.displayName = "Badge";
