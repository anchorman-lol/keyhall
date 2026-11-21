import { createContext, useContext, useState, type ReactNode } from "react";
import { friendsIn, GAMES, RUNNING, SOURCES, source, type Game, type SourceId } from "../data.ts";
import type { Layout } from "./config.ts";

export type View = "all" | "recent" | "friends" | SourceId;

type Win = {
  layout: Layout;
  set: (patch: Partial<Layout>) => void;
  compact: boolean;
  view: View;
  setView: (v: View) => void;
  on: Record<SourceId, boolean>;
  toggle: (id: SourceId) => void;
  presence: boolean;
  setPresence: (v: boolean) => void;
  running: Game | null;
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
  const [view, setView] = useState<View>("all");
  const [on, setOn] = useState(
    () => Object.fromEntries(SOURCES.map((s) => [s.id, s.on])) as Record<SourceId, boolean>,
  );
  const [presence, setPresence] = useState(true);
  const value: Win = {
    layout,
    set,
    compact: layout.density === "compact",
    view,
    setView,
    on,
    toggle: (id) => setOn((o) => ({ ...o, [id]: !o[id] })),
    presence,
    setPresence,
    running: layout.playing ? GAMES.find((g) => g.id === RUNNING.game)! : null,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const VIEW_TITLE: Record<"all" | "recent" | "friends", string> = {
  all: "All games",
  recent: "Recently played",
  friends: "Played by friends",
};

export const viewTitle = (v: View) =>
  v in VIEW_TITLE ? VIEW_TITLE[v as "all"] : source(v as SourceId).name;

export function visibleGames(view: View, on: Record<SourceId, boolean>) {
  if (view === "recent") return GAMES.filter((g) => g.lastPlayed && on[g.source]);
  if (view === "friends") return GAMES.filter((g) => friendsIn(g.id).length);
  if (view !== "all") return GAMES.filter((g) => g.source === view);
  return GAMES.filter((g) => on[g.source]);
}

const RECENCY = ["Now", "Today", "Yesterday", "3 days ago", "Last week"];
const recency = (g: Game) => {
  const i = RECENCY.indexOf(g.lastPlayed ?? "");
  return i === -1 ? (g.lastPlayed ? 10 : 99) : i;
};
export const byRecency = (a: Game, b: Game) => recency(a) - recency(b);

export function groups(games: Game[], running: Game | null) {
  const now = games.filter((g) => g.id === running?.id);
  const rest = games.filter((g) => g.id !== running?.id);
  const friends = rest.filter((g) => friendsIn(g.id).length);
  const recent = rest.filter((g) => g.lastPlayed && !friends.includes(g)).sort(byRecency);
  const fresh = rest.filter((g) => !g.lastPlayed && !friends.includes(g));
  return [
    { title: "Playing now", games: now },
    { title: "Friends are in", games: friends },
    { title: "Recently played", games: recent },
    { title: "Not played yet", games: fresh },
  ].filter((g) => g.games.length);
}
