import { decode } from "nostr-tools/nip19";
import { isGame, tag, type NostrEvent } from "./listing";

export const PICKS = "Keyhall picks";

// npub1veczhnyw2tuuahcxu2tuskmkfs5pwpfnzy2pdvej9g3ux8gxyu2qy0evky
export const PICKS_PUBKEY = "66702bcc8e52f9cedf06e297c85b764c28170533111416b3322a23c31d062714";

export interface ListRef {
  pubkey: string;
  d?: string;
  relays?: string[];
}

export const PICKS_REF: ListRef = { pubkey: PICKS_PUBKEY, d: "games-default" };

export interface CuratorList {
  address: string;
  pubkey: string;
  title: string;
  description: string | undefined;
  image: string | undefined;
  games: string[];
}

export function parseListRef(input: string): ListRef | undefined {
  try {
    const { type, data } = decode(input.trim().replace(/^nostr:/, ""));
    if (type === "npub") return { pubkey: data };
    if (type === "nprofile") return { pubkey: data.pubkey, relays: data.relays };
    if (type === "naddr" && data.kind === 30267)
      return { pubkey: data.pubkey, d: data.identifier, relays: data.relays };
  } catch {}
  return undefined;
}

export const refId = (ref: ListRef) =>
  ref.d === undefined ? ref.pubkey : `30267:${ref.pubkey}:${ref.d}`;

export function listsFor(ref: ListRef, events: NostrEvent[]): CuratorList[] {
  const newest = new Map<string, NostrEvent>();
  for (const e of events) {
    const d = tag(e, "d");
    const wanted = ref.d === undefined ? isGame(e) : d === ref.d;
    if (e.kind !== 30267 || e.pubkey !== ref.pubkey || d === undefined || !wanted) continue;
    const seen = newest.get(d);
    if (!seen || seen.created_at < e.created_at) newest.set(d, e);
  }
  return [...newest].map(([d, e]) => ({
    address: `30267:${e.pubkey}:${d}`,
    pubkey: e.pubkey,
    title: tag(e, "title") ?? d,
    description: tag(e, "description"),
    image: tag(e, "image"),
    games: e.tags.filter((t) => t[0] === "a" && t[1]?.startsWith("31990:")).map((t) => t[1]!),
  }));
}
