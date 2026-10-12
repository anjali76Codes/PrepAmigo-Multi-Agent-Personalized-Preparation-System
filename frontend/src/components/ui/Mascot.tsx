import { forwardRef, type ImgHTMLAttributes } from "react";
import { cn } from "./Button";

export type MascotVariant =
  | "Celebration.png"
  | "Chilling.png"
  | "Embarassment.png"
  | "Motivated.png"
  | "Node.png"
  | "OK.png"
  | "Running.png"
  | "sad.png"
  | "Thinking.png"
  | "thinking.gif"
  | "working.gif"
  | "working.png"
  | "dissapointed.png"
  | "hi.png"
  | "nosy.png";

export interface MascotProps extends ImgHTMLAttributes<HTMLImageElement> {
  size?: "sm" | "md" | "lg" | "xl";
  variant: MascotVariant;
  alt?: string;
}

export const Mascot = forwardRef<HTMLImageElement, MascotProps>(
  (
    {
      className,
      size = "md",
      variant,
      alt,
      loading = "lazy",
      decoding = "async",
      ...props
    },
    ref
  ) => {
    const sizeMap = {
      sm: "w-8 h-8",
      md: "w-16 h-16",
      lg: "w-32 h-32",
      xl: "w-48 h-48",
    };

    return (
      <img
        ref={ref}
        src={`/assets/Mascot/${variant}`}
        alt={alt || `Mascot ${variant.split('.')[0]}`}
        loading={loading}
        decoding={decoding}
        className={cn(
          "inline-flex items-center justify-center object-contain",
          sizeMap[size],
          className
        )}
        {...props}
      />
    );
  }
);
Mascot.displayName = "Mascot";
