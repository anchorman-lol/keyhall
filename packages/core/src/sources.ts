import { PICKS_REF, refId, type ListRef } from "./curation";
import type { Game } from "./listing";

export interface CuratorSetting {
  ref: ListRef;
  enabled: boolean;
}

export interface SourceSettings {
  picks: boolean;
  unvetted: boolean;
  curators: CuratorSetting[];
}

export interface Source {
  id: string;
  ref?: ListRef;
  enabled: boolean;
}

export interface Entry {
  game: Game;
  from: string[];
}

export const PICKS_ID = "picks";
export const UNVETTED_ID = "unvetted";
export const defaultSources: SourceSettings = { picks: true, unvetted: false, curators: [] };

export const sourceList = (s: SourceSettings): Source[] => [
  { id: PICKS_ID, ref: PICKS_REF, enabled: s.picks },
  ...s.curators.map((c) => ({ id: refId(c.ref), ref: c.ref, enabled: c.enabled })),
  { id: UNVETTED_ID, enabled: s.unvetted },
];

export function toggleSource(s: SourceSettings, id: string): SourceSettings {
  if (id === PICKS_ID) return { ...s, picks: !s.picks };
  if (id === UNVETTED_ID) return { ...s, unvetted: !s.unvetted };
  return {
    ...s,
    curators: s.curators.map((c) => (refId(c.ref) === id ? { ...c, enabled: !c.enabled } : c)),
  };
}

export function addCurator(s: SourceSettings, ref: ListRef): SourceSettings {
  const id = refId(ref);
  if (id === refId(PICKS_REF) || s.curators.some((c) => refId(c.ref) === id)) return s;
  return { ...s, curators: [...s.curators, { ref, enabled: true }] };
}

export const removeCurator = (s: SourceSettings, id: string): SourceSettings => ({
  ...s,
  curators: s.curators.filter((c) => refId(c.ref) !== id),
});

const isRef = (r: unknown): r is ListRef => {
  const { pubkey, d, relays } = (r ?? {}) as Record<string, unknown>;
  return (
    typeof pubkey === "string" &&
    (d === undefined || typeof d === "string") &&
    (relays === undefined || (Array.isArray(relays) && relays.every((u) => typeof u === "string")))
  );
};

export function loadSources(saved: unknown): SourceSettings {
  const { picks, unvetted, curators } = (saved ?? {}) as Record<string, unknown>;
  const valid =
    typeof picks === "boolean" &&
    typeof unvetted === "boolean" &&
    Array.isArray(curators) &&
    curators.every((c: CuratorSetting) => isRef(c?.ref) && typeof c.enabled === "boolean");
  return valid ? { picks, unvetted, curators } : defaultSources;
}

export function union(sources: Source[], games: Record<string, Game[]>): Entry[] {
  const entries = new Map<string, Entry>();
  for (const { id, enabled } of sources) {
    if (!enabled) continue;
    for (const game of games[id] ?? []) {
      const entry = entries.get(game.coordinate);
      if (entry) entry.from.push(id);
      else entries.set(game.coordinate, { game, from: [id] });
    }
  }
  return [...entries.values()].sort((a, b) => a.game.name.localeCompare(b.game.name));
}
