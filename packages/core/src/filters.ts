import type { Depth } from "./depth";
import type { SignIn } from "./listing";

export type Sort = "name" | "updated" | "played";

export interface Filters {
  q: string;
  sort: Sort;
  signer: boolean;
  friends: boolean;
  updated: boolean;
  depth: Exclude<Depth, "none"> | undefined;
}

export interface Facets {
  name: string;
  signIn: SignIn | undefined;
  depth: Depth | undefined;
  friends: number;
  updated: number;
  played: number;
}

export const NO_FILTERS: Filters = {
  q: "",
  sort: "name",
  signer: false,
  friends: false,
  updated: false,
  depth: undefined,
};

const RECENT = 14 * 86400;
const DEEP: Record<Depth, number> = { none: 0, identity: 1, multiplayer: 2 };

export const activeFilters = (f: Filters) =>
  (["signer", "friends", "updated", "depth"] as const).filter((k) => f[k]);

export function filterGames<T>(items: T[], facets: (item: T) => Facets, f: Filters, now: number) {
  const q = f.q.trim().toLowerCase();
  const order = {
    name: (a: Facets, b: Facets) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    updated: (a: Facets, b: Facets) => b.updated - a.updated,
    played: (a: Facets, b: Facets) => b.played - a.played,
  }[f.sort];
  return items
    .map((item) => [item, facets(item)] as const)
    .filter(
      ([, g]) =>
        g.name.toLowerCase().includes(q) &&
        (!f.signer || g.signIn === "signer") &&
        (!f.friends || g.friends > 0) &&
        (!f.updated || now - g.updated <= RECENT) &&
        (!f.depth || DEEP[g.depth ?? "none"] >= DEEP[f.depth]),
    )
    .sort(([, a], [, b]) => order(a, b) || a.name.localeCompare(b.name))
    .map(([item]) => item);
}
