import { useState } from "react";
import { Icon } from "./Icon";
import { motion, AnimatePresence } from "framer-motion";

export interface ResourceItem {
  id: string;
  type: "Article" | "Video" | "Link" | "Note";
  title: string;
  url: string;
}

export interface DayTaskCardProps {
  variant: "compact" | "full";
  title: string;
  completed: boolean;
  onToggleComplete?: () => void;
  resources: ResourceItem[];
}

export function DayTaskCard({
  variant,
  title,
  completed,
  onToggleComplete,
  resources,
}: DayTaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(variant === "full");

  const groupedResources = resources.reduce((acc, resource) => {
    if (!acc[resource.type]) acc[resource.type] = [];
    acc[resource.type].push(resource);
    return acc;
  }, {} as Record<string, ResourceItem[]>);

  const getIconForType = (type: string) => {
    switch (type) {
      case "Video":
        return "play-circle-outline";
      case "Article":
        return "document-text-outline";
      case "Note":
        return "journal-outline";
      default:
        return "link-outline";
    }
  };

  return (
    <div className={`bg-white border ${completed ? "border-border/40 bg-surface-muted/50" : "border-border"} rounded-2xl p-4 transition-all hover:shadow-sm flex flex-col gap-3`}>
      <div className="flex items-start gap-4">
        <button
          onClick={onToggleComplete}
          aria-label="Toggle completed"
          className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
            completed ? "bg-navy-700 border-navy-700 text-white" : "border-carbon-300 hover:border-navy-700 bg-white"
          }`}
        >
          {completed && <Icon name="checkmark" className="text-xs font-bold" />}
        </button>

        <div className={`flex-1 font-medium leading-snug ${completed ? "line-through text-carbon-400" : "text-carbon-900"}`}>
          {title}
        </div>

        {variant === "compact" && resources.length > 0 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            className="p-1 rounded-md text-carbon-500 hover:bg-surface-muted transition-colors"
          >
            <Icon name="chevron-down" className={`text-xl transition-transform ${isExpanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isExpanded && resources.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-2 pl-10 flex flex-col gap-3">
              {Object.entries(groupedResources).map(([type, items]) => (
                <div key={type} className="flex flex-col gap-1">
                  <h4 className="text-xs font-bold text-carbon-500 uppercase tracking-wider">{type}s</h4>
                  <div className="flex flex-col gap-1">
                    {items.map((item) => (
                      <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-navy-600 hover:text-navy-800 hover:underline py-1"
                      >
                        <Icon name={getIconForType(type)} className="text-base" />
                        <span>{item.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
