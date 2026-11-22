import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  DEPTH,
  depth,
  friendsIn,
  GAMES,
  recentlyUpdated,
  RUNNING,
  SOURCES,
  type Game,
  type SourceId,
} from "../data.ts";
import type { Layout } from "./config.ts";

export const SORTS = {
  played: "Last played",
  name: "Name",
  updated: "Recently updated",
  time: "Most played",
} as const;
export type Sort = keyof typeof SORTS;

export type Filters = {
  q: string;
  sources: Record<SourceId, boolean>;
  unvetted: boolean;
  signer: boolean;
  depth: number;
  multiplayer: boolean;
  friends: boolean;
  updated: boolean;
  sort: Sort;
};

const BASE: Filters = {
  q: "",
  sources: Object.fromEntries(SOURCES.map((s) => [s.id, s.on])) as Record<SourceId, boolean>,
  unvetted: false,
  signer: false,
  depth: 0,
  multiplayer: false,
  friends: false,
  updated: false,
  sort: "played",
};

const APPLIED: Filters = {
  ...BASE,
  sources: { ...BASE.sources, board: false },
  signer: true,
  multiplayer: true,
};

type Win = {
  layout: Layout;
  set: (patch: Partial<Layout>) => void;
  compact: boolean;
  filters: Filters;
  setFilters: (patch: Partial<Filters>) => void;
  clearFilters: () => void;
  presence: boolean;
  setPresence: (v: boolean) => void;
  running: Game | null;
  open: (id: string | null) => void;
};

const Ctx = createContext<Win | null>(null);
export const useWin = () => useContext(Ctx)!;

export function WinProvider({
  layout,
  set,
  children,
}: {
  layout: Layout;
  set: (patch: Partial<Layout>) => void;
  children: ReactNode;
}) {
  const [filters, setAll] = useState(layout.filtered ? APPLIED : BASE);
  useEffect(() => setAll(layout.filtered ? APPLIED : BASE), [layout.filtered]);
  const [presence, setPresence] = useState(true);
  const value: Win = {
    layout,
    set,
    compact: layout.density === "compact",
    filters,
    setFilters: (patch) => setAll((f) => ({ ...f, ...patch })),
    clearFilters: () => {
      setAll(BASE);
      set({ filtered: false });
    },
    presence,
    setPresence,
    running: layout.playing ? GAMES.find((g) => g.id === RUNNING.game)! : null,
    open: (id) => set({ selected: id, page: "library" }),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Filters the library is narrowed by beyond the default sources, as removable tokens. */
export function activeFilters(f: Filters, setFilters: Win["setFilters"]) {
  const t: { key: string; label: string; clear: () => void }[] = [];
  for (const s of SOURCES)
    if (f.sources[s.id] !== BASE.sources[s.id])
      t.push({
        key: s.id,
        label: f.sources[s.id] ? `+ ${s.name}` : `No ${s.name}`,
        clear: () => setFilters({ sources: { ...f.sources, [s.id]: BASE.sources[s.id] } }),
      });
  if (f.unvetted)
    t.push({ key: "unvetted", label: "Unvetted", clear: () => setFilters({ unvetted: false }) });
  if (f.signer)
    t.push({
      key: "signer",
      label: "Signs through Keyhall",
      clear: () => setFilters({ signer: false }),
    });
  if (f.depth)
    t.push({
      key: "depth",
      label: DEPTH[f.depth]!,
      clear: () => setFilters({ depth: 0 }),
    });
  if (f.multiplayer)
    t.push({
      key: "multiplayer",
      label: "Multiplayer",
      clear: () => setFilters({ multiplayer: false }),
    });
  if (f.friends)
    t.push({
      key: "friends",
      label: "Friends playing",
      clear: () => setFilters({ friends: false }),
    });
  if (f.updated)
    t.push({
      key: "updated",
      label: "Updated recently",
      clear: () => setFilters({ updated: false }),
    });
  return t;
}

const RECENCY = ["Now", "Today", "Yesterday", "3 days ago", "Last week"];
const recency = (g: Game) => {
  const i = RECENCY.indexOf(g.lastPlayed ?? "");
  return i === -1 ? (g.lastPlayed ? 10 : 99) : i;
};
const updatedRank = (g: Game) => (recentlyUpdated(g) ? 0 : 1);

const SORT_FN: Record<Sort, (a: Game, b: Game) => number> = {
  played: (a, b) => recency(a) - recency(b),
  name: (a, b) => a.name.localeCompare(b.name),
  updated: (a, b) => updatedRank(a) - updatedRank(b) || recency(a) - recency(b),
  time: (a, b) => (b.minutes ?? 0) - (a.minutes ?? 0),
};

export function visibleGames(f: Filters, running: Game | null) {
  const q = f.q.trim().toLowerCase();
  return GAMES.filter(
    (g) =>
      f.sources[g.source] &&
      (!q || `${g.name} ${g.genre}`.toLowerCase().includes(q)) &&
      (!f.signer || g.signIn === "signer") &&
      depth(g) >= f.depth &&
      (!f.multiplayer || g.multiplayer) &&
      (!f.friends || friendsIn(g.id).length > 0) &&
      (!f.updated || recentlyUpdated(g)),
  ).sort(
    (a, b) => Number(b.id === running?.id) - Number(a.id === running?.id) || SORT_FN[f.sort](a, b),
  );
}

export function groups(games: Game[], running: Game | null, sort: Sort) {
  if (sort !== "played") return [{ title: SORTS[sort], games }];
  const now = games.filter((g) => g.id === running?.id);
  const rest = games.filter((g) => g.id !== running?.id);
  const friends = rest.filter((g) => friendsIn(g.id).length);
  const recent = rest.filter((g) => g.lastPlayed && !friends.includes(g));
  const fresh = rest.filter((g) => !g.lastPlayed && !friends.includes(g));
  return [
    { title: "Playing now", games: now },
    { title: "Friends are in", games: friends },
    { title: "Recently played", games: recent },
    { title: "Not played yet", games: fresh },
  ].filter((g) => g.games.length);
}
