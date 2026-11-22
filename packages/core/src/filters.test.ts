import { describe, expect, it } from "vitest";
import { activeFilters, filterGames, NO_FILTERS, type Facets } from "./filters";

const DAY = 86400;
const now = 100 * DAY;
const games: Facets[] = [
  {
    name: "Nochess",
    signIn: "signer",
    depth: "multiplayer",
    friends: 2,
    updated: now - DAY,
    played: 600,
  },
  {
    name: "blockstr",
    signIn: "nsec",
    depth: "identity",
    friends: 0,
    updated: now - 30 * DAY,
    played: 3600,
  },
  {
    name: "Pallasite",
    signIn: "unknown",
    depth: undefined,
    friends: 0,
    updated: now - 3 * DAY,
    played: 0,
  },
];
const names = (f: Partial<typeof NO_FILTERS>) =>
  filterGames(games, (g) => g, { ...NO_FILTERS, ...f }, now).map((g) => g.name);

describe("library filters", () => {
  it("shows everything by name, ignoring case, without filters", () => {
    expect(names({})).toEqual(["blockstr", "Nochess", "Pallasite"]);
    expect(activeFilters(NO_FILTERS)).toEqual([]);
  });

  it("searches names", () => {
    expect(names({ q: " CHESS" })).toEqual(["Nochess"]);
  });

  it("keeps games that sign through Keyhall, have friends in them or were updated in two weeks", () => {
    expect(names({ signer: true })).toEqual(["Nochess"]);
    expect(names({ friends: true })).toEqual(["Nochess"]);
    expect(names({ updated: true })).toEqual(["Nochess", "Pallasite"]);
  });

  it("keeps games at least as deep in Nostr as asked", () => {
    expect(names({ depth: "identity" })).toEqual(["blockstr", "Nochess"]);
    expect(names({ depth: "multiplayer" })).toEqual(["Nochess"]);
  });

  it("sorts by last update or by play time this month", () => {
    expect(names({ sort: "updated" })).toEqual(["Nochess", "Pallasite", "blockstr"]);
    expect(names({ sort: "played" })).toEqual(["blockstr", "Nochess", "Pallasite"]);
  });

  it("names each active filter, leaving search and sort out", () => {
    expect(
      activeFilters({ ...NO_FILTERS, q: "x", sort: "played", signer: true, depth: "identity" }),
    ).toEqual(["signer", "depth"]);
  });
});
