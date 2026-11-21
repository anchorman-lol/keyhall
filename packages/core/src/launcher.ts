import { decode } from "nostr-tools/nip19";
import { verifyEvent, type Event } from "nostr-tools/pure";
import { assign, enqueueActions, fromCallback, fromPromise, setup } from "xstate";
import { classifyDepth, resolveDepth, type Observation } from "./depth";
import type { Game } from "./listing";

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
  fetchGames(): Promise<Game[]>;
  fetchLastUpdated(game: Game): Promise<number>;
  openGame(game: Game): Promise<string>;
  checkGame(label: string): void;
  answer(id: number, allow: boolean): void;
  listen(send: (event: LauncherEvent) => void): () => void;
  saveObserved(observed: Record<string, Observation>): void;
}

export interface LauncherContext {
  games?: Game[];
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
  | { type: "updated"; coordinate: string; time: number }
  | { type: "dated" };

const record = (
  context: LauncherContext,
  coordinate: string,
  update: (o: Observation) => Observation,
) => ({
  ...context.observed,
  [coordinate]: update(context.observed[coordinate] ?? { kinds: [], signer: false }),
});

export const updatedAt = (context: LauncherContext, game: Game) =>
  context.updated[game.coordinate] ?? game.createdAt;

export const observedKinds = (context: LauncherContext, game: Game) =>
  context.observed[game.coordinate]?.kinds ?? [];

export function depthOf(context: LauncherContext, game: Game) {
  const seen = context.observed[game.coordinate];
  return resolveDepth(game.depth, seen && classifyDepth(seen));
}

export const launcherMachine = (deps: LauncherDeps, observed: Record<string, Observation>) =>
  setup({
    types: {} as { context: LauncherContext; events: Events },
    actors: {
      listen: fromCallback<Events>(({ sendBack }) => deps.listen(sendBack)),
      keyStatus: fromPromise(() => deps.keyStatus()),
      saveKey: fromPromise<string, { command: KeyCommand; nsec?: string }>(({ input }) =>
        deps.saveKey(input.command, input.nsec),
      ),
      fetchGames: fromPromise(() => deps.fetchGames()),
      fetchUpdates: fromCallback<Events, Game[]>(({ input, sendBack }) => {
        void (async () => {
          for (const game of input) {
            sendBack({
              type: "updated",
              coordinate: game.coordinate,
              time: await deps.fetchLastUpdated(game),
            });
          }
          sendBack({ type: "dated" });
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
    },
  }).createMachine({
    id: "launcher",
    type: "parallel",
    context: {
      updated: {},
      npub: null,
      keyError: "",
      calls: [],
      observed,
      windows: {},
      requests: [],
    },
    invoke: { src: "listen" },
    on: {
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
      library: {
        initial: "loading",
        states: {
          loading: {
            invoke: {
              src: "fetchGames",
              onDone: { target: "dating", actions: assign({ games: ({ event }) => event.output }) },
            },
          },
          dating: {
            invoke: { src: "fetchUpdates", input: ({ context }) => context.games ?? [] },
            on: {
              updated: {
                actions: assign({
                  updated: ({ context, event }) => ({
                    ...context.updated,
                    [event.coordinate]: event.time,
                  }),
                }),
              },
              dated: "ready",
            },
          },
          ready: {},
        },
      },
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
