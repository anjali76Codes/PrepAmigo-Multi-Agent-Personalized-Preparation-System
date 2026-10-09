import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAppContext } from "../context/AppContext";
import { Icon } from "../components/ui/Icon";
import { Mascot } from "../components/ui/Mascot";
import { Button, cn } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

type Notif = ReturnType<typeof useAppContext>["notifications"][number];

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "missed-task", label: "Missed tasks" },
  { id: "plan-update", label: "Plan updates" },
  { id: "reminder", label: "Reminders" },
  { id: "daily-digest", label: "Daily digest" },
  { id: "quiz-result", label: "Quiz results" },
  { id: "streak-warning", label: "Streaks" },
  { id: "milestone-unlock", label: "Milestones" },
] as const;

const TYPE_META: Record<string, { icon: string; tone: string }> = {
  reminder: { icon: "time-outline", tone: "bg-lavender-100 text-cocoa border-border" },
  "missed-task": { icon: "warning-outline", tone: "bg-danger-100 text-danger-600 border-danger-600/20" },
  "plan-update": { icon: "sync-outline", tone: "bg-soft-rose text-expresso border-expresso/20" },
  "quiz-result": { icon: "analytics-outline", tone: "bg-sky-100 text-sky-500 border-sky-500/20" },
  "streak-warning": { icon: "flame-outline", tone: "bg-beige-100 text-beige-600 border-beige-600/20" },
  "milestone-unlock": { icon: "trophy-outline", tone: "bg-chrome text-on-chrome border-chrome-border" },
  "daily-digest": { icon: "sunny-outline", tone: "bg-beige-100 text-beige-600 border-beige-600/20" },
};
const DEFAULT_META = { icon: "notifications-outline", tone: "bg-surface text-carbon-500 border-border" };

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d).setHours(0, 0, 0, 0);

function groupLabel(ts: string | number | Date) {
  const diff = Math.round((startOfDay(new Date()) - startOfDay(new Date(ts))) / DAY);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return "This week";
  return "Earlier";
}

function timeLabel(ts: string | number | Date) {
  const d = new Date(ts);
  const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / DAY);
  if (diff <= 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diff < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

function NotificationItem({
  notif, index, reduce, onRead,
}: {
  notif: Notif; index: number; reduce: boolean | null; onRead: () => void;
}) {
  const meta = TYPE_META[notif.type] ?? DEFAULT_META;

  return (
    <motion.li
      layout={reduce ? false : "position"}
      initial={{ opacity: 0, y: reduce ? 0 : 12 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.25, delay: Math.min(index, 8) * 0.04 } }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onRead}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onRead();
          }
        }}
        className={cn(
          "group relative flex gap-4 rounded-3xl border p-5 transition-all duration-200 cursor-pointer outline-offset-2 sm:p-6",
          "hover:-translate-y-0.5",
          notif.read
            ? "border-border/70 bg-surface/60 hover:bg-surface"
            : "border-border bg-surface shadow-pop"
        )}
      >
        {!notif.read && (
          <span
            aria-label="Unread"
            className="absolute right-5 top-5 h-2.5 w-2.5 rounded-full bg-forest-emerald ring-4 ring-sky-100"
          />
        )}

        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full border", meta.tone)}>
          <Icon name={meta.icon} className="text-2xl" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3 pr-5">
            <h3
              className={cn(
                "truncate text-base",
                notif.read ? "font-semibold text-carbon-700" : "font-extrabold text-carbon-900"
              )}
            >
              {notif.title}
            </h3>
            <time className="shrink-0 text-xs font-medium text-carbon-500">{timeLabel(notif.timestamp)}</time>
          </div>

          <p className="mt-1 text-sm leading-relaxed text-carbon-500">{notif.message}</p>

          {notif.reason && (
            <p className="mt-3 inline-flex max-w-full items-start gap-1.5 rounded-full border border-border bg-lavender-100 px-3 py-1 text-xs text-carbon-700">
              <Icon name="information-circle-outline" className="mt-px shrink-0 text-sm text-rosewood" />
              <span className="min-w-0">
                <span className="font-bold">Why:</span> {notif.reason}
              </span>
            </p>
          )}

          {notif.type === "missed-task" && !notif.read && (
            <div className="mt-4">
              <Button
                size="sm"
                variant="accent"
                onClick={(e) => e.stopPropagation()}
                className="gap-1.5 px-4 font-bold"
              >
                <Icon name="calendar-outline" />
                Reschedule task
              </Button>
            </div>
          )}
        </div>
      </div>
    </motion.li>
  );
}

export function Notifications() {
  const reduce = useReducedMotion();
  const { notifications, markNotificationRead, markAllNotificationsRead, refreshNotifications } = useAppContext();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");

  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: notifications.length, unread: unreadCount };
    for (const n of notifications) c[n.type] = (c[n.type] ?? 0) + 1;
    return c;
  }, [notifications, unreadCount]);

  const groups = useMemo(() => {
    const list = notifications
      .filter((n) => (filter === "all" ? true : filter === "unread" ? !n.read : n.type === filter))
      .slice()
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const map = new Map<string, Notif[]>();
    for (const n of list) {
      const label = groupLabel(n.timestamp);
      map.set(label, [...(map.get(label) ?? []), n]);
    }
    return [...map.entries()];
  }, [notifications, filter]);

  const visibleFilters = FILTERS.filter((f) => f.id === "all" || f.id === "unread" || (counts[f.id] ?? 0) > 0);

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-bg text-carbon-700">
      {/* header */}
      <div className="z-10 shrink-0 px-4 pt-6 md:px-8 md:pt-8">
        <Card variant="default" className="mx-auto max-w-8xl space-y-5 rounded-3xl bg-lavender-100 p-6 md:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-expresso text-on-chrome">
                <Icon name="notifications" className="text-2xl" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-lavender-100 bg-forest-emerald px-1 text-[11px] font-bold text-on-chrome">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-carbon-900 md:text-3xl">Notifications</h1>
                <p className="text-sm text-carbon-500 md:text-base">
                  {unreadCount > 0
                    ? `You have ${unreadCount} unread ${unreadCount === 1 ? "update" : "updates"}.`
                    : "You're all caught up."}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={unreadCount === 0}
              onClick={() => void markAllNotificationsRead()}
              className="shrink-0 gap-1.5 border border-border bg-surface font-bold text-chrome hover:bg-surface/70"
            >
              <Icon name="checkmark-done-outline" />
              Mark all read
            </Button>
          </div>

          {/* filter chips */}
          <div
            role="tablist"
            aria-label="Filter notifications"
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {visibleFilters.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-colors",
                    active
                      ? "border-expresso bg-expresso text-on-chrome shadow-sm"
                      : "border-border bg-surface text-cocoa hover:bg-lavender-50 hover:text-carbon-900"
                  )}
                >
                  {f.label}
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-extrabold",
                      active ? "bg-white/20 text-on-chrome" : "bg-lavender-100 text-carbon-500"
                    )}
                  >
                    {counts[f.id] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {/* list */}
      <div className="safe-area-bottom relative flex-1 overflow-y-auto px-4 pb-12 pt-6 md:px-8">
        <div className="mx-auto max-w-4xl space-y-8">
          {groups.length > 0 ? (
            <AnimatePresence mode="popLayout" initial={false}>
              {groups.map(([label, items]) => (
                <motion.section key={label} layout={reduce ? false : "position"} className="space-y-3">
                  <h2 className="px-2 text-xs font-extrabold uppercase tracking-wider text-carbon-500">{label}</h2>
                  <ul className="space-y-3">
                    <AnimatePresence initial={false}>
                      {items.map((n, i) => (
                        <NotificationItem
                          key={n.id}
                          notif={n}
                          index={i}
                          reduce={reduce}
                          onRead={() => void markNotificationRead(n.id)}
                        />
                      ))}
                    </AnimatePresence>
                  </ul>
                </motion.section>
              ))}
            </AnimatePresence>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: reduce ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto flex max-w-sm flex-col items-center gap-3 py-16 text-center"
            >
              <Mascot variant="Running.png" size="xl" style={{ width: 140, height: 140 }} />
              <h3 className="text-lg font-extrabold text-carbon-900">
                {filter === "unread" ? "Nothing unread" : "Nothing here yet"}
              </h3>
              <p className="text-sm text-carbon-500">
                {filter === "all"
                  ? "New updates about your plan and progress will show up here."
                  : "No notifications match this filter."}
              </p>
              {filter !== "all" && (
                <Button variant="ghost" size="sm" onClick={() => setFilter("all")} className="font-bold text-chrome">
                  Show all
                </Button>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}