export const READS = ["listings", "lists", "social"] as const;
export const WRITES = ["presence", "labels", "zaps"] as const;
export type ReadUse = (typeof READS)[number];
export type WriteUse = (typeof WRITES)[number];
export type Use = ReadUse | WriteUse;

export interface Relay {
  url: string;
  enabled: boolean;
  read: ReadUse[];
  write: WriteUse[];
}

export const MAIN_RELAY = "wss://relay.anchorman.lol";

const everything = (url: string): Relay => ({
  url,
  enabled: true,
  read: [...READS],
  write: [...WRITES],
});
const readOnly = (url: string): Relay => ({ ...everything(url), write: [] });

export const DEFAULT_RELAYS: Relay[] = [
  everything(MAIN_RELAY),
  everything("wss://relay.nostr.net"),
  everything("wss://relay.primal.net"),
  readOnly("wss://nostr.wine"),
  readOnly("wss://relay.nostr.wirednet.jp"),
];

export function normalizeRelay(input: string): string | undefined {
  const text = input.trim();
  if (!text) return;
  try {
    const url = new URL(text.includes("://") ? text : `wss://${text}`);
    if (url.protocol !== "wss:" || !url.hostname) return;
    return `wss://${url.host}${url.pathname.replace(/\/+$/, "")}${url.search}`;
  } catch {
    return;
  }
}

export function addRelay(relays: Relay[], input: string): Relay[] | undefined {
  const url = normalizeRelay(input);
  if (!url) return;
  return relays.some((r) => r.url === url) ? relays : [...relays, everything(url)];
}

export const removeRelay = (relays: Relay[], url: string) => relays.filter((r) => r.url !== url);

export const toggleRelay = (relays: Relay[], url: string) =>
  relays.map((r) => (r.url === url ? { ...r, enabled: !r.enabled } : r));

const isRead = (use: Use): use is ReadUse => (READS as readonly string[]).includes(use);

export const setUse = (relays: Relay[], url: string, use: Use, on: boolean) =>
  relays.map((r) => {
    if (r.url !== url) return r;
    const key = isRead(use) ? "read" : "write";
    const all: readonly Use[] = isRead(use) ? READS : WRITES;
    const uses: Use[] = r[key];
    return { ...r, [key]: all.filter((u) => (u === use ? on : uses.includes(u))) };
  });

export const relaysFor = (relays: Relay[], use: Use) =>
  relays.filter((r) => r.enabled && [...r.read, ...r.write].includes(use)).map((r) => r.url);

export const writeUseOf = (kind: number): WriteUse => (kind === 1985 ? "labels" : "presence");

export function loadRelays(saved: unknown): Relay[] {
  if (!Array.isArray(saved)) return DEFAULT_RELAYS;
  const relays: Relay[] = [];
  for (const entry of saved) {
    const { url, enabled, read, write } = (entry ?? {}) as Record<string, unknown>;
    const normal = typeof url === "string" ? normalizeRelay(url) : undefined;
    if (!normal || typeof enabled !== "boolean" || relays.some((r) => r.url === normal)) continue;
    const pick = <T extends string>(all: readonly T[], saved: unknown) =>
      all.filter((u) => Array.isArray(saved) && saved.includes(u));
    relays.push({ url: normal, enabled, read: pick(READS, read), write: pick(WRITES, write) });
  }
  return relays;
}
