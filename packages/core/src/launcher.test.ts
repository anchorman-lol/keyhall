import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { npubEncode } from "nostr-tools/nip19";
import { describe, expect, it, vi } from "vitest";
import { createActor, waitFor } from "xstate";
import { depthOf, launcherMachine, type LauncherDeps, type LauncherEvent } from "./launcher";
import type { Game } from "./listing";

const secret = generateSecretKey();
const npub = npubEncode(getPublicKey(secret));
const signed = (key = secret) =>
  finalizeEvent({ kind: 1, content: "hi", tags: [], created_at: 1 }, key);

const game = { coordinate: "31990:abc:blockstr", name: "Blockstr", createdAt: 100 } as Game;

function start(deps: Partial<LauncherDeps> = {}) {
  let emit: (event: LauncherEvent) => void = () => {};
  const all: LauncherDeps = {
    keyStatus: async () => null,
    saveKey: async () => npub,
    fetchGames: async () => [game],
    fetchLastUpdated: async () => 200,
    openGame: async () => "game-1",
    checkGame: vi.fn(),
    answer: vi.fn(),
    listen: (send) => {
      emit = send;
      return () => {};
    },
    saveObserved: vi.fn(),
    ...deps,
  };
  const actor = createActor(launcherMachine(all, {})).start();
  return { actor, deps: all, emit: (e: LauncherEvent) => emit(e) };
}

describe("key", () => {
  it("offers key setup when the keychain has none, then shows the new npub", async () => {
    const saveKey = vi.fn(async () => npub);
    const { actor } = start({ saveKey });
    await waitFor(actor, (s) => s.matches({ key: "setup" }));
    actor.send({ type: "key.create" });
    await waitFor(actor, (s) => s.matches({ key: "ready" }));
    expect(saveKey).toHaveBeenCalledWith("generate_key", undefined);
    expect(actor.getSnapshot().context.npub).toBe(npub);
  });

  it("imports an nsec", async () => {
    const saveKey = vi.fn(async () => npub);
    const { actor } = start({ saveKey });
    await waitFor(actor, (s) => s.matches({ key: "setup" }));
    actor.send({ type: "key.import", nsec: "nsec1x" });
    await waitFor(actor, (s) => s.matches({ key: "ready" }));
    expect(saveKey).toHaveBeenCalledWith("import_key", "nsec1x");
  });

  it("starts ready when a key is stored", async () => {
    const { actor } = start({ keyStatus: async () => npub });
    await waitFor(actor, (s) => s.matches({ key: "ready" }));
  });

  it("tells an unreadable keychain apart from a missing key", async () => {
    const { actor } = start({
      keyStatus: () => Promise.reject("Keyhall can't read the keychain: denied"),
      saveKey: () => Promise.reject("still denied"),
    });
    await waitFor(actor, (s) => s.matches({ key: "setup" }));
    expect(actor.getSnapshot().context.keyError).toBe("Keyhall can't read the keychain: denied");
    actor.send({ type: "key.create" });
    await waitFor(actor, (s) => s.context.keyError === "still denied");
    expect(actor.getSnapshot().matches({ key: "setup" })).toBe(true);
  });
});

describe("library", () => {
  it("loads games, then their last-updated times", async () => {
    const { actor } = start();
    await waitFor(actor, (s) => s.matches({ library: "ready" }));
    const { games, updated } = actor.getSnapshot().context;
    expect(games).toEqual([game]);
    expect(updated).toEqual({ [game.coordinate]: 200 });
  });

  it("selects a game and goes back to all games", () => {
    const { actor } = start();
    actor.send({ type: "select", game });
    expect(actor.getSnapshot().context.current).toBe(game);
    actor.send({ type: "select" });
    expect(actor.getSnapshot().context.current).toBeUndefined();
  });

  it("opens a game window, then tests sign-in in it", async () => {
    const { actor, deps } = start();
    actor.send({ type: "play", game });
    await waitFor(actor, (s) => s.context.windows[game.coordinate] === "game-1");
    actor.send({ type: "check", game });
    expect(deps.checkGame).toHaveBeenCalledWith("game-1");
  });
});

describe("signer", () => {
  it("asks about one sign request at a time and passes the answer on", async () => {
    const { actor, deps, emit } = start();
    const request = (id: number) => ({ id, game: "Blockstr", kind: 1, content: "" });
    emit({ type: "sign-request", request: request(1) });
    emit({ type: "sign-request", request: request(2) });
    expect(actor.getSnapshot().matches({ signer: "asking" })).toBe(true);
    expect(actor.getSnapshot().context.requests[0]?.id).toBe(1);
    actor.send({ type: "answer", allow: true });
    expect(deps.answer).toHaveBeenCalledWith(1, true);
    expect(actor.getSnapshot().context.requests[0]?.id).toBe(2);
    actor.send({ type: "answer", allow: false });
    expect(deps.answer).toHaveBeenCalledWith(2, false);
    expect(actor.getSnapshot().matches({ signer: "idle" })).toBe(true);
  });

  it("verifies signatures against the player's own key", async () => {
    const { actor, emit } = start({ keyStatus: async () => npub });
    await waitFor(actor, (s) => s.matches({ key: "ready" }));
    emit({ type: "shim", call: { coordinate: game.coordinate, event: signed() } });
    emit({
      type: "shim",
      call: { coordinate: game.coordinate, event: signed(generateSecretKey()) },
    });
    expect(actor.getSnapshot().context.calls.map((c) => c.verified)).toEqual([true, false]);
  });

  it("records what a game window did and keeps it", () => {
    const { actor, deps, emit } = start();
    emit({ type: "shim", call: { coordinate: game.coordinate } });
    emit({ type: "observed", coordinate: game.coordinate, kinds: [0, 1] });
    emit({ type: "observed", coordinate: game.coordinate, kinds: [1, 9735] });
    const { context } = actor.getSnapshot();
    expect(context.observed[game.coordinate]).toEqual({ kinds: [0, 1, 9735], signer: true });
    expect(deps.saveObserved).toHaveBeenLastCalledWith(context.observed);
    expect(depthOf(context, game)).toEqual({ depth: "identity", verified: true });
  });
});
