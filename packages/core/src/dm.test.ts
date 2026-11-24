import type { Event } from "nostr-tools/pure";
import { describe, expect, it, vi } from "vitest";
import { addMessage, inboxRelays, sendDm, watchDms, type DmDeps, type Message } from "./dm";

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
    expect(subscribe).toHaveBeenCalledWith({ kinds: [1059], "#p": [me] }, expect.any(Function), [
      "wss://mine.example",
    ]);
    stop();
    expect(close).toHaveBeenCalled();
  });
});

describe("addMessage", () => {
  it("keeps a thread in time order without duplicates", () => {
    const thread = [message("b", 2), message("a", 1), message("b", 2)].reduce(addMessage, []);
    expect(thread.map((m) => m.id)).toEqual(["a", "b"]);
  });
});
