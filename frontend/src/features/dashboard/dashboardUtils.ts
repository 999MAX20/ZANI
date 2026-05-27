export type DashboardPeriod = "today" | "week" | "month";

export function formatMoney(value: number) {
  return `${value.toLocaleString("ru-RU")} ₸`;
}

export function isTodayDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}

export function isWithinPeriod(value: string, period: DashboardPeriod) {
  const date = new Date(value);
  const now = new Date();
  const start = new Date(now);

  if (period === "today") {
    start.setHours(0, 0, 0, 0);
  }

  if (period === "week") {
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  }

  if (period === "month") {
    start.setDate(now.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  }

  return date >= start && date <= now;
}
