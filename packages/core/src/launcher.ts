import { decode, npubEncode } from "nostr-tools/nip19";
import { verifyEvent, type Event } from "nostr-tools/pure";
import { assign, enqueueActions, fromCallback, fromPromise, setup } from "xstate";
import { monthKey, monthName, playTime, split, type Session } from "./budget";
import { parseListRef, PICKS, PICKS_PUBKEY, type CuratorList, type ListRef } from "./curation";
import type { Depth, Observation } from "./depth";
import {
  depthVerdict,
  labelTemplate,
  parseLabels,
  signInVerdict,
  type Claim,
  type Label,
} from "./labels";
import type { Game } from "./listing";
import {
  DEFAULT_PRESENCE,
  modeFor,
  publishPresence,
  STATUS_TTL,
  watchFriends,
  type Circle,
  type Friend,
  type PresenceDeps,
  type PresenceMode,
  type PresenceSettings,
  type Published,
  type PublishInput,
  type Status,
} from "./presence";
import {
  addCurator,
  defaultSources,
  PICKS_ID,
  removeCurator,
  sourceList,
  toggleSource,
  union,
  UNVETTED_ID,
  type Source,
  type SourceSettings,
} from "./sources";
import {
  addRelay,
  removeRelay,
  setUse,
  toggleRelay,
  DEFAULT_RELAYS,
  type Relay,
  type Use,
} from "./relaySettings";
import { payments, type Payment } from "./zap";

export interface ShimCall {
  coordinate: string;
  event?: Event;
  verified?: boolean;
}

export interface SignRequest {
  id: number;
  game: string;
  coordinate: string;
  kind: number;
  content: string;
}

export type LauncherEvent =
  | { type: "shim"; call: ShimCall }
  | { type: "observed"; coordinate: string; kinds: number[] }
  | { type: "closed"; coordinate: string }
  | { type: "sign-request"; request: SignRequest }
  | { type: "key-field"; coordinate: string };

type KeyCommand = "generate_key" | "import_key";

export interface LauncherDeps extends PresenceDeps {
  keyStatus(): Promise<string | null>;
  saveKey(command: KeyCommand, nsec?: string): Promise<string>;
  fetchLists(ref: ListRef): Promise<CuratorList[]>;
  fetchListings(coordinates: string[]): Promise<Game[]>;
  fetchGames(): Promise<Game[]>;
  saveSources(sources: SourceSettings): void;
  saveRelays(relays: Relay[]): void;
  probeRelay(url: string): Promise<boolean>;
  fetchLastUpdated(game: Game): Promise<number>;
  openGame(game: Game): Promise<string>;
  checkGame(label: string): void;
  closeGame(label: string): void;
  answer(id: number, allow: boolean): void;
  listen(send: (event: LauncherEvent) => void): () => void;
  saveObserved(observed: Record<string, Observation>): void;
  fetchLabels(curators: string[]): Promise<Label[]>;
  signLabel(template: ReturnType<typeof labelTemplate>): Promise<Event>;
  publish(event: Event): Promise<void>;
  fetchFriends(pubkey: string): Promise<Friend[]>;
  fetchProfile(pubkey: string): Promise<Friend>;
  saveFriendsOpen(open: boolean): void;
  savePresence(presence: PresenceSettings, circle: Circle | undefined): void;
  sessions(): Promise<Session[]>;
  walletStatus(): Promise<string | null>;
  connectWallet(uri: string): Promise<string>;
  pay(payment: Payment, comment: string): Promise<void>;
  saveBudget(budget: BudgetSettings): void;
}

export interface BudgetSettings {
  sats: number;
  paid: Record<string, Record<string, number>>;
}

export interface Stored {
  observed: Record<string, Observation>;
  presence: PresenceSettings;
  circle: Circle;
  sources: SourceSettings;
  relays: Relay[];
  budget: BudgetSettings;
  friendsOpen: boolean;
}

export interface Fetched {
  lists: CuratorList[];
  games: string[];
}

export interface LauncherContext {
  sources: SourceSettings;
  sourceError: string;
  failed: string[];
  relays: Relay[];
  relayError: string;
  relayStatus: Record<string, "checking" | "connected" | "failed">;
  fetched: Record<string, Fetched>;
  listings: Record<string, Game>;
  loading: string[];
  updated: Record<string, number>;
  npub: string | null;
  keyError: string;
  calls: ShimCall[];
  observed: Record<string, Observation>;
  windows: Record<string, string>;
  requests: SignRequest[];
  labels: Label[];
  labelled: string[];
  labelError: string;
  keyWarnings: string[];
  current?: Game;
  view?: View;
  friends?: Friend[];
  friendsOpen: boolean;
  profile?: Friend;
  statuses: Record<string, Status>;
  presence: PresenceSettings;
  circle?: Circle;
  published?: Published;
  budget: BudgetSettings;
  sessions: Session[];
  wallet: string | null;
  walletError: string;
  payErrors: Record<string, string>;
}

export type View = "budget" | "settings" | "relays";

type Events =
  | LauncherEvent
  | { type: "key.create" }
  | { type: "key.import"; nsec: string }
  | { type: "select"; game?: Game }
  | { type: "play"; game: Game }
  | { type: "opened"; coordinate: string; label: string }
  | { type: "check"; game: Game }
  | { type: "quit"; game: Game }
  | { type: "answer"; allow: boolean }
  | { type: "source.toggle"; id: string }
  | { type: "source.add"; input: string }
  | { type: "source.remove"; id: string }
  | { type: "source.loaded"; id: string; lists: CuratorList[]; games: Game[]; failed?: boolean }
  | { type: "relay.add"; input: string }
  | { type: "relay.remove"; url: string }
  | { type: "relay.toggle"; url: string }
  | { type: "relay.use"; url: string; use: Use; on: boolean }
  | { type: "relay.status"; url: string; ok: boolean }
  | { type: "updated"; coordinate: string; time: number }
  | { type: "view"; view: View }
  | { type: "friends.toggle" }
  | { type: "presence.mode"; mode: PresenceMode }
  | { type: "presence.game"; coordinate: string; mode?: PresenceMode }
  | { type: "friend-status"; pubkey: string; at: number; status?: Status }
  | { type: "sessions"; sessions: Session[] }
  | { type: "budget.set"; sats: number }
  | { type: "wallet.connect"; uri: string }
  | { type: "budget.pay"; month: string }
  | { type: "zap.done"; month: string; payment: Payment; error?: string }
  | { type: "zap.finished" }
  | { type: "labels.loaded"; labels: Label[] }
  | { type: "label.publish"; game: Game; methods: string[]; depth: Depth | undefined }
  | { type: "warning.dismiss" };

const record = (
  context: LauncherContext,
  coordinate: string,
  update: (o: Observation) => Observation,
) => ({
  ...context.observed,
  [coordinate]: update(context.observed[coordinate] ?? { kinds: [], signer: false }),
});

export const findGame = (context: LauncherContext, coordinate: string) =>
  context.listings[coordinate];

const sourceGames = (context: LauncherContext, id: string) =>
  (context.fetched[id]?.games ?? []).flatMap((c) => context.listings[c] ?? []);

export const sourceCount = (context: LauncherContext, id: string) =>
  context.fetched[id] && sourceGames(context, id).length;

export function sourceLabel(context: LauncherContext, id: string) {
  if (id === PICKS_ID) return PICKS;
  if (id === UNVETTED_ID) return "Unvetted listings";
  const titles = context.fetched[id]?.lists.map((l) => l.title).join(" · ");
  const ref = sourceList(context.sources).find((s) => s.id === id)?.ref;
  const npub = ref ? npubEncode(ref.pubkey) : id;
  return titles || `${npub.slice(0, 10)}…${npub.slice(-4)}`;
}

export const unreachable = (context: LauncherContext) =>
  sourceList(context.sources).some((s) => s.enabled && context.failed.includes(s.id));

export const library = (context: LauncherContext) => {
  const sources = sourceList(context.sources);
  return union(
    sources,
    Object.fromEntries(sources.map(({ id }) => [id, sourceGames(context, id)])),
  );
};

async function fetchSource({ ref }: Source, deps: LauncherDeps) {
  if (!ref) return { lists: [], games: await deps.fetchGames() };
  const lists = await deps.fetchLists(ref);
  return { lists, games: await deps.fetchListings([...new Set(lists.flatMap((l) => l.games))]) };
}

export const updatedAt = (context: LauncherContext, game: Game) =>
  context.updated[game.coordinate] ?? game.createdAt;

export const observedKinds = (context: LauncherContext, game: Game) =>
  context.observed[game.coordinate]?.kinds ?? [];

const enabledLists = (context: LauncherContext) =>
  sourceList(context.sources)
    .filter((s) => s.enabled)
    .flatMap((s) => context.fetched[s.id]?.lists ?? []);

const curators = (context: LauncherContext) => [
  ...new Set(enabledLists(context).map((l) => l.pubkey)),
];

export function curatorName(context: LauncherContext, pubkey: string) {
  if (pubkey === PICKS_PUBKEY) return PICKS;
  const npub = npubEncode(pubkey);
  return (
    enabledLists(context).find((l) => l.pubkey === pubkey)?.title ??
    `${npub.slice(0, 10)}…${npub.slice(-4)}`
  );
}

export const pubkeyOf = (context: LauncherContext) =>
  context.npub ? (decode(context.npub as `npub1${string}`).data as string) : undefined;

export function wantedPresence(context: LauncherContext): Published | undefined {
  const coordinate = Object.keys(context.windows).findLast(
    (c) => modeFor(context.presence, c) !== "hidden",
  );
  return coordinate ? { mode: modeFor(context.presence, coordinate), coordinate } : undefined;
}

const needsPublish = (context: LauncherContext) => {
  const wanted = wantedPresence(context);
  const { published } = context;
  const same = wanted?.mode === published?.mode && wanted?.coordinate === published?.coordinate;
  return !!context.npub && !same && (wanted?.mode !== "friends" || !!context.friends);
};

export function playing(context: LauncherContext, now = Date.now() / 1000) {
  return (context.friends ?? []).flatMap((friend) => {
    const status = context.statuses[friend.pubkey];
    return status && status.expires > now ? [{ friend, status }] : [];
  });
}

export const running = (context: LauncherContext) =>
  Object.keys(context.windows).flatMap((coordinate) => {
    const game = findGame(context, coordinate);
    const since = context.sessions.findLast((s) => s.coordinate === coordinate)?.start;
    return game ? [{ game, since }] : [];
  });

export function monthSplit(context: LauncherContext, month: string) {
  const games = Object.values(context.listings);
  const paid = context.budget.paid[month] ?? {};
  const { shares, reserve } = split(
    context.budget.sats,
    playTime(context.sessions, month),
    (c) => !!findGame(context, c)?.payTo.length,
  );
  return {
    shares,
    reserve,
    paid,
    payments: payments(shares, games).filter((p) => !(p.key in paid)),
  };
}

export const isCurator = (context: LauncherContext) =>
  curators(context).includes(pubkeyOf(context) ?? "");

function claims<K extends "signIn" | "depth">(context: LauncherContext, game: Game, key: K) {
  return curators(context).flatMap((curator) => {
    const value = context.labels.find(
      (l) => l.curator === curator && l.coordinate === game.coordinate,
    )?.[key];
    return value ? [{ from: curator, value } as Claim<NonNullable<Label[K]>>] : [];
  });
}

export const signInOf = (context: LauncherContext, game: Game) =>
  signInVerdict(game.signIn, claims(context, game, "signIn"), context.observed[game.coordinate]);

export const depthOf = (context: LauncherContext, game: Game) =>
  depthVerdict(game.depth, claims(context, game, "depth"), context.observed[game.coordinate]);

const relaysChanged = ["saveRelays", "probeRelays", "refetch", "fetchSources"] as const;

export const launcherMachine = (deps: LauncherDeps, stored: Partial<Stored>) =>
  setup({
    types: {} as { context: LauncherContext; events: Events },
    actors: {
      listen: fromCallback<Events>(({ sendBack }) => deps.listen(sendBack)),
      keyStatus: fromPromise(() => deps.keyStatus()),
      saveKey: fromPromise<string, { command: KeyCommand; nsec?: string }>(({ input }) =>
        deps.saveKey(input.command, input.nsec),
      ),
      fetchSource: fromCallback<Events, Source>(({ input, sendBack }) => {
        void fetchSource(input, deps)
          .catch(() => ({ lists: [], games: [], failed: true }))
          .then((result) => sendBack({ type: "source.loaded", id: input.id, ...result }));
      }),
      probeRelay: fromCallback<Events, string>(({ input, sendBack }) => {
        void deps
          .probeRelay(input)
          .then((ok) => sendBack({ type: "relay.status", url: input, ok }));
      }),
      fetchUpdates: fromCallback<Events, Game[]>(({ input, sendBack }) => {
        void (async () => {
          for (const game of input) {
            sendBack({
              type: "updated",
              coordinate: game.coordinate,
              time: await deps.fetchLastUpdated(game),
            });
          }
        })();
      }),
      openGame: fromCallback<Events, Game>(({ input, sendBack }) => {
        void deps
          .openGame(input)
          .then((label) => sendBack({ type: "opened", coordinate: input.coordinate, label }));
      }),
      fetchFriends: fromPromise<Friend[], string>(({ input }) => deps.fetchFriends(input)),
      fetchProfile: fromPromise<Friend, string>(({ input }) =>
        deps.fetchProfile(input).catch(() => ({ pubkey: input })),
      ),
      watchFriends: fromCallback<Events, { me: string; follows: string[] }>(({ input, sendBack }) =>
        watchFriends(deps, input.me, input.follows, (pubkey, at, status) =>
          sendBack({ type: "friend-status", pubkey, at, status }),
        ),
      ),
      publishPresence: fromPromise<
        { published: Published | undefined; circle: Circle | undefined },
        PublishInput
      >(({ input }) => publishPresence(deps, input)),
      loadSessions: fromCallback<Events>(({ sendBack }) => {
        void deps.sessions().then((sessions) => sendBack({ type: "sessions", sessions }));
      }),
      walletStatus: fromPromise(() => deps.walletStatus()),
      connectWallet: fromPromise<string, string>(({ input }) => deps.connectWallet(input)),
      pay: fromCallback<Events, { month: string; payments: Payment[] }>(({ input, sendBack }) => {
        void (async () => {
          for (const payment of input.payments) {
            const error = await deps
              .pay(payment, `Keyhall monthly budget, ${monthName(input.month)}`)
              .then(() => undefined, String);
            sendBack({ type: "zap.done", month: input.month, payment, error });
          }
          sendBack({ type: "zap.finished" });
        })();
      }),
      fetchLabels: fromCallback<Events, string[]>(({ input, sendBack }) => {
        void deps
          .fetchLabels(input)
          .catch(() => [])
          .then((labels) => sendBack({ type: "labels.loaded", labels }));
      }),
      publishLabel: fromPromise<Event, Extract<Events, { type: "label.publish" }>>(
        async ({ input }) => {
          const event = await deps.signLabel(
            labelTemplate(input.game.coordinate, input.methods, input.depth),
          );
          await deps.publish(event);
          return event;
        },
      ),
    },
    actions: {
      saveObserved: ({ context }) => deps.saveObserved(context.observed),
      saveSources: ({ context }) => deps.saveSources(context.sources),
      saveRelays: ({ context }) => deps.saveRelays(context.relays),
      probeRelays: enqueueActions(({ context, enqueue }) => {
        const unchecked = context.relays.filter((r) => r.enabled && !context.relayStatus[r.url]);
        for (const { url } of unchecked) enqueue.spawnChild("probeRelay", { input: url });
        enqueue.assign({
          relayStatus: {
            ...context.relayStatus,
            ...Object.fromEntries(unchecked.map((r) => [r.url, "checking" as const])),
          },
        });
      }),
      refetch: assign({ fetched: {}, failed: [], loading: [] }),
      fetchSources: enqueueActions(({ context, enqueue }) => {
        const wanted = sourceList(context.sources).filter(
          (s) => s.enabled && !context.fetched[s.id] && !context.loading.includes(s.id),
        );
        for (const source of wanted) enqueue.spawnChild("fetchSource", { input: source });
        enqueue.assign({ loading: [...context.loading, ...wanted.map((s) => s.id)] });
      }),
      savePresence: ({ context }) => deps.savePresence(context.presence, context.circle),
      saveBudget: ({ context }) => deps.saveBudget(context.budget),
    },
    delays: { refresh: (STATUS_TTL - 10 * 60) * 1000 },
  }).createMachine({
    id: "launcher",
    type: "parallel",
    context: {
      sources: stored.sources ?? defaultSources,
      sourceError: "",
      failed: [],
      relays: stored.relays ?? DEFAULT_RELAYS,
      relayError: "",
      relayStatus: {},
      fetched: {},
      listings: {},
      loading: [],
      updated: {},
      npub: null,
      keyError: "",
      calls: [],
      observed: stored.observed ?? {},
      windows: {},
      requests: [],
      statuses: {},
      friendsOpen: stored.friendsOpen ?? true,
      presence: stored.presence ?? DEFAULT_PRESENCE,
      circle: stored.circle,
      budget: stored.budget ?? { sats: 0, paid: {} },
      sessions: [],
      wallet: null,
      walletError: "",
      payErrors: {},
      labels: [],
      labelled: [],
      labelError: "",
      keyWarnings: [],
    },
    invoke: { src: "listen" },
    entry: ["probeRelays", "fetchSources"],
    on: {
      "source.toggle": {
        actions: [
          assign({ sources: ({ context, event }) => toggleSource(context.sources, event.id) }),
          "saveSources",
          "fetchSources",
        ],
      },
      "source.add": {
        actions: [
          assign(({ context, event }) => {
            const ref = parseListRef(event.input);
            return ref
              ? { sources: addCurator(context.sources, ref), sourceError: "" }
              : { sourceError: "Paste a curator's npub or a list's naddr." };
          }),
          "saveSources",
          "fetchSources",
        ],
      },
      "source.remove": {
        actions: [
          assign({ sources: ({ context, event }) => removeCurator(context.sources, event.id) }),
          "saveSources",
        ],
      },
      "relay.add": [
        {
          guard: ({ context, event }) => addRelay(context.relays, event.input) === context.relays,
          actions: assign({ relayError: "" }),
        },
        {
          guard: ({ context, event }) => !addRelay(context.relays, event.input),
          actions: assign({ relayError: "Enter a relay address starting with wss://" }),
        },
        {
          actions: [
            assign({
              relays: ({ context, event }) => addRelay(context.relays, event.input)!,
              relayError: "",
            }),
            ...relaysChanged,
          ],
        },
      ],
      "relay.remove": {
        actions: [
          assign({ relays: ({ context, event }) => removeRelay(context.relays, event.url) }),
          ...relaysChanged,
        ],
      },
      "relay.toggle": {
        actions: [
          assign({ relays: ({ context, event }) => toggleRelay(context.relays, event.url) }),
          ...relaysChanged,
        ],
      },
      "relay.use": {
        actions: [
          assign({
            relays: ({ context, event }) => setUse(context.relays, event.url, event.use, event.on),
          }),
          ...relaysChanged,
        ],
      },
      "relay.status": {
        actions: assign({
          relayStatus: ({ context, event }) => ({
            ...context.relayStatus,
            [event.url]: event.ok ? "connected" : "failed",
          }),
        }),
      },
      "source.loaded": {
        actions: enqueueActions(({ context, event, enqueue }) => {
          const fresh = event.games.filter((g) => !context.listings[g.coordinate]);
          const unlabelled = [...new Set(event.lists.map((l) => l.pubkey))].filter(
            (p) => !context.labelled.includes(p),
          );
          enqueue.assign({
            loading: context.loading.filter((id) => id !== event.id),
            failed: event.failed
              ? [...context.failed, event.id]
              : context.failed.filter((id) => id !== event.id),
            fetched: {
              ...context.fetched,
              [event.id]: { lists: event.lists, games: event.games.map((g) => g.coordinate) },
            },
            listings: {
              ...context.listings,
              ...Object.fromEntries(event.games.map((g) => [g.coordinate, g])),
            },
          });
          if (fresh.length) enqueue.spawnChild("fetchUpdates", { input: fresh });
          if (unlabelled.length) {
            enqueue.assign({ labelled: [...context.labelled, ...unlabelled] });
            enqueue.spawnChild("fetchLabels", { input: unlabelled });
          }
        }),
      },
      "labels.loaded": {
        actions: assign({ labels: ({ context, event }) => [...context.labels, ...event.labels] }),
      },
      "key-field": {
        actions: [
          assign(({ context, event }) => ({
            observed: record(context, event.coordinate, (o) => ({ ...o, keyField: true })),
            keyWarnings: context.keyWarnings.includes(event.coordinate)
              ? context.keyWarnings
              : [...context.keyWarnings, event.coordinate],
          })),
          "saveObserved",
        ],
      },
      "warning.dismiss": {
        actions: assign({ keyWarnings: ({ context }) => context.keyWarnings.slice(1) }),
      },
      updated: {
        actions: assign({
          updated: ({ context, event }) => ({ ...context.updated, [event.coordinate]: event.time }),
        }),
      },
      select: {
        actions: [
          assign({ current: ({ event }) => event.game, view: undefined }),
          enqueueActions(({ enqueue, event }) => {
            if (event.game) enqueue.spawnChild("loadSessions");
          }),
        ],
      },
      view: {
        actions: [
          assign({ current: undefined, view: ({ event }) => event.view }),
          enqueueActions(({ enqueue, event }) => {
            if (event.view === "budget") enqueue.spawnChild("loadSessions");
          }),
        ],
      },
      "friends.toggle": {
        actions: [
          assign({ friendsOpen: ({ context }) => !context.friendsOpen }),
          ({ context }) => deps.saveFriendsOpen(context.friendsOpen),
        ],
      },
      "presence.mode": {
        actions: [
          assign({ presence: ({ context, event }) => ({ ...context.presence, mode: event.mode }) }),
          "savePresence",
        ],
      },
      "presence.game": {
        actions: [
          assign({
            presence: ({ context, event: { coordinate, mode } }) => {
              const { [coordinate]: _, ...games } = context.presence.games;
              return {
                ...context.presence,
                games: mode ? { ...games, [coordinate]: mode } : games,
              };
            },
          }),
          "savePresence",
        ],
      },
      "friend-status": {
        guard: ({ context, event }) => (context.statuses[event.pubkey]?.at ?? 0) <= event.at,
        actions: assign({
          statuses: ({ context, event: { pubkey, status } }) => {
            const { [pubkey]: _, ...rest } = context.statuses;
            return status ? { ...rest, [pubkey]: status } : rest;
          },
        }),
      },
      sessions: { actions: assign({ sessions: ({ event }) => event.sessions }) },
      "budget.set": {
        actions: [
          assign({ budget: ({ context, event }) => ({ ...context.budget, sats: event.sats }) }),
          "saveBudget",
        ],
      },
      play: {
        actions: enqueueActions(({ enqueue, event }) =>
          enqueue.spawnChild("openGame", { input: event.game }),
        ),
      },
      opened: {
        actions: [
          assign({
            windows: ({ context, event }) => {
              const { [event.coordinate]: _, ...windows } = context.windows;
              return { ...windows, [event.coordinate]: event.label };
            },
          }),
          enqueueActions(({ enqueue }) => enqueue.spawnChild("loadSessions")),
        ],
      },
      closed: {
        actions: assign({
          windows: ({ context, event }) => {
            const { [event.coordinate]: _, ...windows } = context.windows;
            return windows;
          },
        }),
      },
      check: {
        actions: ({ context, event }) => {
          const label = context.windows[event.game.coordinate];
          if (label) deps.checkGame(label);
        },
      },
      quit: {
        actions: ({ context, event }) => {
          const label = context.windows[event.game.coordinate];
          if (label) deps.closeGame(label);
        },
      },
      shim: {
        actions: [
          assign(({ context, event: { call } }) => {
            const verified =
              call.event && verifyEvent(call.event) && call.event.pubkey === pubkeyOf(context);
            return {
              calls: [...context.calls, { ...call, verified }],
              observed: record(context, call.coordinate, (o) => ({ ...o, signer: true })),
            };
          }),
          "saveObserved",
        ],
      },
      observed: {
        actions: [
          assign({
            observed: ({ context, event }) =>
              record(context, event.coordinate, (o) => ({
                ...o,
                kinds: [...new Set([...o.kinds, ...event.kinds])],
              })),
          }),
          "saveObserved",
        ],
      },
      "sign-request": {
        actions: assign({ requests: ({ context, event }) => [...context.requests, event.request] }),
      },
    },
    states: {
      key: {
        initial: "checking",
        states: {
          checking: {
            invoke: {
              src: "keyStatus",
              onDone: [
                {
                  guard: ({ event }) => event.output !== null,
                  target: "ready",
                  actions: assign({ npub: ({ event }) => event.output }),
                },
                { target: "setup" },
              ],
              onError: {
                target: "setup",
                actions: assign({ keyError: ({ event }) => String(event.error) }),
              },
            },
          },
          setup: {
            on: { "key.create": "saving", "key.import": "saving" },
          },
          saving: {
            invoke: {
              src: "saveKey",
              input: ({ event }) =>
                event.type === "key.import"
                  ? { command: "import_key", nsec: event.nsec }
                  : { command: "generate_key" },
              onDone: {
                target: "ready",
                actions: assign({ npub: ({ event }) => event.output, keyError: "" }),
              },
              onError: {
                target: "setup",
                actions: assign({ keyError: ({ event }) => String(event.error) }),
              },
            },
          },
          ready: {},
        },
      },
      friends: {
        initial: "waiting",
        states: {
          waiting: { always: { guard: ({ context }) => !!context.npub, target: "loading" } },
          loading: {
            invoke: {
              src: "fetchFriends",
              input: ({ context }) => pubkeyOf(context)!,
              onDone: {
                target: "ready",
                actions: assign({ friends: ({ event }) => event.output }),
              },
              onError: { target: "ready", actions: assign({ friends: [] }) },
            },
          },
          ready: {
            invoke: {
              src: "watchFriends",
              input: ({ context }) => ({
                me: pubkeyOf(context)!,
                follows: context.friends!.map((f) => f.pubkey),
              }),
            },
          },
        },
      },
      profile: {
        initial: "waiting",
        states: {
          waiting: { always: { guard: ({ context }) => !!context.npub, target: "loading" } },
          loading: {
            invoke: {
              src: "fetchProfile",
              input: ({ context }) => pubkeyOf(context)!,
              onDone: {
                target: "ready",
                actions: assign({ profile: ({ event }) => event.output }),
              },
            },
          },
          ready: {},
        },
      },
      presence: {
        initial: "idle",
        states: {
          idle: {
            always: { guard: ({ context }) => needsPublish(context), target: "publishing" },
            after: {
              refresh: {
                guard: ({ context }) => !!context.published,
                actions: assign({ published: undefined }),
              },
            },
          },
          publishing: {
            invoke: {
              src: "publishPresence",
              input: ({ context }) => {
                const wanted = wantedPresence(context);
                return {
                  me: pubkeyOf(context)!,
                  wanted,
                  game: wanted && findGame(context, wanted.coordinate),
                  published: context.published,
                  circle: context.circle,
                  follows: (context.friends ?? []).map((f) => f.pubkey),
                };
              },
              onDone: {
                target: "idle",
                actions: [
                  assign({
                    published: ({ event }) => event.output.published,
                    circle: ({ event }) => event.output.circle,
                  }),
                  "savePresence",
                ],
              },
              onError: {
                target: "idle",
                actions: assign({ published: ({ context }) => wantedPresence(context) }),
              },
            },
          },
        },
      },
      label: {
        initial: "idle",
        states: {
          idle: {
            on: { "label.publish": { target: "publishing", actions: assign({ labelError: "" }) } },
          },
          publishing: {
            invoke: {
              src: "publishLabel",
              input: ({ event }) => event as Extract<Events, { type: "label.publish" }>,
              onDone: {
                target: "idle",
                actions: assign({
                  labels: ({ context, event }) => [
                    ...parseLabels([event.output]),
                    ...context.labels,
                  ],
                }),
              },
              onError: {
                target: "idle",
                actions: assign({ labelError: ({ event }) => String(event.error) }),
              },
            },
          },
        },
      },
      budget: {
        initial: "loading",
        states: {
          loading: {
            invoke: {
              src: "walletStatus",
              onDone: { target: "idle", actions: assign({ wallet: ({ event }) => event.output }) },
              onError: {
                target: "idle",
                actions: assign({ walletError: ({ event }) => String(event.error) }),
              },
            },
          },
          idle: {
            on: {
              "wallet.connect": "connecting",
              "budget.pay": {
                guard: ({ context, event }) =>
                  !!context.wallet && event.month < monthKey(new Date()),
                target: "paying",
              },
            },
          },
          connecting: {
            invoke: {
              src: "connectWallet",
              input: ({ event }) => (event.type === "wallet.connect" ? event.uri : ""),
              onDone: {
                target: "idle",
                actions: assign({ wallet: ({ event }) => event.output, walletError: "" }),
              },
              onError: {
                target: "idle",
                actions: assign({ walletError: ({ event }) => String(event.error) }),
              },
            },
          },
          paying: {
            entry: assign({ payErrors: {} }),
            invoke: {
              src: "pay",
              input: ({ context, event }) => {
                const month = event.type === "budget.pay" ? event.month : "";
                return { month, payments: monthSplit(context, month).payments };
              },
            },
            on: {
              "zap.done": {
                actions: [
                  assign(({ context, event: { month, payment, error } }) =>
                    error
                      ? { payErrors: { ...context.payErrors, [payment.key]: error } }
                      : {
                          budget: {
                            ...context.budget,
                            paid: {
                              ...context.budget.paid,
                              [month]: {
                                ...context.budget.paid[month],
                                [payment.key]: payment.sats,
                              },
                            },
                          },
                        },
                  ),
                  "saveBudget",
                ],
              },
              "zap.finished": "idle",
            },
          },
        },
      },
      signer: {
        initial: "idle",
        states: {
          idle: {
            always: { guard: ({ context }) => context.requests.length > 0, target: "asking" },
          },
          asking: {
            on: {
              answer: {
                target: "idle",
                actions: [
                  ({ context, event }) => deps.answer(context.requests[0]!.id, event.allow),
                  assign({ requests: ({ context }) => context.requests.slice(1) }),
                ],
              },
            },
          },
        },
      },
    },
  });
