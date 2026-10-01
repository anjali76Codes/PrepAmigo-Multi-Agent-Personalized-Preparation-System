import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "./Button";

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "success" | "warning" | "danger";
  icon?: string;
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "info", ...props }, ref) => {
    const variants = {
      info: "bg-navy-100 text-navy-900 border-navy-500/20 border",
      success: "bg-navy-100 text-navy-800 border-navy-700/20 border",
      warning: "bg-beige-100 text-beige-600 border-beige-600/20 border",
      danger: "bg-danger-100 text-danger-600 border-danger-600/20 border",
    };

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          "relative w-full rounded-control p-4 flex gap-4 items-start",
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Alert.displayName = "Alert";
