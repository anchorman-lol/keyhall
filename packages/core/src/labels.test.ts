import { describe, expect, it } from "vitest";
import { depthVerdict, labelTemplate, parseLabels, signInVerdict } from "./labels";
import type { NostrEvent } from "./listing";

const game = "31990:dev:blockstr";
const label = (pubkey: string, created_at: number, tags: string[][]): NostrEvent => ({
  kind: 1985,
  id: `${pubkey}${created_at}`,
  pubkey,
  created_at,
  content: "",
  sig: "",
  tags: [...tags, ["a", game]],
});
const auth = (...methods: string[]) => [
  ["L", "game.auth"],
  ...methods.map((m) => ["l", m, "game.auth"]),
];
const depth = (value: string) => [
  ["L", "game.depth"],
  ["l", value, "game.depth"],
];

describe("parseLabels", () => {
  it("reads sign-in and depth labels per curator and listing, newest first", () => {
    expect(
      parseLabels([
        label("picks", 1, auth("nip07", "nsec")),
        label("picks", 2, auth("nip07", "nip46")),
        label("picks", 1, depth("multiplayer")),
        label("other", 5, [...auth("guest"), ...depth("bogus")]),
      ]),
    ).toEqual([
      { curator: "picks", coordinate: game, signIn: "signer", depth: "multiplayer" },
      { curator: "other", coordinate: game, signIn: "throwaway" },
    ]);
  });

  it("ignores other kinds, namespaces and targets", () => {
    const off = { ...label("picks", 1, auth("nip07")), kind: 1 };
    const ns = label("picks", 1, [["l", "nip07", "ugc"]]);
    const target = { ...label("picks", 1, auth("nip07")), tags: auth("nip07") };
    expect(parseLabels([off, ns, target])).toEqual([]);
  });
});

describe("signInVerdict", () => {
  it("shows the listing's badge when nobody checked", () => {
    expect(signInVerdict("signer", [])).toEqual({ value: "signer", verifiedBy: [], conflicts: [] });
  });

  it("is verified by the curators whose label matches", () => {
    expect(
      signInVerdict("signer", [
        { from: "picks", value: "signer" },
        { from: "chess", value: "signer" },
      ]),
    ).toEqual({ value: "signer", verifiedBy: ["picks", "chess"], conflicts: [] });
  });

  it("lets the first curator win over the listing and lists who disagrees", () => {
    expect(
      signInVerdict("signer", [
        { from: "picks", value: "signer-or-nsec" },
        { from: "chess", value: "signer" },
      ]),
    ).toEqual({
      value: "signer-or-nsec",
      verifiedBy: ["picks"],
      conflicts: [
        { from: "listing", value: "signer" },
        { from: "chess", value: "signer" },
      ],
    });
  });

  it("doesn't count a listing without auth tags as disagreeing", () => {
    expect(signInVerdict("unknown", [{ from: "picks", value: "nsec" }]).conflicts).toEqual([]);
  });

  it("flags a key-shaped field in a game that claims not to take an nsec", () => {
    const seen = { kinds: [], signer: true, keyField: true };
    expect(signInVerdict("signer", [], seen).conflicts).toEqual([
      { from: "window", value: "signer-or-nsec" },
    ]);
    expect(signInVerdict("signer-or-nsec", [], seen).conflicts).toEqual([]);
  });

  it("flags a game that used the signer although it claims to need an nsec", () => {
    expect(signInVerdict("nsec", [], { kinds: [], signer: true }).conflicts).toEqual([
      { from: "window", value: "signer" },
    ]);
    expect(signInVerdict("throwaway", [], { kinds: [], signer: true }).conflicts).toEqual([]);
    expect(
      signInVerdict("nsec", [], { kinds: [], signer: false, keyField: true }).conflicts,
    ).toEqual([]);
  });
});

describe("depthVerdict", () => {
  it("lets the game window win, then curators, then the listing", () => {
    expect(depthVerdict("multiplayer", [{ from: "picks", value: "identity" }])).toEqual({
      value: "identity",
      verifiedBy: ["picks"],
      conflicts: [{ from: "listing", value: "multiplayer" }],
    });
    expect(
      depthVerdict("multiplayer", [{ from: "picks", value: "identity" }], {
        kinds: [64],
        signer: true,
      }),
    ).toEqual({
      value: "multiplayer",
      seen: true,
      verifiedBy: [],
      conflicts: [{ from: "picks", value: "identity" }],
    });
  });

  it("has no value when nobody knows", () => {
    expect(depthVerdict(undefined, [])).toEqual({
      value: undefined,
      verifiedBy: [],
      conflicts: [],
    });
  });
});

describe("labelTemplate", () => {
  it("labels a listing's sign-in methods and depth", () => {
    expect(labelTemplate(game, ["nip07", "nsec"], "identity", 42)).toEqual({
      kind: 1985,
      created_at: 42,
      content: "",
      tags: [
        ["L", "game.auth"],
        ["l", "nip07", "game.auth"],
        ["l", "nsec", "game.auth"],
        ["L", "game.depth"],
        ["l", "identity", "game.depth"],
        ["a", game],
      ],
    });
    expect(labelTemplate(game, [], undefined, 1).tags).toEqual([["a", game]]);
  });
});
