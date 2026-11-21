import { decode, npubEncode } from "nostr-tools/nip19";
import { verifyEvent, type Event } from "nostr-tools/pure";
import { assign, enqueueActions, fromCallback, fromPromise, setup } from "xstate";
import { parseListRef, PICKS, type CuratorList, type ListRef } from "./curation";
import { classifyDepth, resolveDepth, type Observation } from "./depth";
import type { Game } from "./listing";
import {
  addCurator,
  PICKS_ID,
  removeCurator,
  sourceList,
  toggleSource,
  union,
  UNVETTED_ID,
  type Source,
  type SourceSettings,
} from "./sources";

export interface ShimCall {
  coordinate: string;
  event?: Event;
  verified?: boolean;
}

export interface SignRequest {
  id: number;
  game: string;
  kind: number;
  content: string;
}

export type LauncherEvent =
  | { type: "shim"; call: ShimCall }
  | { type: "observed"; coordinate: string; kinds: number[] }
  | { type: "sign-request"; request: SignRequest };

type KeyCommand = "generate_key" | "import_key";

export interface LauncherDeps {
  keyStatus(): Promise<string | null>;
  saveKey(command: KeyCommand, nsec?: string): Promise<string>;
  fetchLists(ref: ListRef): Promise<CuratorList[]>;
  fetchListings(coordinates: string[]): Promise<Game[]>;
  fetchGames(): Promise<Game[]>;
  saveSources(sources: SourceSettings): void;
  fetchLastUpdated(game: Game): Promise<number>;
  openGame(game: Game): Promise<string>;
  checkGame(label: string): void;
  answer(id: number, allow: boolean): void;
  listen(send: (event: LauncherEvent) => void): () => void;
  saveObserved(observed: Record<string, Observation>): void;
}

export interface Fetched {
  lists: CuratorList[];
  games: string[];
}

export interface LauncherContext {
  sources: SourceSettings;
  sourceError: string;
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
  current?: Game;
}

type Events =
  | LauncherEvent
  | { type: "key.create" }
  | { type: "key.import"; nsec: string }
  | { type: "select"; game?: Game }
  | { type: "play"; game: Game }
  | { type: "opened"; coordinate: string; label: string }
  | { type: "check"; game: Game }
  | { type: "answer"; allow: boolean }
  | { type: "source.toggle"; id: string }
  | { type: "source.add"; input: string }
  | { type: "source.remove"; id: string }
  | { type: "source.loaded"; id: string; lists: CuratorList[]; games: Game[] }
  | { type: "updated"; coordinate: string; time: number };

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

export function depthOf(context: LauncherContext, game: Game) {
  const seen = context.observed[game.coordinate];
  return resolveDepth(game.depth, seen && classifyDepth(seen));
}

export const launcherMachine = (
  deps: LauncherDeps,
  observed: Record<string, Observation>,
  sources: SourceSettings,
) =>
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
          .catch(() => ({ lists: [], games: [] }))
          .then((result) => sendBack({ type: "source.loaded", id: input.id, ...result }));
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
    },
    actions: {
      saveObserved: ({ context }) => deps.saveObserved(context.observed),
      saveSources: ({ context }) => deps.saveSources(context.sources),
      fetchSources: enqueueActions(({ context, enqueue }) => {
        const wanted = sourceList(context.sources).filter(
          (s) => s.enabled && !context.fetched[s.id] && !context.loading.includes(s.id),
        );
        for (const source of wanted) enqueue.spawnChild("fetchSource", { input: source });
        enqueue.assign({ loading: [...context.loading, ...wanted.map((s) => s.id)] });
      }),
    },
  }).createMachine({
    id: "launcher",
    type: "parallel",
    context: {
      sources,
      sourceError: "",
      fetched: {},
      listings: {},
      loading: [],
      updated: {},
      npub: null,
      keyError: "",
      calls: [],
      observed,
      windows: {},
      requests: [],
    },
    invoke: { src: "listen" },
    entry: "fetchSources",
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
      "source.loaded": {
        actions: enqueueActions(({ context, event, enqueue }) => {
          const fresh = event.games.filter((g) => !context.listings[g.coordinate]);
          enqueue.assign({
            loading: context.loading.filter((id) => id !== event.id),
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
        }),
      },
      updated: {
        actions: assign({
          updated: ({ context, event }) => ({ ...context.updated, [event.coordinate]: event.time }),
        }),
      },
      select: { actions: assign({ current: ({ event }) => event.game }) },
      play: {
        actions: enqueueActions(({ enqueue, event }) =>
          enqueue.spawnChild("openGame", { input: event.game }),
        ),
      },
      opened: {
        actions: assign({
          windows: ({ context, event }) => ({
            ...context.windows,
            [event.coordinate]: event.label,
          }),
        }),
      },
      check: {
        actions: ({ context, event }) => {
          const label = context.windows[event.game.coordinate];
          if (label) deps.checkGame(label);
        },
      },
      shim: {
        actions: [
          assign(({ context, event: { call } }) => {
            const pubkey = context.npub && decode(context.npub as `npub1${string}`).data;
            const verified = call.event && verifyEvent(call.event) && call.event.pubkey === pubkey;
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
