import { forwardRef, type ButtonHTMLAttributes } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "accent" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  rounded?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "full" | "control";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", rounded = "full", loading, children, disabled, ...props }, ref) => {
    const variants = {
      primary: "bg-carbon-900 text-white hover:bg-carbon-700",
      accent: "bg-expresso text-white hover:bg-forest-emerald",
      outline: "border-2 border-carbon-900 text-carbon-900 hover:bg-carbon-900/5",
      ghost: "text-carbon-700 hover:bg-surface-muted",
    };
    const sizes = {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 py-2",
      lg: "h-12 px-8 text-lg",
    };
    const radii = {
      none: "rounded-none",
      sm: "rounded-sm",
      md: "rounded-md",
      lg: "rounded-lg",
      xl: "rounded-xl",
      "2xl": "rounded-2xl",
      full: "rounded-full",
      control: "rounded-control", // your theme token (follows the data-style presets)
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
          radii[rounded],
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <span className="mr-2 inline-flex items-center gap-1" aria-hidden="true">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="prep-loading-dot h-1.5 w-1.5 rounded-full bg-current"
                style={{ animationDelay: `${dot * 90}ms` }}
              />
            ))}
          </span>
        ) : null}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
