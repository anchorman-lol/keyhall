import { matchFilter, type Filter } from "nostr-tools/filter";
import { unwrapEvent, wrapEvent } from "nostr-tools/nip59";
import { finalizeEvent, generateSecretKey, getPublicKey, type Event } from "nostr-tools/pure";
import { bytesToHex } from "nostr-tools/utils";
import { npubEncode } from "nostr-tools/nip19";
import { describe, expect, it, vi } from "vitest";
import { createActor, waitFor } from "xstate";
import { monthKey, monthRange, previousMonth, type Session } from "./budget";
import { PICKS_REF, type CuratorList, type ListRef } from "./curation";
import type { Label } from "./labels";
import {
  curatorName,
  depthOf,
  findGame,
  isCurator,
  signInOf,
  launcherMachine,
  library,
  monthSplit,
  playing,
  running,
  sourceLabel,
  unreachable,
  type BudgetSettings,
  type LauncherDeps,
  type LauncherEvent,
  type Stored,
} from "./launcher";
import type { Game } from "./listing";
import { circlePubkey, circleStatus, DEFAULT_PRESENCE, publicStatus, readStatus } from "./presence";
import { signerFor } from "./signer.testing";
import { defaultSources, PICKS_ID, UNVETTED_ID } from "./sources";

const secret = generateSecretKey();
const npub = npubEncode(getPublicKey(secret));
const signed = (key = secret) =>
  finalizeEvent({ kind: 1, content: "hi", tags: [], created_at: 1 }, key);

const game = {
  coordinate: "31990:abc:blockstr",
  name: "Blockstr",
  url: "https://blockstr.io",
  createdAt: 100,
  signIn: "signer",
} as Game;
const spam = {
  coordinate: "31990:def:spam",
  name: "Spam",
  url: "https://spam.io",
  createdAt: 100,
} as Game;
const curatorSecret = generateSecretKey();
const curatorKey = getPublicKey(curatorSecret);
const listOf = (ref: ListRef, games: Game[]): CuratorList => ({
  address: `30267:${ref.pubkey}:${ref.d ?? "games"}`,
  pubkey: ref.pubkey,
  title: "A list",
  description: undefined,
  image: undefined,
  games: games.map((g) => g.coordinate),
});
const relays: Record<string, Game[]> = {
  [PICKS_REF.pubkey]: [game],
  [curatorKey]: [game, spam],
};

function relay(events: Event[] = []) {
  const subs: [Filter, (e: Event) => void][] = [];
  const published: Event[] = [];
  return {
    published,
    deliver: (e: Event) => subs.forEach(([f, cb]) => matchFilter(f, e) && cb(e)),
    subscribe: (filter: Filter, onEvent: (e: Event) => void) => {
      const sub: [Filter, (e: Event) => void] = [filter, onEvent];
      subs.push(sub);
      events.filter((e) => matchFilter(filter, e)).forEach(onEvent);
      return () => subs.splice(subs.indexOf(sub), 1);
    },
    publish: vi.fn(async (e: Event) => void published.push(e)),
  };
}

function start(deps: Partial<LauncherDeps> = {}, stored: Partial<Stored> = {}) {
  let emit: (event: LauncherEvent) => void = () => {};
  const all: LauncherDeps = {
    keyStatus: async () => null,
    saveKey: async () => npub,
    forgetKey: async () => {},
    fetchLists: async (ref) => [listOf(ref, relays[ref.pubkey] ?? [])],
    fetchListings: async (coordinates) =>
      [game, spam].filter((g) => coordinates.includes(g.coordinate)),
    fetchGames: async () => [game, spam],
    saveSources: vi.fn(),
    saveRelays: vi.fn(),
    probeRelay: async () => true,
    fetchLastUpdated: async () => 200,
    openGame: async () => "game-1",
    checkGame: vi.fn(),
    closeGame: vi.fn(),
    listen: (send) => {
      emit = send;
      return () => {};
    },
    saveObserved: vi.fn(),
    fetchLabels: async () => [],
    signLabel: async (template) => finalizeEvent(template, curatorSecret),
    ...signerFor(secret),
    ...relay(),
    fetchFriends: async () => [],
    fetchProfileEvent: async () => undefined,
    saveFriendsOpen: vi.fn(),
    savePresence: vi.fn(),
    sessions: async () => [],
    walletStatus: async () => null,
    connectWallet: async () => "relay.example",
    pay: async () => {},
    saveBudget: vi.fn(),
    restart: vi.fn(),
    ...deps,
  };
  const actor = createActor(launcherMachine(all, stored)).start();
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

  it("signs out after closing games and clearing presence, leaving nothing of the old key", async () => {
    const mock = relay();
    let key = secret;
    const next = generateSecretKey();
    const forgetKey = vi.fn(async () => {
      expect(mock.published.at(-1)).toMatchObject({ kind: 30315, content: "" });
    });
    const fetchFriends = vi.fn(async () => friends);
    const { actor, emit, deps } = start({
      ...mock,
      keyStatus: async () => npub,
      saveKey: async () => npubEncode(getPublicKey(next)),
      forgetKey,
      fetchFriends,
      closeGame: vi.fn(() => emit({ type: "closed", coordinate: game.coordinate })),
      signEvent: (t) => signerFor(key).signEvent(t),
      nip44Encrypt: (p, t) => signerFor(key).nip44Encrypt(p, t),
    });
    await waitFor(actor, (s) => s.matches({ friends: "ready" }));
    actor.send({ type: "play", game });
    await waitFor(actor, (s) => !!s.context.published);
    emit({ type: "observed", coordinate: game.coordinate, kinds: [1] });
    emit({ type: "shim", call: { coordinate: game.coordinate, event: signed() } });
    const { circle } = actor.getSnapshot().context;
    actor.send({ type: "profile.edit" });
    await waitFor(actor, (s) => s.matches({ profile: "editing" }));

    actor.send({ type: "key.signOut" });
    await waitFor(actor, (s) => s.matches({ key: "setup" }));
    expect(actor.getSnapshot().matches({ profile: "waiting" })).toBe(true);
    expect(deps.closeGame).toHaveBeenCalledWith("game-1");
    expect(forgetKey).toHaveBeenCalledOnce();
    expect(actor.getSnapshot().context).toMatchObject({
      npub: null,
      windows: {},
      calls: [],
      observed: {},
      friends: undefined,
      profile: undefined,
      profileEvent: undefined,
      profileError: "",
      statuses: {},
      presence: DEFAULT_PRESENCE,
      circle: undefined,
      published: undefined,
    });
    expect(deps.saveObserved).toHaveBeenLastCalledWith({});
    expect(deps.savePresence).toHaveBeenLastCalledWith(DEFAULT_PRESENCE, undefined);

    key = next;
    actor.send({ type: "key.create" });
    await waitFor(actor, (s) => s.matches({ friends: "ready" }));
    expect(fetchFriends).toHaveBeenLastCalledWith(getPublicKey(next));
    actor.send({ type: "play", game });
    await waitFor(actor, (s) => !!s.context.published);
    expect(actor.getSnapshot().context.circle!.secret).not.toBe(circle!.secret);
    const wrap = mock.published.findLast((e) => e.kind === 1059)!;
    expect(unwrapEvent(wrap, wrap.tags[0]![1] === friends[0]!.pubkey ? sam : mira).pubkey).toBe(
      getPublicKey(next),
    );
  });

  it("opens no game window until a key is stored", async () => {
    const openGame = vi.fn(async () => "game-1");
    const { actor } = start({
      keyStatus: async () => null,
      saveKey: async () => npub,
      openGame,
    });
    await waitFor(actor, (s) => s.matches({ key: "setup" }));
    actor.send({ type: "play", game });
    expect(openGame).not.toHaveBeenCalled();

    actor.send({ type: "key.create" });
    await waitFor(actor, (s) => s.matches({ key: "ready" }));
    actor.send({ type: "play", game });
    await waitFor(actor, (s) => !!s.context.windows[game.coordinate]);
    expect(openGame).toHaveBeenCalledOnce();
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
  const loaded = (s: { context: { loading: string[] } }) => s.context.loading.length === 0;

  it("loads Keyhall picks while the key check waits on a keychain prompt", async () => {
    const fetchGames = vi.fn(async () => [game, spam]);
    const { actor } = start({ keyStatus: () => new Promise(() => {}), fetchGames });
    await waitFor(actor, loaded);
    expect(library(actor.getSnapshot().context)).toEqual([{ game, from: [PICKS_ID] }]);
    expect(actor.getSnapshot().matches({ key: "checking" })).toBe(true);
    expect(fetchGames).not.toHaveBeenCalled();
  });

  it("loads games, then their last-updated times", async () => {
    const { actor } = start();
    await waitFor(actor, (s) => s.context.updated[game.coordinate] !== undefined);
    expect(actor.getSnapshot().context.updated).toEqual({ [game.coordinate]: 200 });
  });

  it("shows unvetted listings once switched on, and saves the choice", async () => {
    const { actor, deps } = start();
    await waitFor(actor, loaded);
    actor.send({ type: "source.toggle", id: UNVETTED_ID });
    await waitFor(actor, loaded);
    expect(library(actor.getSnapshot().context)).toEqual([
      { game, from: [PICKS_ID, UNVETTED_ID] },
      { game: spam, from: [UNVETTED_ID] },
    ]);
    expect(deps.saveSources).toHaveBeenLastCalledWith({ ...defaultSources, unvetted: true });
  });

  it("hides Keyhall picks when switched off, without fetching again when back on", async () => {
    const fetchLists = vi.fn(async (ref: ListRef) => [listOf(ref, [game])]);
    const { actor } = start({ fetchLists });
    await waitFor(actor, loaded);
    actor.send({ type: "source.toggle", id: PICKS_ID });
    expect(library(actor.getSnapshot().context)).toEqual([]);
    expect(findGame(actor.getSnapshot().context, game.coordinate)).toBe(game);
    actor.send({ type: "source.toggle", id: PICKS_ID });
    expect(library(actor.getSnapshot().context)).toEqual([{ game, from: [PICKS_ID] }]);
    expect(fetchLists).toHaveBeenCalledOnce();
  });

  it("adds a curator by npub, loads their lists and can remove them", async () => {
    const { actor, deps } = start();
    await waitFor(actor, loaded);
    actor.send({ type: "source.add", input: npubEncode(curatorKey) });
    await waitFor(actor, loaded);
    expect(library(actor.getSnapshot().context)).toEqual([
      { game, from: [PICKS_ID, curatorKey] },
      { game: spam, from: [curatorKey] },
    ]);
    const { context } = actor.getSnapshot();
    expect([PICKS_ID, curatorKey, UNVETTED_ID].map((id) => sourceLabel(context, id))).toEqual([
      "Keyhall picks",
      "A list",
      "Unvetted listings",
    ]);
    expect(deps.saveSources).toHaveBeenLastCalledWith({
      ...defaultSources,
      curators: [{ ref: { pubkey: curatorKey }, enabled: true }],
    });
    actor.send({ type: "source.remove", id: curatorKey });
    expect(library(actor.getSnapshot().context)).toEqual([{ game, from: [PICKS_ID] }]);
  });

  it("loads saved curators on start and rejects input that isn't an npub or naddr", async () => {
    const { actor } = start(
      {},
      {
        sources: {
          picks: false,
          unvetted: false,
          curators: [{ ref: { pubkey: curatorKey }, enabled: true }],
        },
      },
    );
    await waitFor(actor, loaded);
    expect(library(actor.getSnapshot().context).map((e) => e.game)).toEqual([game, spam]);
    actor.send({ type: "source.add", input: "nsec1nope" });
    expect(actor.getSnapshot().context.sourceError).toMatch(/npub or a list.s naddr/);
    actor.send({ type: "source.add", input: npubEncode(curatorKey) });
    expect(actor.getSnapshot().context.sourceError).toBe("");
  });

  it("treats a source whose relays fail as empty and blames the relays", async () => {
    const { actor } = start({ fetchLists: () => Promise.reject(new Error("offline")) });
    await waitFor(actor, loaded);
    expect(library(actor.getSnapshot().context)).toEqual([]);
    expect(unreachable(actor.getSnapshot().context)).toBe(true);
  });

  it("doesn't blame the relays for an empty source that loaded", async () => {
    const { actor } = start({ fetchLists: async () => [] });
    await waitFor(actor, loaded);
    expect(unreachable(actor.getSnapshot().context)).toBe(false);
  });

  it("selects a game and goes back to all games", () => {
    const { actor } = start();
    actor.send({ type: "select", game });
    expect(actor.getSnapshot().context.current).toBe(game);
    actor.send({ type: "select" });
    expect(actor.getSnapshot().context.current).toBeUndefined();
  });

  it("opens a game window, then tests sign-in in it and quits it", async () => {
    const { actor, deps } = start({ keyStatus: async () => npub });
    await waitFor(actor, (s) => s.matches({ key: "ready" }));
    actor.send({ type: "play", game });
    await waitFor(actor, (s) => s.context.windows[game.coordinate] === "game-1");
    actor.send({ type: "check", game });
    expect(deps.checkGame).toHaveBeenCalledWith("game-1");
    actor.send({ type: "quit", game });
    expect(deps.closeGame).toHaveBeenCalledWith("game-1");
  });

  it("says since when each open game runs, from fresh play time", async () => {
    const sessions = vi.fn(async () => [
      { coordinate: game.coordinate, start: 10, end: 20 },
      { coordinate: game.coordinate, start: 50, end: 60 },
    ]);
    const { actor } = start({ sessions, keyStatus: async () => npub });
    await waitFor(actor, (s) => s.matches({ key: "ready" }));
    actor.send({ type: "select", game });
    await waitFor(actor, (s) => s.context.sessions.length > 0);
    expect(running(actor.getSnapshot().context)).toEqual([]);
    actor.send({ type: "play", game });
    await waitFor(actor, (s) => running(s.context).length > 0);
    expect(running(actor.getSnapshot().context)).toEqual([{ game, since: 50 }]);
    expect(sessions).toHaveBeenCalledTimes(2);
  });
});

describe("update", () => {
  it("offers a restart once an update is installed, but not while a game is open", async () => {
    const restart = vi.fn();
    const { actor, emit } = start({ restart, keyStatus: async () => npub });
    await waitFor(actor, (s) => s.matches({ key: "ready" }));
    expect(actor.getSnapshot().context.update).toBeUndefined();
    emit({ type: "update-ready", version: "2026.1123.0" });
    expect(actor.getSnapshot().context.update).toBe("2026.1123.0");
    actor.send({ type: "play", game });
    await waitFor(actor, (s) => s.context.windows[game.coordinate] === "game-1");
    actor.send({ type: "update.restart" });
    expect(restart).not.toHaveBeenCalled();
    emit({ type: "closed", coordinate: game.coordinate });
    actor.send({ type: "update.restart" });
    expect(restart).toHaveBeenCalledOnce();
  });
});

describe("signer", () => {
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
    expect(depthOf(context, game)).toMatchObject({ value: "identity", seen: true });
  });
});

describe("verification", () => {
  const picksLabel: Label = {
    curator: PICKS_REF.pubkey,
    coordinate: game.coordinate,
    signIn: "signer-or-nsec",
    depth: "identity",
  };
  const curatorLabel: Label = {
    curator: curatorKey,
    coordinate: game.coordinate,
    signIn: "signer",
  };
  const fetchLabels = vi.fn(async (curators: string[]) =>
    [picksLabel, curatorLabel].filter((l) => curators.includes(l.curator)),
  );
  const labelled = (s: { context: { loading: string[]; labels: Label[] } }) =>
    s.context.loading.length === 0 && s.context.labels.length > 0;

  it("reads labels from the curators of enabled sources and says who verified what", async () => {
    fetchLabels.mockClear();
    const { actor } = start({ fetchLabels });
    await waitFor(actor, labelled);
    const { context } = actor.getSnapshot();
    expect(fetchLabels).toHaveBeenCalledWith([PICKS_REF.pubkey]);
    expect(curatorName(context, PICKS_REF.pubkey)).toBe("Keyhall picks");
    expect(signInOf(context, game)).toEqual({
      value: "signer-or-nsec",
      verifiedBy: [PICKS_REF.pubkey],
      conflicts: [{ from: "listing", value: "signer" }],
    });
    expect(depthOf(context, game)).toMatchObject({
      value: "identity",
      verifiedBy: [PICKS_REF.pubkey],
    });
    actor.send({ type: "source.toggle", id: PICKS_ID });
    expect(signInOf(actor.getSnapshot().context, game).verifiedBy).toEqual([]);
  });

  it("fetches a new curator's labels once and shows their disagreement", async () => {
    fetchLabels.mockClear();
    const { actor } = start({ fetchLabels });
    await waitFor(actor, labelled);
    actor.send({ type: "source.add", input: npubEncode(curatorKey) });
    await waitFor(actor, (s) => s.context.labels.length === 2);
    expect(fetchLabels).toHaveBeenLastCalledWith([curatorKey]);
    expect(fetchLabels).toHaveBeenCalledTimes(2);
    const { context } = actor.getSnapshot();
    expect(curatorName(context, curatorKey)).toBe("A list");
    expect(signInOf(context, game).conflicts).toEqual([
      { from: "listing", value: "signer" },
      { from: curatorKey, value: "signer" },
    ]);
  });

  it("records a key-shaped field", () => {
    const { actor, deps, emit } = start();
    emit({ type: "key-field", coordinate: game.coordinate });
    emit({ type: "key-field", coordinate: game.coordinate });
    const { context } = actor.getSnapshot();
    expect(context.observed[game.coordinate]).toEqual({ kinds: [], signer: false, keyField: true });
    expect(deps.saveObserved).toHaveBeenLastCalledWith(context.observed);
    expect(signInOf(context, game).conflicts).toEqual([{ from: "window", value: "nsec" }]);
  });

  it("lets a curator label a game, publishing only once confirmed", async () => {
    const signLabel = vi.fn(async (t: Parameters<LauncherDeps["signLabel"]>[0]) =>
      finalizeEvent(t, curatorSecret),
    );
    const { actor, deps } = start(
      { keyStatus: async () => npubEncode(curatorKey), signLabel },
      {
        sources: { ...defaultSources, curators: [{ ref: { pubkey: curatorKey }, enabled: true }] },
      },
    );
    await waitFor(actor, (s) => s.matches({ key: "ready" }) && s.context.loading.length === 0);
    expect(isCurator(actor.getSnapshot().context)).toBe(true);
    expect(signLabel).not.toHaveBeenCalled();
    actor.send({ type: "label.publish", game, methods: ["nip07", "nsec"], depth: "identity" });
    await waitFor(actor, (s) => s.matches({ label: "idle" }) && s.context.labels.length > 0);
    expect(signLabel.mock.calls[0]![0].tags).toContainEqual(["a", game.coordinate]);
    expect(deps.publish).toHaveBeenCalledWith(await signLabel.mock.results[0]!.value);
    expect(signInOf(actor.getSnapshot().context, game)).toMatchObject({
      value: "signer-or-nsec",
      verifiedBy: [curatorKey],
    });
  });

  it("keeps the label unpublished and reports why when relays refuse", async () => {
    const { actor } = start({ publish: () => Promise.reject(new Error("blocked")) });
    actor.send({ type: "label.publish", game, methods: ["nip07"], depth: undefined });
    await waitFor(actor, (s) => s.context.labelError !== "");
    expect(actor.getSnapshot().context.labelError).toMatch(/blocked/);
    expect(actor.getSnapshot().context.labels).toEqual([]);
  });

  it("isn't a curator without a key on an enabled source", async () => {
    const { actor } = start({ keyStatus: async () => npub });
    await waitFor(actor, (s) => s.matches({ key: "ready" }) && s.context.loading.length === 0);
    expect(isCurator(actor.getSnapshot().context)).toBe(false);
  });
});

const sam = generateSecretKey();
const mira = generateSecretKey();
const friends = [sam, mira].map((k, i) => ({ pubkey: getPublicKey(k), name: ["sam", "mira"][i] }));
const now = () => Math.floor(Date.now() / 1000);

describe("friends", () => {
  it("loads the follow list once the key is ready and shows public and friends-only presence", async () => {
    const fetchFriends = vi.fn(async () => friends);
    const circle = bytesToHex(generateSecretKey());
    const mock = relay([
      finalizeEvent(publicStatus(game, now()), sam),
      wrapEvent(
        { kind: 30078, content: circle, tags: [["d", "keyhall/presence"]] },
        mira,
        getPublicKey(secret),
      ),
      circleStatus(circle, { ...game, name: "Word5", coordinate: "31990:abc:word5" }, now()),
      finalizeEvent(publicStatus(game, now()), generateSecretKey()),
    ]);
    const { actor } = start({ keyStatus: async () => npub, fetchFriends, ...mock });
    await waitFor(actor, (s) => playing(s.context).length === 2);
    expect(fetchFriends).toHaveBeenCalledWith(getPublicKey(secret));
    expect(
      playing(actor.getSnapshot().context).map((p) => [p.friend.name, p.status.content]),
    ).toEqual([
      ["sam", "Playing Blockstr"],
      ["mira", "Playing Word5"],
    ]);
    mock.deliver(finalizeEvent({ ...publicStatus(undefined, now() + 1) }, sam));
    expect(playing(actor.getSnapshot().context).map((p) => p.friend.name)).toEqual(["mira"]);
  });

  it("drops expired statuses and stale clears", async () => {
    const mock = relay();
    const { actor } = start({
      keyStatus: async () => npub,
      fetchFriends: async () => friends,
      ...mock,
    });
    await waitFor(actor, (s) => s.matches({ friends: "ready" }));
    mock.deliver(finalizeEvent(publicStatus(game, now() - 4 * 3600), sam));
    expect(playing(actor.getSnapshot().context)).toEqual([]);
    mock.deliver(finalizeEvent(publicStatus(game, now()), sam));
    mock.deliver(finalizeEvent(publicStatus(undefined, now() - 60), sam));
    expect(playing(actor.getSnapshot().context)).toHaveLength(1);
  });
});

describe("identity", () => {
  const kind0 = (content: object, created_at = 1) =>
    finalizeEvent(
      { kind: 0, content: JSON.stringify(content), tags: [["i", "github:leon", "p"]], created_at },
      secret,
    );

  it("loads the player's own profile once the key is ready", async () => {
    const fetchProfileEvent = vi.fn(async () =>
      kind0({ name: "Leon", picture: "https://x.test/l.png" }),
    );
    const { actor } = start({ keyStatus: async () => npub, fetchProfileEvent });
    await waitFor(actor, (s) => s.context.profile !== undefined);
    expect(fetchProfileEvent).toHaveBeenCalledWith(getPublicKey(secret));
    expect(actor.getSnapshot().context.profile).toEqual({
      pubkey: getPublicKey(secret),
      name: "Leon",
      picture: "https://x.test/l.png",
    });
  });

  it("keeps the bare pubkey when the profile can't be fetched", async () => {
    const { actor } = start({
      keyStatus: async () => npub,
      fetchProfileEvent: () => Promise.reject(new Error("offline")),
    });
    await waitFor(actor, (s) => s.context.profile !== undefined);
    expect(actor.getSnapshot().context.profile).toEqual({ pubkey: getPublicKey(secret) });
  });

  it("edits the latest profile on the relays, keeping fields it doesn't show", async () => {
    const latest = kind0({ name: "Leon", nip05: "leon@x.test", lud16: "l@x.test" }, 5);
    const fetchProfileEvent = vi.fn(async () => kind0({ name: "Old" }));
    const mock = relay();
    const { actor } = start({ keyStatus: async () => npub, fetchProfileEvent, ...mock });
    await waitFor(actor, (s) => s.matches({ profile: "ready" }));
    fetchProfileEvent.mockResolvedValue(latest);
    actor.send({ type: "profile.edit" });
    await waitFor(actor, (s) => s.matches({ profile: "editing" }));
    expect(actor.getSnapshot().context.profileEvent).toEqual(latest);
    actor.send({
      type: "profile.save",
      fields: { name: "Leon W", picture: "", about: "Plays games", lud16: "l@x.test" },
    });
    await waitFor(actor, (s) => s.matches({ profile: "ready" }));
    const [event] = mock.published;
    expect(event).toMatchObject({ kind: 0, pubkey: getPublicKey(secret), tags: latest.tags });
    expect(JSON.parse(event!.content)).toEqual({
      name: "Leon W",
      nip05: "leon@x.test",
      lud16: "l@x.test",
      about: "Plays games",
    });
    expect(actor.getSnapshot().context.profile?.name).toBe("Leon W");
    expect(actor.getSnapshot().context.profileEvent).toEqual(event);
  });

  it("won't edit when the latest profile can't be loaded", async () => {
    const fetchProfileEvent = vi.fn(async () => kind0({ name: "Leon" }));
    const { actor } = start({ keyStatus: async () => npub, fetchProfileEvent });
    await waitFor(actor, (s) => s.matches({ profile: "ready" }));
    fetchProfileEvent.mockRejectedValue(new Error("Couldn't reach your relays"));
    actor.send({ type: "profile.edit" });
    await waitFor(actor, (s) => s.context.profileError !== "");
    expect(actor.getSnapshot().matches({ profile: "ready" })).toBe(true);
    expect(actor.getSnapshot().context.profileError).toContain("Couldn't reach your relays");
  });

  it("stays in the editor with the error when publishing fails, and cancels", async () => {
    const mock = relay();
    mock.publish.mockRejectedValue(new Error("blocked"));
    const { actor } = start({ keyStatus: async () => npub, ...mock });
    await waitFor(actor, (s) => s.matches({ profile: "ready" }));
    actor.send({ type: "profile.edit" });
    await waitFor(actor, (s) => s.matches({ profile: "editing" }));
    actor.send({
      type: "profile.save",
      fields: { name: "Leon", picture: "", about: "", lud16: "" },
    });
    await waitFor(actor, (s) => s.context.profileError !== "");
    expect(actor.getSnapshot().matches({ profile: "editing" })).toBe(true);
    actor.send({ type: "profile.cancel" });
    expect(actor.getSnapshot().matches({ profile: "ready" })).toBe(true);
    expect(actor.getSnapshot().context.profileError).toBe("");
  });

  it("stops loading the profile to edit when cancelled", async () => {
    const fetchProfileEvent = vi.fn(async () => undefined);
    const { actor } = start({ keyStatus: async () => npub, fetchProfileEvent });
    await waitFor(actor, (s) => s.matches({ profile: "ready" }));
    fetchProfileEvent.mockReturnValue(new Promise(() => {}));
    actor.send({ type: "profile.edit" });
    actor.send({ type: "profile.cancel" });
    expect(actor.getSnapshot().matches({ profile: "ready" })).toBe(true);
  });

  it("shows the friends column by default, toggles it and saves the choice", () => {
    const saveFriendsOpen = vi.fn();
    const { actor } = start({ saveFriendsOpen });
    expect(actor.getSnapshot().context.friendsOpen).toBe(true);
    actor.send({ type: "friends.toggle" });
    expect(actor.getSnapshot().context.friendsOpen).toBe(false);
    expect(saveFriendsOpen).toHaveBeenLastCalledWith(false);
  });

  it("starts with the friends column hidden when that was saved", () => {
    const { actor } = start({}, { friendsOpen: false });
    expect(actor.getSnapshot().context.friendsOpen).toBe(false);
  });
});

describe("presence", () => {
  async function playWith(settings?: Stored["presence"]) {
    const mock = relay();
    const savePresence = vi.fn();
    const run = start(
      { keyStatus: async () => npub, fetchFriends: async () => friends, savePresence, ...mock },
      settings && { presence: settings },
    );
    await waitFor(run.actor, (s) => s.matches({ friends: "ready" }));
    run.actor.send({ type: "play", game });
    return { ...run, mock, savePresence };
  }

  it("is friends only by default: sends the circle key to each friend, then one encrypted status", async () => {
    const { actor, mock, emit, savePresence } = await playWith();
    await waitFor(actor, (s) => s.context.published?.coordinate === game.coordinate);
    const wraps = mock.published.filter((e) => e.kind === 1059);
    const [status] = mock.published.filter((e) => e.kind === 30315);
    const { circle } = actor.getSnapshot().context;
    expect(
      wraps.map((w) => unwrapEvent(w, w.tags[0]![1] === friends[0]!.pubkey ? sam : mira).content),
    ).toEqual([circle!.secret, circle!.secret]);
    expect(status!.pubkey).toBe(circlePubkey(circle!.secret));
    expect(readStatus(status!, circle!.secret)?.content).toBe("Playing Blockstr");
    expect(savePresence).toHaveBeenLastCalledWith(expect.anything(), circle);

    emit({ type: "closed", coordinate: game.coordinate });
    await waitFor(actor, (s) => !s.context.published && s.matches({ presence: "idle" }));
    const clear = mock.published.at(-1)!;
    expect([clear.kind, clear.pubkey, clear.content]).toEqual([30315, status!.pubkey, ""]);
    expect(mock.published.filter((e) => e.kind === 1059)).toHaveLength(2);
  });

  it("publishes a public status under the player's key for a public game, and clears it when hidden", async () => {
    const { actor, mock } = await playWith({
      mode: "friends",
      games: { [game.coordinate]: "public" },
    });
    await waitFor(actor, (s) => s.context.published?.mode === "public");
    const [status] = mock.published;
    expect(mock.published).toHaveLength(1);
    expect(status!.pubkey).toBe(getPublicKey(secret));
    expect(readStatus(status!)?.coordinate).toBe(game.coordinate);
    actor.send({ type: "presence.game", coordinate: game.coordinate, mode: "hidden" });
    await waitFor(actor, (s) => !s.context.published && s.matches({ presence: "idle" }));
    expect(mock.published.at(-1)).toMatchObject({ pubkey: getPublicKey(secret), content: "" });
  });

  it("publishes nothing for hidden games", async () => {
    const { actor, mock } = await playWith({ mode: "hidden", games: {} });
    await waitFor(actor, (s) => !!s.context.windows[game.coordinate]);
    expect(actor.getSnapshot().matches({ presence: "idle" })).toBe(true);
    expect(mock.published).toEqual([]);
  });

  it("removes a per-game override and saves the settings", async () => {
    const savePresence = vi.fn();
    const { actor } = start({ savePresence });
    actor.send({ type: "presence.game", coordinate: game.coordinate, mode: "public" });
    actor.send({ type: "presence.mode", mode: "hidden" });
    actor.send({ type: "presence.game", coordinate: game.coordinate });
    expect(actor.getSnapshot().context.presence).toEqual({ mode: "hidden", games: {} });
    expect(savePresence).toHaveBeenCalledTimes(3);
  });
});

describe("budget", () => {
  const lastMonth = previousMonth(monthKey(new Date()));
  const [from] = monthRange(lastMonth);
  const hours = (coordinate: string, h: number): Session => ({
    coordinate,
    start: from + 60,
    end: from + 60 + h * 3600,
  });
  const chess = {
    ...game,
    coordinate: "chess",
    payTo: [{ pubkey: "c", weight: 1, lud16: "c@x.io" }],
  };
  const words = { ...game, coordinate: "words", payTo: [{ pubkey: "w", weight: 1 }] };
  const sessions = async () => [hours("chess", 3), hours("words", 1)];

  async function ready(deps: Partial<LauncherDeps> = {}, budget?: BudgetSettings) {
    const started = start(
      {
        fetchGames: async () => [chess, words],
        walletStatus: async () => "relay.example",
        sessions,
        ...deps,
      },
      {
        budget: budget ?? { sats: 1000, paid: {} },
        sources: { picks: false, unvetted: true, curators: [] },
      },
    );
    started.actor.send({ type: "view", view: "budget" });
    await waitFor(
      started.actor,
      (s) => s.matches({ budget: "idle" }) && !!s.context.fetched[UNVETTED_ID],
    );
    await waitFor(started.actor, (s) => s.context.sessions.length > 0);
    return started;
  }

  it("saves the monthly budget", () => {
    const { actor, deps } = start();
    actor.send({ type: "budget.set", sats: 5000 });
    expect(deps.saveBudget).toHaveBeenCalledWith({ sats: 5000, paid: {} });
    expect(actor.getSnapshot().context.budget.sats).toBe(5000);
  });

  it("connects a wallet and shows its errors", async () => {
    const connectWallet = vi.fn(async (uri: string) => {
      if (uri === "bad") throw "That is not a nostr+walletconnect URI";
      return "relay.example";
    });
    const { actor } = start({ connectWallet });
    await waitFor(actor, (s) => s.matches({ budget: "idle" }));
    actor.send({ type: "wallet.connect", uri: "bad" });
    await waitFor(actor, (s) => s.context.walletError !== "");
    expect(actor.getSnapshot().context.wallet).toBeNull();
    actor.send({ type: "wallet.connect", uri: "nostr+walletconnect://x" });
    await waitFor(actor, (s) => s.context.wallet === "relay.example");
    expect(actor.getSnapshot().context.walletError).toBe("");
  });

  it("opens the budget page with fresh play time", async () => {
    const { actor } = await ready();
    expect(actor.getSnapshot().context.view).toBe("budget");
    const { shares } = monthSplit(actor.getSnapshot().context, lastMonth);
    expect(shares.map((s) => [s.coordinate, s.sats])).toEqual([
      ["chess", 743],
      ["words", 247],
    ]);
    actor.send({ type: "select", game });
    expect(actor.getSnapshot().context.view).toBeUndefined();
  });

  it("pays last month's split once, after the player confirms", async () => {
    const pay = vi.fn<LauncherDeps["pay"]>(async () => {});
    const { actor, deps } = await ready({ pay });
    expect(pay).not.toHaveBeenCalled();
    actor.send({ type: "budget.pay", month: lastMonth });
    await waitFor(actor, (s) => s.matches({ budget: "idle" }) && pay.mock.calls.length === 2);
    expect(pay.mock.calls.map(([p]) => p)).toEqual([
      { key: "chess c", coordinate: "chess", pubkey: "c", lud16: "c@x.io", sats: 743 },
      { key: "words w", coordinate: "words", pubkey: "w", sats: 247 },
    ]);
    expect(deps.saveBudget).toHaveBeenLastCalledWith({
      sats: 1000,
      paid: { [lastMonth]: { "chess c": 743, "words w": 247 } },
    });
    expect(monthSplit(actor.getSnapshot().context, lastMonth).payments).toEqual([]);
  });

  it("keeps failed payments for a retry that skips the paid ones", async () => {
    const pay = vi.fn(async (p: { key: string }) => {
      if (p.key === "words w") throw new Error("no route");
    });
    const { actor } = await ready({ pay });
    actor.send({ type: "budget.pay", month: lastMonth });
    await waitFor(actor, (s) => s.context.payErrors["words w"] === "Error: no route");
    await waitFor(actor, (s) => s.matches({ budget: "idle" }));
    pay.mockClear();
    actor.send({ type: "budget.pay", month: lastMonth });
    await waitFor(actor, (s) => s.matches({ budget: "idle" }) && pay.mock.calls.length === 1);
    expect(pay.mock.calls[0]![0].key).toBe("words w");
  });

  it("never pays the running month or without a wallet", async () => {
    const pay = vi.fn<LauncherDeps["pay"]>(async () => {});
    const { actor } = await ready({ pay });
    actor.send({ type: "budget.pay", month: monthKey(new Date()) });
    const noWallet = await ready({ pay, walletStatus: async () => null });
    noWallet.actor.send({ type: "budget.pay", month: lastMonth });
    expect(actor.getSnapshot().matches({ budget: "idle" })).toBe(true);
    expect(noWallet.actor.getSnapshot().matches({ budget: "idle" })).toBe(true);
    expect(pay).not.toHaveBeenCalled();
  });
});

describe("relays", () => {
  const loaded = (s: { context: { loading: string[] } }) => s.context.loading.length === 0;
  const url = "wss://relay.example.com";

  it("starts with saved relays and checks each switched-on one", async () => {
    const probeRelay = vi.fn(async (u: string) => u === url);
    const saved = [
      { url, enabled: true, read: ["listings" as const], write: [] },
      { url: "wss://down.example", enabled: true, read: [], write: [] },
      { url: "wss://off.example", enabled: false, read: [], write: [] },
    ];
    const { actor } = start({ probeRelay }, { relays: saved });
    await waitFor(actor, (s) => Object.keys(s.context.relayStatus).length === 2);
    await waitFor(actor, (s) => !Object.values(s.context.relayStatus).includes("checking"));
    expect(actor.getSnapshot().context.relays).toEqual(saved);
    expect(actor.getSnapshot().context.relayStatus).toEqual({
      [url]: "connected",
      "wss://down.example": "failed",
    });
  });

  it("adds a relay, saves it and fetches the library again", async () => {
    const fetchLists = vi.fn<LauncherDeps["fetchLists"]>(() =>
      Promise.reject(new Error("offline")),
    );
    const { actor, deps } = start({ fetchLists }, { relays: [] });
    await waitFor(actor, loaded);
    expect(unreachable(actor.getSnapshot().context)).toBe(true);
    fetchLists.mockImplementation(async (ref: ListRef) => [listOf(ref, [game])]);
    actor.send({ type: "relay.add", input: "relay.example.com" });
    await waitFor(actor, loaded);
    expect(deps.saveRelays).toHaveBeenLastCalledWith([expect.objectContaining({ url })]);
    expect(fetchLists).toHaveBeenCalledTimes(2);
    expect(library(actor.getSnapshot().context)).toEqual([{ game, from: [PICKS_ID] }]);
    expect(unreachable(actor.getSnapshot().context)).toBe(false);
  });

  it("rejects an address that isn't a wss relay", () => {
    const { actor, deps } = start({}, { relays: [] });
    actor.send({ type: "relay.add", input: "https://example.com" });
    expect(actor.getSnapshot().context.relayError).toMatch(/wss:\/\//);
    expect(deps.saveRelays).not.toHaveBeenCalled();
    actor.send({ type: "relay.add", input: url });
    expect(actor.getSnapshot().context.relayError).toBe("");
  });

  it("switches a relay off, routes its reads and removes it, saving each change", async () => {
    const relay = { url, enabled: true, read: ["listings" as const], write: [] };
    const { actor, deps } = start({}, { relays: [relay] });
    await waitFor(actor, loaded);
    actor.send({ type: "relay.toggle", url });
    expect(deps.saveRelays).toHaveBeenLastCalledWith([{ ...relay, enabled: false }]);
    actor.send({ type: "relay.use", url, use: "social", on: true });
    expect(deps.saveRelays).toHaveBeenLastCalledWith([
      { ...relay, enabled: false, read: ["listings", "social"] },
    ]);
    actor.send({ type: "relay.remove", url });
    expect(deps.saveRelays).toHaveBeenLastCalledWith([]);
  });
});
