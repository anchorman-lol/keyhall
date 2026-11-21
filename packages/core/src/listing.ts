import type { Depth } from "./depth";

export type SignIn = "signer" | "signer-or-nsec" | "nsec" | "throwaway" | "none" | "unknown";

export interface NostrEvent {
  kind: number;
  id: string;
  pubkey: string;
  created_at: number;
  content: string;
  tags: string[][];
  sig: string;
}

export interface Game {
  coordinate: string;
  pubkey: string;
  name: string;
  about: string | undefined;
  picture: string | undefined;
  banner: string | undefined;
  url: string;
  createdAt: number;
  signIn: SignIn;
  depth: Depth | undefined;
  repos: string[];
  payTo: Recipient[];
}

export interface Recipient {
  pubkey: string;
  weight: number;
  lud16?: string;
}

const DEPTHS: readonly string[] = ["multiplayer", "identity", "none"] satisfies Depth[];
const SIGNERS = ["nip07", "nip46", "nip55"];

export function signInBadge(tags: string[][]): SignIn {
  const methods = new Set(tags.filter((t) => t[0] === "auth").map((t) => t[1]));
  const signer = SIGNERS.some((m) => methods.has(m));
  if (methods.has("nsec")) return signer ? "signer-or-nsec" : "nsec";
  if (signer) return "signer";
  if (methods.has("guest") || methods.has("session")) return "throwaway";
  if (methods.has("none")) return "none";
  return "unknown";
}

export function lastUpdated(...times: (number | undefined)[]): number {
  return Math.max(...times.filter((t) => t !== undefined));
}

export const tag = (e: NostrEvent, name: string) => e.tags.find((t) => t[0] === name)?.[1];
const https = (url: unknown) =>
  typeof url === "string" && url.startsWith("https://") ? url : undefined;

function metadata(content: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(content);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const isGame = (e: NostrEvent) =>
  e.tags.some((t) => t[0] === "t" && /^games?$/i.test(t[1] ?? ""));

function payTo(e: NostrEvent, lud16: string | undefined): Recipient[] {
  const zaps = e.tags.filter((t) => t[0] === "zap" && /^[0-9a-f]{64}$/.test(t[1] ?? ""));
  if (!zaps.length) return lud16 ? [{ pubkey: e.pubkey, weight: 1, lud16 }] : [];
  const weighted = zaps.some((t) => t[3]);
  return zaps
    .map((t) => ({ pubkey: t[1] as string, weight: weighted ? Number(t[3]) || 0 : 1 }))
    .filter((r) => r.weight > 0);
}

function parseListing(e: NostrEvent, curated: boolean): Game | undefined {
  const d = tag(e, "d");
  if (e.kind !== 31990 || d === undefined || !(curated || isGame(e))) return undefined;
  const meta = metadata(e.content);
  const url = https(meta.website) ?? https(tag(e, "web")?.replace("<bech32>", ""));
  if (!url) return undefined;
  const text = (key: string) =>
    typeof meta[key] === "string" && meta[key] ? meta[key] : undefined;
  const depth = tag(e, "depth");
  return {
    coordinate: `31990:${e.pubkey}:${d}`,
    pubkey: e.pubkey,
    name: text("display_name") ?? text("name") ?? d,
    about: text("about"),
    picture: https(meta.picture),
    banner: https(meta.banner),
    url,
    createdAt: e.created_at,
    signIn: signInBadge(e.tags),
    depth: depth && DEPTHS.includes(depth) ? (depth as Depth) : undefined,
    repos: e.tags
      .filter((t) => t[0] === "a" && t[1]?.startsWith("30617:"))
      .map((t) => t[1] as string),
    payTo: payTo(e, text("lud16")),
  };
}

export function parseListings(events: NostrEvent[], curated = false): Game[] {
  const newest = new Map<string, Game>();
  for (const e of events) {
    const game = parseListing(e, curated);
    const seen = game && newest.get(game.coordinate);
    if (game && (!seen || seen.createdAt < game.createdAt)) newest.set(game.coordinate, game);
  }
  return [...newest.values()].sort((a, b) => a.name.localeCompare(b.name));
}
