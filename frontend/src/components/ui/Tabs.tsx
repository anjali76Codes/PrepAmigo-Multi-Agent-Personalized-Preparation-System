import { useState } from "react";
import { cn } from "./Button";

export function Tabs({ tabs, defaultTab, variant = "underline", onChange }: any) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.id);

  const variants = {
    underline: "border-b-2 border-transparent text-[var(--color-navy-500)] hover:text-[var(--color-navy-700)]",
    pill: "px-4 py-2 rounded-full text-[var(--color-navy-500)] hover:bg-[var(--color-surface-muted)]",
    segmented: "px-4 py-1 text-sm rounded-[var(--radius-control)] text-[var(--color-navy-500)] hover:text-[var(--color-navy-900)]",
  };

  const activeVariants = {
    underline: "border-[var(--color-forest-700)] text-[var(--color-navy-900)]",
    pill: "bg-[var(--color-navy-900)] text-white hover:bg-[var(--color-navy-700)] hover:text-white",
    segmented: "bg-white shadow-[var(--shadow-card)] text-[var(--color-navy-900)]",
  };

  const containerVariants = {
    underline: "flex space-x-4 border-b border-[var(--color-border)]",
    pill: "flex space-x-2",
    segmented: "flex p-1 bg-[var(--color-surface-muted)] rounded-[var(--radius-control)] inline-flex",
  };

  return (
    <div className={containerVariants[variant as keyof typeof containerVariants]}>
      {tabs.map((tab: any) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => {
              setActive(tab.id);
              onChange?.(tab.id);
            }}
            className={cn(
              "font-medium transition-colors outline-none",
              variant === "underline" && "pb-2",
              variants[variant as keyof typeof variants],
              isActive && activeVariants[variant as keyof typeof activeVariants]
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
