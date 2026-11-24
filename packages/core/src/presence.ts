import { npubEncode } from "nostr-tools/nip19";
import * as nip44 from "nostr-tools/nip44";
import { createWrap } from "nostr-tools/nip59";
import {
  finalizeEvent,
  generateSecretKey,
  getEventHash,
  getPublicKey,
  verifyEvent,
  type Event,
  type EventTemplate,
} from "nostr-tools/pure";
import type { Filter } from "nostr-tools/filter";
import { bytesToHex, hexToBytes } from "nostr-tools/utils";
import { https, type Game } from "./listing";

export type PresenceMode = "public" | "friends" | "hidden";

export interface PresenceSettings {
  mode: PresenceMode;
  games: Record<string, PresenceMode>;
}

export interface Circle {
  secret: string;
  members: string[];
}

export interface Status {
  content: string;
  coordinate: string | undefined;
  expires: number;
  at: number;
}

export interface Friend {
  pubkey: string;
  name?: string;
  picture?: string;
}

export interface Published {
  mode: PresenceMode;
  coordinate: string;
  secret?: string;
}

export interface UserSigner {
  signEvent(template: EventTemplate): Promise<Event>;
  nip44Encrypt(pubkey: string, text: string): Promise<string>;
  nip44Decrypt(pubkey: string, text: string): Promise<string>;
}

export const DEFAULT_PRESENCE: PresenceSettings = { mode: "friends", games: {} };
export const STATUS_TTL = 3 * 60 * 60;
const CIRCLE_D = "keyhall/presence";

export const modeFor = (settings: PresenceSettings, coordinate: string) =>
  settings.games[coordinate] ?? settings.mode;

export const friendName = (f: Friend) => f.name ?? `${npubEncode(f.pubkey).slice(0, 12)}…`;

export function parseProfile(pubkey: string, event?: Event): Friend {
  try {
    const { name, display_name, picture } = JSON.parse(event?.content ?? "{}");
    return { pubkey, name: display_name || name || undefined, picture: https(picture) };
  } catch {
    return { pubkey };
  }
}

export const circlePubkey = (secret: string) => getPublicKey(hexToBytes(secret));

const circleKey = (secret: string) =>
  nip44.getConversationKey(hexToBytes(secret), circlePubkey(secret));

const link = (game: Game) =>
  !game.custom ? [["a", game.coordinate]] : game.custom === "web" ? [["r", game.url]] : [];

function status(game: Game | undefined, now: number) {
  return {
    content: game ? `Playing ${game.name}` : "",
    tags: game ? link(game) : [],
    expiration: game ? [["expiration", String(now + STATUS_TTL)]] : [],
  };
}

export function publicStatus(game: Game | undefined, now: number): EventTemplate {
  const { content, tags, expiration } = status(game, now);
  return { kind: 30315, content, tags: [["d", "game"], ...tags, ...expiration], created_at: now };
}

export function circleStatus(secret: string, game: Game | undefined, now: number): Event {
  const { content, tags, expiration } = status(game, now);
  return finalizeEvent(
    {
      kind: 30315,
      content: game ? nip44.encrypt(JSON.stringify({ content, tags }), circleKey(secret)) : "",
      tags: [["d", "game"], ...expiration],
      created_at: now,
    },
    hexToBytes(secret),
  );
}

export function readStatus(event: Event, secret?: string): Status | undefined {
  if (!event.content) return;
  let inner: { content: string; tags: string[][] } = event;
  if (secret) {
    try {
      inner = JSON.parse(nip44.decrypt(event.content, circleKey(secret)));
    } catch {
      return;
    }
  }
  const tag = (tags: string[][], name: string) => tags.find((t) => t[0] === name)?.[1];
  return {
    content: inner.content,
    coordinate: tag(inner.tags, "a"),
    expires: Number(tag(event.tags, "expiration") ?? Infinity),
    at: event.created_at,
  };
}

export function planCircle(circle: Circle | undefined, follows: string[]) {
  const kept = new Set(circle?.members);
  if (!circle || circle.members.some((m) => !follows.includes(m)))
    return {
      circle: { secret: bytesToHex(generateSecretKey()), members: follows },
      wrapTo: follows,
    };
  return { circle: { ...circle, members: follows }, wrapTo: follows.filter((f) => !kept.has(f)) };
}

export async function wrapCircle(signer: UserSigner, me: string, secret: string, to: string) {
  const now = Math.floor(Date.now() / 1000);
  const rumor = {
    kind: 30078,
    content: secret,
    tags: [["d", CIRCLE_D]],
    created_at: now,
    pubkey: me,
  };
  const seal = await signer.signEvent({
    kind: 13,
    content: await signer.nip44Encrypt(to, JSON.stringify({ ...rumor, id: getEventHash(rumor) })),
    tags: [],
    created_at: now,
  });
  return createWrap(seal, to);
}

export async function unwrapCircle(signer: UserSigner, wrap: Event) {
  try {
    const seal: Event = JSON.parse(await signer.nip44Decrypt(wrap.pubkey, wrap.content));
    if (seal.kind !== 13 || !verifyEvent(seal)) return;
    const rumor: Event = JSON.parse(await signer.nip44Decrypt(seal.pubkey, seal.content));
    const ok =
      rumor.pubkey === seal.pubkey &&
      rumor.kind === 30078 &&
      rumor.tags.some((t) => t[0] === "d" && t[1] === CIRCLE_D) &&
      /^[0-9a-f]{64}$/.test(rumor.content);
    return ok ? { owner: rumor.pubkey, secret: rumor.content, at: rumor.created_at } : undefined;
  } catch {
    return;
  }
}

export interface PresenceDeps extends UserSigner {
  subscribe(filter: Filter, onEvent: (event: Event) => void): () => void;
  publish(event: Event): Promise<void>;
}

export function watchFriends(
  deps: PresenceDeps,
  me: string,
  follows: string[],
  send: (pubkey: string, at: number, status: Status | undefined) => void,
) {
  if (!follows.length) return () => {};
  const friends = new Set(follows);
  const newest: Record<string, number> = {};
  const statuses = (author: string, owner: string, secret?: string) =>
    deps.subscribe({ kinds: [30315], authors: [author], "#d": ["game"] }, (e) =>
      send(owner, e.created_at, readStatus(e, secret)),
    );
  const closers = [
    deps.subscribe({ kinds: [30315], authors: follows, "#d": ["game"] }, (e) => {
      if (friends.has(e.pubkey)) send(e.pubkey, e.created_at, readStatus(e));
    }),
    deps.subscribe({ kinds: [1059], "#p": [me] }, (wrap) => {
      void unwrapCircle(deps, wrap).then((circle) => {
        if (!circle || !friends.has(circle.owner) || (newest[circle.owner] ?? 0) >= circle.at)
          return;
        newest[circle.owner] = circle.at;
        closers.push(statuses(circlePubkey(circle.secret), circle.owner, circle.secret));
      });
    }),
  ];
  return () => closers.forEach((close) => close());
}

export interface PublishInput {
  me: string;
  wanted: Published | undefined;
  game: Game | undefined;
  published: Published | undefined;
  circle: Circle | undefined;
  follows: string[];
}

export async function publishPresence(deps: PresenceDeps, input: PublishInput) {
  const { me, wanted, game, published, follows } = input;
  const now = Math.floor(Date.now() / 1000);
  let circle = input.circle;
  if (wanted?.mode === "friends") {
    const plan = planCircle(circle, follows);
    circle = plan.circle;
    const secret = circle.secret;
    await Promise.all(
      plan.wrapTo.map(async (to) => deps.publish(await wrapCircle(deps, me, secret, to))),
    );
  }
  const secret = wanted?.mode === "friends" ? circle?.secret : undefined;
  const status = async (mode: PresenceMode, secret: string | undefined, game?: Game) =>
    deps.publish(
      mode === "public"
        ? await deps.signEvent(publicStatus(game, now))
        : circleStatus(secret!, game, now),
    );
  if (published && (published.mode !== wanted?.mode || published.secret !== secret))
    await status(published.mode, published.secret);
  if (wanted) await status(wanted.mode, secret, game);
  return { published: wanted && { ...wanted, secret }, circle };
}
