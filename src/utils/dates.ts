export type DeadlineTone = "overdue" | "today" | "upcoming" | "done";

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseISODate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parseISODate(value);
  return Number.isFinite(parsed.getTime()) && toISODate(parsed) === value;
}

export function dateFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function describeDeadline(
  iso: string,
  completed: boolean,
): { label: string; tone: DeadlineTone } {
  const due = parseISODate(iso);
  const today = parseISODate(toISODate(new Date()));
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    ...(due.getFullYear() === today.getFullYear() ? {} : { year: "numeric" as const }),
  });
  const shortDate = formatter.format(due);

  if (completed) return { label: `Done · ${shortDate}`, tone: "done" };
  if (days < 0) {
    const suffix = days === -1 ? "day" : "days";
    return { label: `${Math.abs(days)} ${suffix} overdue · ${shortDate}`, tone: "overdue" };
  }
  if (days === 0) return { label: "Due today", tone: "today" };
  if (days === 1) return { label: "Due tomorrow", tone: "upcoming" };
  return { label: `Due ${shortDate}`, tone: "upcoming" };
}

export function isOverdue(dueDate: string | null, completed: boolean): boolean {
  if (completed || !dueDate) return false;

  const due = parseISODate(dueDate);
  const today = parseISODate(toISODate(new Date()));
  return due.getTime() < today.getTime();
}

const noteTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatNoteTime(timestamp: number): string {
  return noteTimeFormatter.format(new Date(timestamp));
}
