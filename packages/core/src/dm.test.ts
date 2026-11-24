import type { Event } from "nostr-tools/pure";
import { describe, expect, it, vi } from "vitest";
import {
  addMessage,
  groupThread,
  inboxRelays,
  sendDm,
  unread,
  watchDms,
  type DmDeps,
  type Message,
} from "./dm";

const me = "a".repeat(64);
const friend = "b".repeat(64);
const message = (id: string, at: number): Message => ({ id, from: me, to: friend, text: id, at });
const wrap = (id: string) => ({ id }) as Event;

describe("inboxRelays", () => {
  it("reads the relay tags of a kind 10050 list", () => {
    const list = {
      tags: [
        ["relay", "wss://inbox.example/"],
        ["relay", "http://nope.example"],
        ["r", "wss://x"],
      ],
    } as Event;
    expect(inboxRelays(list)).toEqual(["wss://inbox.example"]);
    expect(inboxRelays(undefined)).toEqual([]);
  });
});

describe("sendDm", () => {
  it("sends each wrap to its owner's inbox relays and returns the sent message", async () => {
    const sent = message("m", 1);
    const deps: DmDeps = {
      wrap: vi.fn(async () => [wrap("theirs"), wrap("mine")] as [Event, Event]),
      unwrap: vi.fn(async () => sent),
      inboxRelays: async (pubkey) => (pubkey === friend ? ["wss://theirs.example"] : []),
      publish: vi.fn(async () => {}),
    };
    expect(await sendDm(deps, me, friend, "gg")).toBe(sent);
    expect(deps.wrap).toHaveBeenCalledWith(friend, "gg");
    expect(deps.publish).toHaveBeenCalledWith(wrap("theirs"), ["wss://theirs.example"]);
    expect(deps.publish).toHaveBeenCalledWith(wrap("mine"), []);
    expect(deps.unwrap).toHaveBeenCalledWith(wrap("mine"));
  });
});

describe("watchDms", () => {
  it("reads gift wraps for me from my inbox relays and skips what isn't a DM", async () => {
    const close = vi.fn();
    const subscribe = vi.fn((_filter, onEvent: (e: Event) => void) => {
      onEvent(wrap("dm"));
      onEvent(wrap("circle key"));
      return close;
    });
    const received: Message[] = [];
    const stop = watchDms(
      {
        subscribe,
        inboxRelays: async () => ["wss://mine.example"],
        unwrap: async (w) => (w.id === "dm" ? message("dm", 1) : Promise.reject(new Error())),
      },
      me,
      (m) => received.push(m),
    );
    await vi.waitFor(() => expect(received).toEqual([message("dm", 1)]));
    expect(subscribe).toHaveBeenCalledWith(
      { kinds: [1059], "#p": [me] },
      expect.any(Function),
      ["wss://mine.example"],
      expect.any(Function),
    );
    stop();
    expect(close).toHaveBeenCalled();
  });

  it("reports ready once the stored wraps are unwrapped", async () => {
    let unwrapped = false;
    const ready = vi.fn(() => expect(unwrapped).toBe(true));
    watchDms(
      {
        subscribe: (_filter, onEvent, _relays, onEose) => {
          onEvent(wrap("dm"));
          onEose?.();
          return () => {};
        },
        inboxRelays: async () => [],
        unwrap: async () => ((unwrapped = true), message("dm", 1)),
      },
      me,
      () => {},
      ready,
    );
    await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
  });
});

describe("addMessage", () => {
  it("keeps a thread in time order without duplicates", () => {
    const thread = [message("b", 2), message("a", 1), message("b", 2)].reduce(addMessage, []);
    expect(thread.map((m) => m.id)).toEqual(["a", "b"]);
  });
});

describe("unread", () => {
  it("counts the friend's messages after the read mark", () => {
    const theirs = (id: string, at: number) => ({ ...message(id, at), from: friend, to: me });
    expect(unread([theirs("a", 1), message("b", 2), theirs("c", 3)], me, 1)).toBe(1);
  });
});

describe("groupThread", () => {
  const at = (day: number, hour: number, minute = 0) =>
    new Date(2026, 10, day, hour, minute).getTime() / 1000;
  const from = (sender: string, id: string, time: number) => ({
    ...message(id, time),
    from: sender,
  });

  it("groups runs by sender, splits after a pause and marks new days", () => {
    const groups = groupThread([
      from(friend, "a", at(23, 22)),
      from(friend, "b", at(23, 22, 3)),
      from(me, "c", at(23, 22, 4)),
      from(me, "d", at(23, 23)),
      from(me, "e", at(24, 9)),
    ]);
    expect(
      groups.map((g) => [g.from === me, g.newDay, g.messages.map((m) => m.id).join("")]),
    ).toEqual([
      [false, true, "ab"],
      [true, false, "c"],
      [true, false, "d"],
      [true, true, "e"],
    ]);
  });
});
