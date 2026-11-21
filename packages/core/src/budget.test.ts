import { describe, expect, it } from "vitest";
import { monthKey, monthRange, playTime, previousMonth, split } from "./budget";

const minutes = (m: number) => m * 60;

describe("split", () => {
  const played = {
    nochess: minutes(580),
    word5: minutes(252),
    nomad: minutes(200),
    sanki: minutes(125),
    pallasite: minutes(90),
    blobbi: minutes(55),
    parlour: minutes(40),
    spacezappers: minutes(12),
  };

  it("splits the budget by play time, as in the budget mockup", () => {
    const { shares, reserve } = split(5000, played, (c) => c !== "parlour");
    expect(reserve).toBe(50);
    expect(shares.map((s) => [s.coordinate, s.sats, s.reason])).toEqual([
      ["nochess", 2205, undefined],
      ["word5", 958, undefined],
      ["nomad", 761, undefined],
      ["sanki", 475, undefined],
      ["pallasite", 342, undefined],
      ["blobbi", 209, undefined],
      ["parlour", 0, "unpayable"],
      ["spacezappers", 0, "floor"],
    ]);
    expect(shares[0]!.percent).toBeCloseTo(580 / 1342);
    expect(shares[6]!.percent).toBeCloseTo(40 / 1342);
    expect(shares[7]!.percent).toBe(0);
  });

  it("always pays out exactly the budget minus the reserve", () => {
    const { shares, reserve } = split(1001, { a: 1000, b: 1000, c: 1000 }, () => true);
    expect(reserve).toBe(11);
    expect(shares.map((s) => s.sats)).toEqual([330, 330, 330]);
  });

  it("redistributes shares under the minimum payout", () => {
    const { shares } = split(1000, { a: minutes(900), b: minutes(20) }, () => true);
    expect(shares.map((s) => [s.sats, s.reason])).toEqual([
      [990, undefined],
      [0, "minimum"],
    ]);
  });

  it("pays nothing without a budget or payable play time", () => {
    expect(split(0, { a: minutes(60) }, () => true).shares[0]!.sats).toBe(0);
    expect(split(5000, { a: minutes(60) }, () => false).shares[0]).toMatchObject({
      sats: 0,
      reason: "unpayable",
    });
  });
});

describe("play time", () => {
  const at = (iso: string) => new Date(iso).getTime() / 1000;

  it("names months in local time", () => {
    expect(monthKey(new Date(2026, 10, 30, 23, 59))).toBe("2026-11");
    expect(previousMonth("2026-01")).toBe("2025-12");
    expect(monthRange("2026-12")).toEqual([at("2026-12-01T00:00"), at("2027-01-01T00:00")]);
  });

  it("adds up sessions per game and clips them to the month", () => {
    const sessions = [
      { coordinate: "a", start: at("2026-10-31T23:00"), end: at("2026-11-01T01:00") },
      { coordinate: "a", start: at("2026-11-05T10:00"), end: at("2026-11-05T10:30") },
      { coordinate: "b", start: at("2026-11-30T23:50"), end: at("2026-12-01T00:10") },
      { coordinate: "c", start: at("2026-12-02T10:00"), end: at("2026-12-02T11:00") },
    ];
    expect(playTime(sessions, "2026-11")).toEqual({ a: minutes(90), b: minutes(10) });
  });
});
