import { describe, expect, it } from "vitest";
import { KEYHALL, monthKey, monthRange, payouts, playTime, previousMonth, split } from "./budget";

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
    const { shares, reserve } = split(5000, played, (c) => c !== "parlour", 0);
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
    const { shares, reserve } = split(1001, { a: 1000, b: 1000, c: 1000 }, () => true, 0);
    expect(reserve).toBe(11);
    expect(shares.map((s) => s.sats)).toEqual([330, 330, 330]);
  });

  it("redistributes shares under the minimum payout", () => {
    const { shares } = split(1000, { a: minutes(900), b: minutes(20) }, () => true, 0);
    expect(shares.map((s) => [s.sats, s.reason])).toEqual([
      [990, undefined],
      [0, "minimum"],
    ]);
  });

  it("pays nothing without a budget or payable play time", () => {
    expect(split(0, { a: minutes(60) }, () => true, 5)).toMatchObject({ keyhall: 0 });
    expect(split(5000, { a: minutes(60) }, () => false, 5)).toMatchObject({
      shares: [{ sats: 0, reason: "unpayable" }],
      keyhall: 0,
    });
  });

  it("takes the Keyhall share off the top before the games split", () => {
    const { shares, reserve, keyhall } = split(5000, { a: 3000, b: 1000 }, () => true, 5);
    expect([keyhall, reserve]).toEqual([250, 50]);
    expect(shares.map((s) => s.sats)).toEqual([3525, 1175]);
  });

  it("takes no Keyhall share at 0%", () => {
    expect(split(5000, { a: 3000 }, () => true, 0)).toMatchObject({
      keyhall: 0,
      shares: [{ sats: 4950 }],
    });
  });

  it("gives a Keyhall share under the minimum payout back to the games", () => {
    expect(split(1900, { a: 3000 }, () => true, 5)).toMatchObject({
      keyhall: 0,
      shares: [{ sats: 1881 }],
    });
  });

  it("still sums to the budget with a Keyhall share", () => {
    for (const [budget, percent] of [
      [2017, 7],
      [10_001, 13],
      [3333, 20],
    ] as const) {
      const { shares, reserve, keyhall } = split(
        budget,
        { a: minutes(17), b: minutes(31), c: minutes(43) },
        () => true,
        percent,
      );
      expect(shares.reduce((a, s) => a + s.sats, keyhall + reserve)).toBe(budget);
    }
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

describe("payouts", () => {
  it("sums each paid month, newest first, counting games rather than developers", () => {
    expect(
      payouts({
        "2026-08": { "31990:a:x pk1": 300 },
        "2026-09": {
          "31990:a:x pk1": 600,
          "31990:a:x pk2": 400,
          "31990:b:y pk3": 1000,
          [KEYHALL.key]: 100,
        },
        "2026-10": {},
      }),
    ).toEqual([
      { month: "2026-09", sats: 2100, games: 2 },
      { month: "2026-08", sats: 300, games: 1 },
    ]);
  });
});
