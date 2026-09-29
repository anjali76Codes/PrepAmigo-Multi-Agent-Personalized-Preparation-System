import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "./Button";

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "success" | "warning" | "danger";
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "info", ...props }, ref) => {
    const variants = {
      info: "bg-[var(--color-navy-100)] text-[var(--color-navy-900)] border-[var(--color-navy-500)]",
      success: "bg-[var(--color-forest-100)] text-[var(--color-forest-800)] border-[var(--color-forest-700)]",
      warning: "bg-[var(--color-amber-100)] text-[var(--color-amber-600)] border-[var(--color-amber-600)]",
      danger: "bg-[var(--color-danger-100)] text-[var(--color-danger-600)] border-[var(--color-danger-600)]",
    };

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          "relative w-full rounded-[var(--radius-control)] border-[var(--border-width)] p-4",
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Alert.displayName = "Alert";
