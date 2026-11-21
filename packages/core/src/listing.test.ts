import { describe, expect, it } from "vitest";
import { lastUpdated, parseListings, signInBadge } from "./listing";

const listing = (
  over: Partial<{ tags: string[][]; content: string; created_at: number; pubkey: string }> = {},
) => ({
  kind: 31990,
  id: "e1",
  pubkey: "a".repeat(64),
  created_at: 1_790_000_000,
  sig: "s",
  content: JSON.stringify({
    name: "Blockstr",
    about: "Bitcoin-powered Tetris",
    picture: "https://example.com/logo.png",
    website: "https://blockstr.io",
  }),
  tags: [
    ["d", "blockstr"],
    ["t", "games"],
    ["web", "https://blockstr.io/<bech32>"],
    ["auth", "nip07"],
    ["depth", "identity"],
    ["a", `30617:${"b".repeat(64)}:blockstr`, "wss://relay.ngit.dev", "repo"],
  ],
  ...over,
});

describe("parseListings", () => {
  it("reads a game listing", () => {
    expect(parseListings([listing()])).toEqual([
      {
        coordinate: `31990:${"a".repeat(64)}:blockstr`,
        pubkey: "a".repeat(64),
        name: "Blockstr",
        about: "Bitcoin-powered Tetris",
        picture: "https://example.com/logo.png",
        banner: undefined,
        url: "https://blockstr.io",
        createdAt: 1_790_000_000,
        signIn: "signer",
        depth: "identity",
        repos: [`30617:${"b".repeat(64)}:blockstr`],
      },
    ]);
  });

  it("accepts both game and games topic tags, case-insensitively", () => {
    const game = listing({
      tags: [
        ["d", "x"],
        ["t", "Game"],
        ["web", "https://x.io"],
      ],
    });
    expect(parseListings([game])).toHaveLength(1);
  });

  it("skips listings that are not games, not 31990 or have no https url", () => {
    const notGame = listing({
      tags: [
        ["d", "x"],
        ["t", "ai"],
        ["web", "https://x.io"],
      ],
    });
    const noUrl = listing({
      content: "{}",
      tags: [
        ["d", "x"],
        ["t", "games"],
      ],
    });
    const httpOnly = listing({
      content: "{}",
      tags: [
        ["d", "x"],
        ["t", "games"],
        ["web", "http://x.io"],
      ],
    });
    expect(parseListings([notGame, noUrl, httpOnly, { ...listing(), kind: 1 }])).toEqual([]);
  });

  it("falls back to the web tag with the placeholder removed", () => {
    const game = listing({ content: JSON.stringify({ name: "Sats-Man" }) });
    expect(parseListings([game])[0]?.url).toBe("https://blockstr.io/");
  });

  it("survives malformed content and uses the d tag as name", () => {
    const game = listing({ content: "not json" });
    expect(parseListings([game])[0]).toMatchObject({
      name: "blockstr",
      url: "https://blockstr.io/",
    });
  });

  it("keeps only the newest event per coordinate, sorted by name", () => {
    const older = listing();
    const newer = listing({
      created_at: older.created_at + 10,
      content: JSON.stringify({ name: "Zeta", website: "https://z.io" }),
    });
    const other = listing({ pubkey: "c".repeat(64) });
    expect(parseListings([older, newer, other]).map((g) => g.name)).toEqual(["Blockstr", "Zeta"]);
  });

  it("ignores unknown depth values", () => {
    const game = listing({
      tags: [
        ["d", "x"],
        ["t", "games"],
        ["web", "https://x.io"],
        ["depth", "deep"],
      ],
    });
    expect(parseListings([game])[0]?.depth).toBeUndefined();
  });
});

describe("signInBadge", () => {
  const badge = (...methods: string[]) => signInBadge(methods.map((m) => ["auth", m]));

  it("is unknown without auth tags", () => expect(badge()).toBe("unknown"));
  it("is signer only for extension, bunker or signer app", () =>
    expect(badge("nip07", "nip46", "nip55")).toBe("signer"));
  it("shows the worst case when a signer comes with a paste box", () =>
    expect(badge("nip07", "nsec")).toBe("signer-or-nsec"));
  it("flags nsec-only games", () => expect(badge("nsec")).toBe("nsec"));
  it("treats guest and session keys as throwaway", () =>
    expect(badge("guest", "session")).toBe("throwaway"));
  it("prefers signer over throwaway when both are offered", () =>
    expect(badge("session", "nip46")).toBe("signer"));
  it("knows games without login", () => expect(badge("none")).toBe("none"));
  it("ignores unknown methods", () => expect(badge("carrier-pigeon")).toBe("unknown"));
});

describe("lastUpdated", () => {
  it("is the newest of listing, push and release", () =>
    expect(lastUpdated(100, 300, 200)).toBe(300));
  it("ignores missing repo times", () => expect(lastUpdated(100, undefined, undefined)).toBe(100));
});
