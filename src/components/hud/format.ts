import { DAY, HOUR } from "@/lib/store";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Human-first duration: "12 m", "41 h 12 m", "3 d 6 h". Under two days hours stay the unit people
 * plan with; from two days on, days + hours. Zero units are dropped.
 */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  if (totalMin < 60) return `${totalMin} m`;
  if (ms < 2 * DAY) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m === 0 ? `${h} h` : `${h} h ${m} m`;
  }
  const totalH = Math.round(ms / HOUR);
  const d = Math.floor(totalH / 24);
  const h = totalH % 24;
  return h === 0 ? `${d} d` : `${d} d ${h} h`;
}

/** "15 Jan 2027" (UTC) */
export function formatDate(t: number): string {
  const d = new Date(t);
  return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "15 Jan" (UTC) */
export function formatDayMonth(t: number): string {
  const d = new Date(t);
  return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]}`;
}

/** "14:00" (UTC) */
export function formatClock(t: number): string {
  const d = new Date(t);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** "15 Jan 2027 14:00 UTC" */
export function formatUtc(t: number): string {
  return `${formatDate(t)} ${formatClock(t)} UTC`;
}

/** value for `<input type="date">`: "2027-01-15" (UTC) */
export function toDateInput(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}
