import { decode } from "nostr-tools/nip19";
import { parse } from "yaml";
import { z } from "zod";

const signIn = z.array(z.enum(["nip07", "nip46", "nip55", "nsec", "session", "guest", "none"]));
const listed = z.strictObject({
  listing: z.string().regex(/^31990:[0-9a-f]{64}:.+$/),
  signIn: signIn.optional(),
  note: z.string().optional(),
});
const own = z.strictObject({
  name: z.string().min(1),
  url: z.url({ protocol: /^https$/ }),
  tags: z.array(z.string().regex(/^[a-z0-9-]+$/)),
  signIn: signIn.min(1),
  repo: z.url({ protocol: /^https$/ }).optional(),
  developer: z
    .string()
    .refine((s) => s.startsWith("npub1") && decode(s as `npub1${string}`).type === "npub")
    .optional(),
  kinds: z.array(z.int().nonnegative()).optional(),
  note: z.string().optional(),
});

type Listed = z.infer<typeof listed>;
type Own = z.infer<typeof own> & { about: string };
export type CatalogGame = { id: string } & (Listed | Own);

const DECORATION = /^\s*(# .*|!\[[^\]]*\]\([^)]*\)|<img\b[^>]*>)\s*$/gm;

export function parseGame(id: string, readme: string): CatalogGame {
  const [, front = "", body = ""] = readme.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/) ?? [];
  const data: unknown = parse(front);
  if (data && typeof data === "object" && "listing" in data) return { id, ...listed.parse(data) };
  const about = body.replace(DECORATION, "").trim();
  if (!about) throw new Error(`games/${id}/README.md has no description`);
  return { id, ...own.parse(data), about };
}

export interface Pick {
  id: string;
  note?: string;
}

const picks = z
  .array(z.union([z.string(), z.strictObject({ id: z.string(), note: z.string().optional() })]))
  .transform((list) => list.map((p): Pick => (typeof p === "string" ? { id: p } : p)))
  .refine((list) => new Set(list.map((p) => p.id)).size === list.length, "a pick is listed twice");

export const parsePicks = (yaml: string) => picks.parse(parse(yaml));

const CURATED = "Curated by Keyhall: https://github.com/anchorman-lol/keyhall";

export const listingEvent = (
  game: Own & { id: string },
  images: string,
  created_at: number,
  curated = true,
) => ({
  kind: 31990,
  created_at,
  content: JSON.stringify({
    name: game.name,
    about: curated ? `${game.about}\n\n${CURATED}` : game.about,
    picture: `${images}/${game.id}/icon.png`,
    banner: `${images}/${game.id}/banner.png`,
    website: game.url,
  }),
  tags: [
    ["d", game.id],
    ["web", game.url, "url"],
    ...(game.kinds ?? []).map((k) => ["k", String(k)]),
    ...["games", ...game.tags].map((t) => ["t", t]),
    ...game.signIn.map((m) => ["auth", m]),
    ...(game.repo ? [["r", game.repo]] : []),
    ...(game.developer ? [["zap", decode(game.developer as `npub1${string}`).data as string]] : []),
  ],
});

export const addressOf = (game: CatalogGame, pubkey: string) =>
  "listing" in game ? game.listing : `31990:${pubkey}:${game.id}`;

export function picksEvent(list: Pick[], games: CatalogGame[], pubkey: string, created_at: number) {
  const addresses = list.map(({ id }) => {
    const game = games.find((g) => g.id === id);
    if (!game) throw new Error(`picks.yaml names ${id}, which has no folder in games/`);
    return ["a", addressOf(game, pubkey)];
  });
  return {
    kind: 30267,
    created_at,
    content: "",
    tags: [
      ["d", "games-default"],
      ["title", "Keyhall picks"],
      ["description", "Games Keyhall's maintainer played and vouches for."],
      ["t", "games"],
      ...addresses,
    ],
  };
}
