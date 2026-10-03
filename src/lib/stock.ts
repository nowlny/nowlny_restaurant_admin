import { intlLocale, translate, type Locale } from "@/lib/i18n";
import type { MenuItem, MenuSection, StockSchedule, WeekDay } from "@/services/api/menu";
import { WEEK_DAYS } from "@/services/api/menu";

/**
 * Dish stock helpers. The API resolves `isAvailable` (schedules and lapsed
 * one-offs included); the admin displays it and never works it out itself.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** `Date` → 24h `HH:mm`, the shape `<input type="time">` and the API use. */
export const toHHmm = (date: Date): string => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/**
 * The next time the clock reads `HH:mm`: today if still ahead, else
 * tomorrow — what "out of stock until 20:00" means to a kitchen.
 */
export const nextOccurrence = (value: string, now = new Date()): Date => {
  const [h, m] = value.split(":").map(Number);
  const at = new Date(now);
  at.setHours(h || 0, m || 0, 0, 0);
  if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
  return at;
};

/** "Monday" … in the UI language. 2024-01-01 was a Monday. */
export const weekdayName = (day: WeekDay, locale: Locale, width: "long" | "short" = "long"): string =>
  new Intl.DateTimeFormat(intlLocale(locale), { weekday: width }).format(
    new Date(2024, 0, 1 + WEEK_DAYS.indexOf(day)),
  );

/** "18:00", "Tomorrow 07:00" or "Monday 07:00". */
export const formatStockTime = (iso: string, locale: Locale): string => {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const time = toHHmm(at);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (at.toDateString() === today.toDateString()) return time;
  if (at.toDateString() === tomorrow.toDateString()) {
    return `${translate(locale, "stock.tomorrow")} ${time}`;
  }
  return `${new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long" }).format(at)} ${time}`;
};

/** The schedule a dish follows: its own, else its section's. Such a dish takes no one-off (409). */
export const scheduleFor = (
  item: MenuItem,
  section: MenuSection | undefined,
  schedules: StockSchedule[],
): StockSchedule | undefined => {
  const id = item.stockScheduleId || section?.stockScheduleId;
  return id ? schedules.find((s) => s.id === id) : undefined;
};

/** When an out-of-stock dish comes back, or that it is out until someone turns it on. */
export const stockStatusText = (item: MenuItem, locale: Locale): string | null => {
  if (item.isAvailable !== false) return null;
  if (item.outOfStockUntil) {
    return translate(locale, "stock.out_until", { time: formatStockTime(item.outOfStockUntil, locale) });
  }
  if (item.availableAt) {
    return translate(locale, "stock.available_from", { time: formatStockTime(item.availableAt, locale) });
  }
  return translate(locale, "stock.out_until_turned_on");
};
