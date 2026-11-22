import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseGame, parsePicks, picksEvent } from "./catalog";

const root = new URL("../../../", import.meta.url);
const games = new URL("games/", root);
const ids = readdirSync(games);

function pngSize(file: URL) {
  const png = readFileSync(file);
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20), bytes: png.length };
}

describe.each(ids)("games/%s", (id) => {
  const game = parseGame(id, readFileSync(new URL(`${id}/README.md`, games), "utf8"));

  it.runIf("name" in game)("has a square icon and a cover-shaped banner", () => {
    const icon = pngSize(new URL(`${id}/icon.png`, games));
    expect(icon.width).toBe(icon.height);
    expect(icon.width).toBeGreaterThanOrEqual(128);
    expect(icon.width).toBeLessThanOrEqual(1024);
    const banner = pngSize(new URL(`${id}/banner.png`, games));
    expect(banner.width).toBeGreaterThanOrEqual(800);
    expect(banner.width).toBeLessThanOrEqual(2400);
    expect(banner.width / banner.height).toBeGreaterThanOrEqual(1.3);
    expect(banner.width / banner.height).toBeLessThanOrEqual(2.1);
    expect(icon.bytes + banner.bytes).toBeLessThan(1_000_000);
  });

  it.runIf("listing" in game)("keeps no images of its own next to the developer's listing", () => {
    expect(existsSync(new URL(`${id}/icon.png`, games))).toBe(false);
    expect(existsSync(new URL(`${id}/banner.png`, games))).toBe(false);
  });
});

it("picks.yaml names only games in the catalog", () => {
  const all = ids.map((id) =>
    parseGame(id, readFileSync(new URL(`${id}/README.md`, games), "utf8")),
  );
  const picks = parsePicks(readFileSync(new URL("picks.yaml", root), "utf8"));
  expect(picksEvent(picks, all, "p".repeat(64), 0).tags.filter((t) => t[0] === "a")).toHaveLength(
    picks.length,
  );
});
