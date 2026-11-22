import { describe, expect, it } from "vitest";
import { listingEvent, parseGame, parsePicks, picksEvent, type CatalogGame } from "./catalog";
import { parseListings } from "./listing";

const IMAGES = "https://example.org/games";
const DEV = "npub1dergggklka99wwrs92yz8wdjs952h2ux2ha2ed598ngwu9w7a6fsh9xzpc";
const SANKI = "31990:4faa4876596f41a81ea1ce8544e5b6bafad1f1d95cbb197026c27ab5609eba63:hkfx6d0r";

const readme = `---
name: Unicorn vs Snakes
url: https://unicorn.dergigi.com/
tags: [arcade, pixel-art]
signIn: [nip07, nip55, guest]
repo: https://github.com/dergigi/unicorn-vs-snakes
developer: ${DEV}
kinds: [1, 30762]
---

<img src="icon.png" width="96" align="right" alt="">

# Unicorn vs Snakes

Who put all these snakes on this 2D plane?

![](banner.png)
`;

const own = (input: string) =>
  parseGame("unicorn", input) as Extract<CatalogGame, { name: string }>;

describe("parseGame", () => {
  it("reads the frontmatter and takes the body without its heading and images as the description", () => {
    expect(own(readme)).toMatchObject({
      id: "unicorn",
      name: "Unicorn vs Snakes",
      url: "https://unicorn.dergigi.com/",
      tags: ["arcade", "pixel-art"],
      signIn: ["nip07", "nip55", "guest"],
      about: "Who put all these snakes on this 2D plane?",
    });
  });

  it.each([
    ["an http url", readme.replace("https://unicorn", "http://unicorn")],
    ["an unknown sign-in method", readme.replace("nip55", "password")],
    [
      "a hex developer key",
      readme.replace(DEV, "6e468422dfb74a5738702a8823b9b28168abab8655faacb6853cd0ee15deee93"),
    ],
    ["an unknown field", readme.replace("kinds:", "price: 3\nkinds:")],
    ["no description", readme.replace(/---\n\n[\s\S]*$/, "---\n")],
  ])("rejects %s", (_, input) => {
    expect(() => parseGame("unicorn", input)).toThrow();
  });

  it("takes a developer's listing with only Keyhall's own fields", () => {
    const listed = `---\nlisting: ${SANKI}\nsignIn: [session]\nnote: Nine pairings.\n---\n\nListed by its developer.\n`;
    expect(parseGame("sanki", listed)).toEqual({
      id: "sanki",
      listing: SANKI,
      signIn: ["session"],
      note: "Nine pairings.",
    });
  });

  it("rejects a listed game that also carries its own metadata", () => {
    const listed = `---\nlisting: ${SANKI}\nname: Sanki\n---\n\nListed by its developer.\n`;
    expect(() => parseGame("sanki", listed)).toThrow();
  });
});

describe("parsePicks", () => {
  it("takes ids with an optional note, in order", () => {
    expect(parsePicks("- knight\n- id: sanki\n  note: really well done\n")).toEqual([
      { id: "knight" },
      { id: "sanki", note: "really well done" },
    ]);
  });

  it("rejects a pick listed twice", () => {
    expect(() => parsePicks("- knight\n- id: knight\n")).toThrow();
  });
});

describe("listingEvent", () => {
  it("is a kind 31990 Keyhall reads back as the same game, paying the developer", () => {
    const event = {
      ...listingEvent(own(readme), IMAGES, 7),
      pubkey: "k".repeat(64),
      id: "",
      sig: "",
    };
    const [game] = parseListings([event], true);
    expect(game).toMatchObject({
      coordinate: `31990:${"k".repeat(64)}:unicorn`,
      name: "Unicorn vs Snakes",
      url: "https://unicorn.dergigi.com/",
      picture: `${IMAGES}/unicorn/icon.png`,
      banner: `${IMAGES}/unicorn/banner.png`,
      signIn: "signer",
      payTo: [
        { pubkey: "6e468422dfb74a5738702a8823b9b28168abab8655faacb6853cd0ee15deee93", weight: 1 },
      ],
    });
    expect(game?.about).toContain("Curated by Keyhall");
    expect(listingEvent(own(readme), IMAGES, 7, false).content).not.toContain("Curated by Keyhall");
    expect(event.tags).toEqual(
      expect.arrayContaining([
        ["web", "https://unicorn.dergigi.com/", "url"],
        ["k", "30762"],
        ["t", "games"],
        ["t", "arcade"],
      ]),
    );
  });
});

describe("picksEvent", () => {
  it("names every pick by its listing address", () => {
    const games = [own(readme), parseGame("sanki", `---\nlisting: ${SANKI}\n---\n\nListed.\n`)];
    const event = picksEvent([{ id: "sanki" }, { id: "unicorn" }], games, "p".repeat(64), 9);
    expect(event.tags.filter((t) => t[0] === "a")).toEqual([
      ["a", SANKI],
      ["a", `31990:${"p".repeat(64)}:unicorn`],
    ]);
    expect(event.tags.some((t) => t[0] === "r")).toBe(false);
  });

  it("refuses a pick without a game folder", () => {
    expect(() => picksEvent([{ id: "ghost" }], [], "p".repeat(64), 9)).toThrow(/ghost/);
  });
});
