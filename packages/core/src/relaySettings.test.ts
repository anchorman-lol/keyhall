import { describe, expect, it } from "vitest";
import {
  addRelay,
  DEFAULT_RELAYS,
  loadRelays,
  MAIN_RELAY,
  normalizeRelay,
  relaysFor,
  removeRelay,
  setUse,
  toggleRelay,
  writeUseOf,
} from "./relaySettings";

const url = "wss://relay.example.com";

describe("relay settings", () => {
  it("defaults to at most five relays, led by our own", () => {
    expect(DEFAULT_RELAYS[0]!.url).toBe(MAIN_RELAY);
    expect(MAIN_RELAY).toBe("wss://relay.anchorman.lol");
    expect(DEFAULT_RELAYS.length).toBeLessThanOrEqual(5);
    expect(new Set(DEFAULT_RELAYS.map((r) => r.url)).size).toBe(DEFAULT_RELAYS.length);
  });

  it("normalizes relay addresses and rejects anything that isn't a secure websocket", () => {
    expect(normalizeRelay(" Relay.Example.com/ ")).toBe(url);
    expect(normalizeRelay("wss://relay.example.com/")).toBe(url);
    expect(normalizeRelay("wss://relay.example.com/inbox")).toBe(`${url}/inbox`);
    expect(normalizeRelay("https://relay.example.com")).toBeUndefined();
    expect(normalizeRelay("ws://relay.example.com")).toBeUndefined();
    expect(normalizeRelay("not a relay")).toBeUndefined();
    expect(normalizeRelay("")).toBeUndefined();
  });

  it("adds a relay once, switched on for everything, and rejects bad input", () => {
    const added = addRelay([], "relay.example.com")!;
    expect(added).toEqual([
      {
        url,
        enabled: true,
        read: ["listings", "lists", "social"],
        write: ["presence", "labels", "zaps"],
      },
    ]);
    expect(addRelay(added, "wss://relay.example.com/")).toBe(added);
    expect(addRelay(added, "http://nope")).toBeUndefined();
  });

  it("toggles, routes and removes relays", () => {
    const relays = addRelay(addRelay([], url)!, "wss://other.example")!;
    const routed = setUse(
      setUse(toggleRelay(relays, "wss://other.example"), url, "social", false),
      url,
      "zaps",
      false,
    );
    expect(relaysFor(routed, "listings")).toEqual([url]);
    expect(relaysFor(routed, "social")).toEqual([]);
    expect(relaysFor(routed, "presence")).toEqual([url]);
    expect(relaysFor(routed, "zaps")).toEqual([]);
    expect(relaysFor(setUse(routed, url, "social", true), "social")).toEqual([url]);
    expect(removeRelay(routed, url).map((r) => r.url)).toEqual(["wss://other.example"]);
  });

  it("routes published events by kind", () => {
    expect(writeUseOf(1985)).toBe("labels");
    expect(writeUseOf(30315)).toBe("presence");
    expect(writeUseOf(1059)).toBe("presence");
  });

  it("loads saved relays, dropping bad entries and duplicates, and falls back to defaults", () => {
    const saved = [
      { url, enabled: false, read: ["listings", "bogus"], write: [] },
      { url: "wss://relay.example.com/", enabled: true, read: [], write: [] },
      { url: "http://nope", enabled: true, read: [], write: [] },
      { url: "wss://ok.example", enabled: "yes", read: [], write: [] },
      "x",
    ];
    expect(loadRelays(JSON.parse(JSON.stringify(saved)))).toEqual([
      { url, enabled: false, read: ["listings"], write: [] },
    ]);
    expect(loadRelays([])).toEqual([]);
    expect(loadRelays(null)).toEqual(DEFAULT_RELAYS);
    expect(loadRelays({ url })).toEqual(DEFAULT_RELAYS);
  });
});
