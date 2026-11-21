import { describe, expect, it } from "vitest";
import { classifyDepth, resolveDepth } from "./depth";

describe("classifyDepth", () => {
  it("knows nothing before the game did anything", () => {
    expect(classifyDepth({ kinds: [], signer: false })).toBeUndefined();
  });

  it("calls a game multiplayer when it uses kinds beyond identity", () => {
    expect(classifyDepth({ kinds: [0, 64], signer: true })).toBe("multiplayer");
  });

  it("calls profile, score and social kinds identity only", () => {
    expect(classifyDepth({ kinds: [0, 1, 7, 30762, 10002], signer: true })).toBe("identity");
  });

  it("counts asking for the public key as identity", () => {
    expect(classifyDepth({ kinds: [], signer: true })).toBe("identity");
  });

  it("calls ephemeral signalling alone no Nostr", () => {
    expect(classifyDepth({ kinds: [25050, 20001], signer: false })).toBe("none");
  });
});

describe("resolveDepth", () => {
  it("shows the declared depth until the game is observed", () => {
    expect(resolveDepth("multiplayer", undefined)).toEqual({
      depth: "multiplayer",
      verified: false,
    });
  });

  it("verifies a declaration the game window confirmed", () => {
    expect(resolveDepth("identity", "identity")).toEqual({ depth: "identity", verified: true });
  });

  it("lets observation win over the listing", () => {
    expect(resolveDepth("multiplayer", "identity")).toEqual({ depth: "identity", verified: true });
  });

  it("has no depth when neither is known", () => {
    expect(resolveDepth(undefined, undefined)).toEqual({ depth: undefined, verified: false });
  });
});
