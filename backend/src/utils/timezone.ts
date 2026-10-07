/** The hour (0-23) `date` falls on in `timeZone`; falls back to server local time for an unset/invalid zone. */
export function localHour(date: Date, timeZone?: string): number {
  if (!timeZone) return date.getHours();
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hour12: false }).formatToParts(date);
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "", 10);
    if (Number.isNaN(hour)) return date.getHours();
    return hour === 24 ? 0 : hour;
  } catch {
    return date.getHours();
  }
}

/** `date`'s calendar day in `timeZone` as "YYYY-MM-DD"; falls back to server local time for an unset/invalid zone. */
export function localDateKey(date: Date, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  }
}

