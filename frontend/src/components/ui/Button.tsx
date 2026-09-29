import { forwardRef, type ButtonHTMLAttributes } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "accent" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    const variants = {
      primary: "bg-[var(--color-navy-900)] text-white hover:bg-[var(--color-navy-700)]",
      accent: "bg-[var(--color-forest-700)] text-white hover:bg-[var(--color-forest-800)]",
      outline: "border-2 border-[var(--color-navy-900)] text-[var(--color-navy-900)] hover:bg-[var(--color-navy-100)]",
      ghost: "text-[var(--color-navy-700)] hover:bg-[var(--color-surface-muted)]",
    };
    const sizes = {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 py-2",
      lg: "h-12 px-8 text-lg",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center rounded-[var(--radius-control)] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading ? <span className="mr-2 animate-spin">...</span> : null}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
