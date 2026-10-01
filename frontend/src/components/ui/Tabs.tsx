import { useState } from "react";
import { cn } from "./Button";

export function Tabs({ tabs, defaultTab, variant = "underline", onChange }: any) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.id);

  const variants = {
    underline: "border-b-2 border-transparent text-carbon-500 hover:text-carbon-700",
    pill: "px-4 py-2 rounded-full text-carbon-500 hover:bg-surface-muted",
    segmented: "px-4 py-1 text-sm rounded-control text-carbon-500 hover:text-carbon-900",
  };

  const activeVariants = {
    underline: "border-navy-700 text-carbon-900",
    pill: "bg-carbon-900 text-white hover:bg-carbon-700 hover:text-white",
    segmented: "bg-white shadow-card text-carbon-900",
  };

  const containerVariants = {
    underline: "flex space-x-4 border-b border-border",
    pill: "flex space-x-2",
    segmented: "flex p-1 bg-surface-muted rounded-control inline-flex",
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
