import { unwrapEvent, wrapEvent } from "nostr-tools/nip59";
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent } from "nostr-tools/pure";
import { bytesToHex, hexToBytes } from "nostr-tools/utils";
import { describe, expect, it } from "vitest";
import type { Game } from "./listing";
import {
  circleStatus,
  modeFor,
  planCircle,
  publicStatus,
  readStatus,
  STATUS_TTL,
  unwrapCircle,
  wrapCircle,
} from "./presence";
import { signerFor } from "./signer.testing";

const game = { coordinate: "31990:abc:nochess", name: "Nochess" } as Game;
const now = 1_790_000_000;

describe("settings", () => {
  it("uses the per-game override, else the default", () => {
    const settings = { mode: "friends" as const, games: { [game.coordinate]: "hidden" as const } };
    expect(modeFor(settings, game.coordinate)).toBe("hidden");
    expect(modeFor(settings, "31990:abc:other")).toBe("friends");
  });
});

describe("public status", () => {
  it("is a NIP-38 game status pointing at the listing and expiring after 3 hours", () => {
    expect(publicStatus(game, now)).toEqual({
      kind: 30315,
      content: "Playing Nochess",
      tags: [
        ["d", "game"],
        ["a", game.coordinate],
        ["expiration", String(now + STATUS_TTL)],
      ],
      created_at: now,
    });
  });

  it("clears with an empty status", () => {
    expect(publicStatus(undefined, now)).toEqual({
      kind: 30315,
      content: "",
      tags: [["d", "game"]],
      created_at: now,
    });
  });

  it("reads back, and reads an empty status as nothing", () => {
    const key = generateSecretKey();
    const status = finalizeEvent(publicStatus(game, now), key);
    expect(readStatus(status)).toEqual({
      content: "Playing Nochess",
      coordinate: game.coordinate,
      expires: now + STATUS_TTL,
      at: now,
    });
    expect(readStatus(finalizeEvent(publicStatus(undefined, now), key))).toBeUndefined();
  });
});

describe("circle", () => {
  it("starts a circle with every friend", () => {
    const { circle, wrapTo } = planCircle(undefined, ["a", "b"]);
    expect(circle.members).toEqual(["a", "b"]);
    expect(circle.secret).toMatch(/^[0-9a-f]{64}$/);
    expect(wrapTo).toEqual(["a", "b"]);
  });

  it("sends the same key only to new friends", () => {
    const old = { secret: "11".repeat(32), members: ["a", "b"] };
    expect(planCircle(old, ["a", "b", "c"])).toEqual({
      circle: { secret: old.secret, members: ["a", "b", "c"] },
      wrapTo: ["c"],
    });
    expect(planCircle(old, ["b", "a"]).wrapTo).toEqual([]);
  });

  it("rotates the key and re-sends it to everyone left when a friend is removed", () => {
    const old = { secret: "11".repeat(32), members: ["a", "b", "c"] };
    const { circle, wrapTo } = planCircle(old, ["a", "c"]);
    expect(circle.secret).not.toBe(old.secret);
    expect(circle.members).toEqual(["a", "c"]);
    expect(wrapTo).toEqual(["a", "c"]);
  });

  it("encrypts a friends-only status to the circle key, signed by it, with the game hidden", () => {
    const secret = bytesToHex(generateSecretKey());
    const event = circleStatus(secret, game, now);
    expect(verifyEvent(event)).toBe(true);
    expect(event.pubkey).toBe(getPublicKey(hexToBytes(secret)));
    expect(event.kind).toBe(30315);
    expect(event.tags).toEqual([
      ["d", "game"],
      ["expiration", String(now + STATUS_TTL)],
    ]);
    expect(event.content).not.toContain("Nochess");
    expect(readStatus(event, secret)).toEqual({
      content: "Playing Nochess",
      coordinate: game.coordinate,
      expires: now + STATUS_TTL,
      at: now,
    });
    expect(readStatus(event, bytesToHex(generateSecretKey()))).toBeUndefined();
    expect(readStatus(circleStatus(secret, undefined, now), secret)).toBeUndefined();
  });

  it("gift-wraps the circle key so the friend can unwrap it with standard NIP-59", async () => {
    const me = generateSecretKey();
    const friend = generateSecretKey();
    const secret = bytesToHex(generateSecretKey());
    const wrap = await wrapCircle(signerFor(me), getPublicKey(me), secret, getPublicKey(friend));
    expect(wrap.kind).toBe(1059);
    expect(wrap.tags).toEqual([["p", getPublicKey(friend)]]);
    expect(wrap.pubkey).not.toBe(getPublicKey(me));
    const rumor = unwrapEvent(wrap, friend);
    expect(rumor.pubkey).toBe(getPublicKey(me));
    expect(await unwrapCircle(signerFor(friend), wrap)).toEqual({
      owner: getPublicKey(me),
      secret,
      at: rumor.created_at,
    });
  });

  it("unwraps a circle key that another client wrapped", async () => {
    const friend = generateSecretKey();
    const me = generateSecretKey();
    const secret = bytesToHex(generateSecretKey());
    const wrap = wrapEvent(
      { kind: 30078, content: secret, tags: [["d", "keyhall/presence"]] },
      friend,
      getPublicKey(me),
    );
    expect((await unwrapCircle(signerFor(me), wrap))?.owner).toBe(getPublicKey(friend));
    const other = wrapEvent({ kind: 14, content: "hi", tags: [] }, friend, getPublicKey(me));
    expect(await unwrapCircle(signerFor(me), other)).toBeUndefined();
  });

  it("rejects a seal whose rumor claims another author", async () => {
    const mallory = generateSecretKey();
    const me = generateSecretKey();
    const victim = getPublicKey(generateSecretKey());
    const wrap = await wrapCircle(
      signerFor(mallory),
      victim,
      bytesToHex(generateSecretKey()),
      getPublicKey(me),
    );
    expect(await unwrapCircle(signerFor(me), wrap)).toBeUndefined();
  });
});
