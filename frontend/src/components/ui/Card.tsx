import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "./Button";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "muted" | "outlined" | "elevated";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variants = {
      default: "bg-[var(--color-surface)] border-[var(--border-width)] border-[var(--color-border)] shadow-[var(--shadow-card)]",
      muted: "bg-[var(--color-surface-muted)] border-none",
      outlined: "bg-transparent border-2 border-[var(--color-border)]",
      elevated: "bg-[var(--color-surface)] shadow-[var(--shadow-pop)] border-none",
    };
    return (
      <div
        ref={ref}
        className={cn("rounded-[var(--radius-card)] text-[var(--color-navy-700)]", variants[variant], className)}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";
