import { SimplePool } from "nostr-tools/pool";
import { listsFor, type CuratorList, type ListRef } from "./curation";
import { lastUpdated, parseListings, type Game } from "./listing";

const RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
  "wss://relay.ditto.pub",
];
const REPO_RELAYS = [...RELAYS, "wss://relay.ngit.dev"];
const pool = new SimplePool();

export async function fetchGames(): Promise<Game[]> {
  const events = await pool.querySync(
    RELAYS,
    { kinds: [31990], "#t": ["game", "games", "Game", "Games"] },
    { maxWait: 6000 },
  );
  return parseListings(events);
}

export async function fetchLists(ref: ListRef): Promise<CuratorList[]> {
  const events = await pool.querySync(
    [...new Set([...(ref.relays ?? []), ...RELAYS])],
    { kinds: [30267], authors: [ref.pubkey], ...(ref.d !== undefined && { "#d": [ref.d] }) },
    { maxWait: 6000 },
  );
  return listsFor(ref, events);
}

export async function fetchListings(coordinates: string[]): Promise<Game[]> {
  if (!coordinates.length) return [];
  const parts = coordinates.map((c) => c.split(":"));
  const events = await pool.querySync(
    RELAYS,
    {
      kinds: [31990],
      authors: [...new Set(parts.map((p) => p[1]!))],
      "#d": [...new Set(parts.map((p) => p[2]!))],
    },
    { maxWait: 6000 },
  );
  return parseListings(events, true).filter((g) => coordinates.includes(g.coordinate));
}

async function github(repo: string, path: string, field: string): Promise<number | undefined> {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`).catch(() => undefined);
  const value: unknown = res?.ok
    ? ((await res.json()) as Record<string, unknown>)[field]
    : undefined;
  return typeof value === "string" ? Date.parse(value) / 1000 : undefined;
}

export async function fetchLastUpdated(game: Game): Promise<number> {
  const times: (number | undefined)[] = [game.createdAt];
  for (const coordinate of game.repos) {
    const [, author, d] = coordinate.split(":");
    if (!author || !d) continue;
    const events = await pool.querySync(
      REPO_RELAYS,
      { kinds: [30617, 30618], authors: [author], "#d": [d] },
      { maxWait: 4000 },
    );
    times.push(...events.filter((e) => e.kind === 30618).map((e) => e.created_at));
    const repo = events
      .flatMap((e) => e.tags)
      .filter((t) => t[0] === "web" || t[0] === "clone")
      .flatMap((t) => t.slice(1))
      .map((u) => u.match(/^https:\/\/github\.com\/([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/)?.[1])
      .find(Boolean);
    if (repo)
      times.push(
        await github(repo, "", "pushed_at"),
        await github(repo, "/releases/latest", "published_at"),
      );
  }
  return lastUpdated(...times);
}
