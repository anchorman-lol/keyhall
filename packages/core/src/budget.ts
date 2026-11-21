export interface Session {
  coordinate: string;
  start: number;
  end: number;
}

export interface Share {
  coordinate: string;
  seconds: number;
  percent: number;
  sats: number;
  reason?: "floor" | "unpayable" | "minimum";
}

const FLOOR = 15 * 60;
const MINIMUM_PAYOUT = 100;

const pad = (n: number) => String(n).padStart(2, "0");
export const monthKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

export const monthName = (month: string) =>
  new Date(`${month}-15`).toLocaleDateString("en", { month: "long", year: "numeric" });

export function monthRange(month: string): [number, number] {
  const [year, m] = month.split("-").map(Number) as [number, number];
  return [new Date(year, m - 1).getTime() / 1000, new Date(year, m).getTime() / 1000];
}

export const previousMonth = (month: string) => monthKey(new Date(monthRange(month)[0] * 1000 - 1));

export function playTime(sessions: Session[], month: string): Record<string, number> {
  const [from, to] = monthRange(month);
  const totals: Record<string, number> = {};
  for (const { coordinate, start, end } of sessions) {
    const seconds = Math.min(end, to) - Math.max(start, from);
    if (seconds > 0) totals[coordinate] = (totals[coordinate] ?? 0) + seconds;
  }
  return totals;
}

export function apportion(pot: number, weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map((w) => (pot * w) / total);
  const sats = exact.map(Math.floor);
  const byRemainder = exact.map((e, i) => [e - sats[i]!, i] as const).sort((a, b) => b[0] - a[0]);
  let leftover = pot - sats.reduce((a, b) => a + b, 0);
  for (const [, i] of byRemainder) if (leftover-- > 0) sats[i]!++;
  return sats;
}

export function split(
  budget: number,
  seconds: Record<string, number>,
  payable: (coordinate: string) => boolean,
): { shares: Share[]; reserve: number } {
  const reserve = Math.ceil(budget / 100);
  const counted = Object.values(seconds)
    .filter((s) => s >= FLOOR)
    .reduce((a, b) => a + b, 0);
  const shares: Share[] = Object.entries(seconds)
    .sort((a, b) => b[1] - a[1])
    .map(([coordinate, s]) => {
      const reason = s < FLOOR ? "floor" : payable(coordinate) ? undefined : "unpayable";
      return { coordinate, seconds: s, percent: s < FLOOR ? 0 : s / counted, sats: 0, reason };
    });
  for (;;) {
    const paid = shares.filter((s) => !s.reason);
    if (!paid.length || budget <= 0) break;
    const sats = apportion(
      budget - reserve,
      paid.map((s) => s.seconds),
    );
    const small = sats.findLastIndex((s) => s < MINIMUM_PAYOUT);
    if (small === -1) {
      paid.forEach((s, i) => (s.sats = sats[i]!));
      break;
    }
    paid[small]!.reason = "minimum";
  }
  return { shares, reserve };
}
