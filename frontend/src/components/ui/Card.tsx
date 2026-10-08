import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "./Button";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "muted" | "outlined" | "elevated" | "forest" | "sunny" | "coral" | "sky" | "navy" | "carbon" | "chrome" | "dashed";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variants = {
      default: "bg-surface border-border shadow-card text-carbon-900 border",
      muted: "bg-surface-muted border-none text-carbon-900",
      outlined: "bg-transparent border border-border text-carbon-900",
      elevated: "bg-surface shadow-pop border-none text-carbon-900",
      forest: "bg-soft-rose text-forest-emerald border-none",
      sunny: "bg-beige-100 text-beige-800 border-none",
      coral: "bg-coral-100 text-coral-800 border-none",
      sky: "bg-sky-100 text-sky-800 border-none",
      navy: "bg-soft-rose text-deep-emerald border-none",
      carbon: "bg-carbon-900 text-white border-none",
      chrome: "bg-chrome text-on-chrome border-none",
      dashed: "border-dashed border-2 border-border bg-transparent text-carbon-500",
    };
    return (
      <div
        ref={ref}
        className={cn("rounded-card", variants[variant], className)}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";
