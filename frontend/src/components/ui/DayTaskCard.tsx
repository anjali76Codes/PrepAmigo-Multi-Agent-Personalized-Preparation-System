import { useState } from "react";
import { Icon } from "./Icon";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../utils/utils";

export interface ResourceItem {
  id: string;
  type: "Article" | "Video" | "Link" | "Note" | "Book" | "Documentation" | "Problem" | "Course" | string;
  title: string;
  url: string;
}

export interface DayTaskCardProps {
  variant: "compact" | "full";
  title: string;
  completed: boolean;
  onToggleComplete?: () => void;
  resources: ResourceItem[];
  /** Overrides the default (full = open, compact = closed) */
  defaultOpen?: boolean;
}

const getIconForType = (type: string) => {
  switch (type.toLowerCase()) {
    case "video": return "play-circle";
    case "article": return "document-text";
    case "book": return "book";
    case "documentation":
    case "docs": return "code-slash";
    case "problem": return "code-working";
    case "course": return "school";
    case "note": return "journal";
    default: return "link";
  }
};

/* Every tree row is 32px tall (h-8), so the branch always sits at the 16px midpoint. */
function TreeRow({ last, delay, children }: { last: boolean; delay: number; children: React.ReactNode }) {
  return (
    <li className="relative pl-6">
      {/* vertical trunk: full height, stops at the branch on the last row */}
      <motion.span
        aria-hidden
        className="absolute left-0 top-0 w-0.5 rounded-full bg-on-chrome-muted origin-top"
        style={{ height: last ? 16 : "100%" }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay, duration: 0.25, ease: "easeOut" }}
      />
      {/* branch */}
      <motion.span
        aria-hidden
        className="absolute left-0 top-[15px] h-0.5 w-5 rounded-full bg-on-chrome-muted origin-left"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: delay + 0.15, duration: 0.2, ease: "easeOut" }}
      />
      <motion.div
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: delay + 0.2, duration: 0.25 }}
      >
        {children}
      </motion.div>
    </li>
  );
}

export function DayTaskCard({
  variant,
  title,
  completed,
  onToggleComplete,
  resources,
  defaultOpen,
}: DayTaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultOpen ?? variant === "full");
  const hasResources = resources.length > 0;

  const groups = Object.entries(
    resources.reduce((acc, r) => {
      (acc[r.type] ||= []).push(r);
      return acc;
    }, {} as Record<string, ResourceItem[]>)
  );

  // running index so delays cascade across groups and their children
  let step = 0;

  return (
    <div
      className={cn(
        "border rounded-2xl transition-colors flex flex-col overflow-hidden",
        completed ? "border-border/40 bg-chrome-accent" : "border-border bg-surface"
      )}
    >
      {/* Header: click anywhere (except the checkbox) to open/close */}
      <div
        role={hasResources ? "button" : undefined}
        tabIndex={hasResources ? 0 : undefined}
        aria-expanded={hasResources ? isExpanded : undefined}
        onClick={() => hasResources && setIsExpanded((o) => !o)}
        onKeyDown={(e) => {
          if (!hasResources) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded((o) => !o);
          }
        }}
        className={cn(
          "flex items-start gap-4 p-4",
          hasResources && "cursor-pointer hover:bg-bg/60 transition-colors"
        )}
      >
        <button
          type="button"
          aria-label="Toggle completed"
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete?.();
          }}
          onKeyDown={(e) => e.stopPropagation()}
          className={cn(
            "mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors",
            completed
              ? "bg-expresso border-expresso text-white"
              : "border-chrome-accent hover:border-expresso bg-surface"
          )}
        >
          {completed && <Icon name="checkmark" className="text-xs font-bold" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className={cn("font-medium leading-snug", completed ? "line-through text-carbon-500" : "text-carbon-900")}>
            {title}
          </div>
          {hasResources && (
            <div className="text-xs text-carbon-500 mt-0.5">
              {resources.length} {resources.length === 1 ? "resource" : "resources"}
            </div>
          )}
        </div>

        {hasResources && (
          <motion.span
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.25 }}
            className="p-1 text-xl text-carbon-500 flex"
          >
            <Icon name="chevron-down" />
          </motion.span>
        )}
      </div>

      {/* Resource tree */}
      <AnimatePresence initial={false}>
        {isExpanded && hasResources && (
          <motion.div
            key="tree"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden bg-lavender-100"
          >
            <ul className="ml-[27px] mr-4 pb-4">
              {groups.map(([type, items], gi) => {
                const groupDelay = 0.08 + step++ * 0.07;
                return (
                  <TreeRow key={type} last={gi === groups.length - 1} delay={groupDelay}>
                    {/* type folder */}
                    <div className="h-8 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-lavender-100 text-chrome flex items-center justify-center">
                        <Icon name={getIconForType(type)} className="text-sm" />
                      </span>
                      <h4 className="text-xs font-bold text-carbon-700 uppercase tracking-wider">
                        {type.endsWith("s") ? type : `${type}s`}
                      </h4>
                      <span className="text-[11px] font-bold text-carbon-500 bg-lavender-100 rounded-full px-2 py-0.5">
                        {items.length}
                      </span>
                    </div>

                    {/* children, nested one level deeper (trunk lines up under the folder icon) */}
                    <ul className="ml-3">
                      {items.map((item, ii) => {
                        const itemDelay = groupDelay + 0.2 + step++ * 0.07;
                        const external = !!item.url && item.url !== "#";
                        const inner = (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-on-chrome-muted shrink-0" />
                            <span className="truncate">{item.title}</span>
                            {external && (
                              <Icon
                                name="arrow-forward"
                                className="ml-auto shrink-0 text-expresso opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100 group-focus-visible:translate-x-0"
                              />
                            )}                          </>
                        );
                        return (
                          <TreeRow key={item.id} last={ii === items.length - 1} delay={itemDelay}>
                            {external ? (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="group h-8 flex items-center gap-2 text-sm text-expresso hover:text-deep-emerald hover:underline rounded-lg px-2 -mx-2 hover:bg-lavender-50 transition-colors"
                              >
                                {inner}
                              </a>
                            ) : (
                              <div className="h-8 flex items-center gap-2 text-sm text-carbon-700 px-2 -mx-2">
                                {inner}
                              </div>
                            )}
                          </TreeRow>
                        );
                      })}
                    </ul>
                  </TreeRow>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}