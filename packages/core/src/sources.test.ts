import { describe, expect, it } from "vitest";
import { PICKS_REF } from "./curation";
import type { Game } from "./listing";
import {
  addCurator,
  defaultSources,
  loadSources,
  PICKS_ID,
  removeCurator,
  sourceList,
  toggleSource,
  union,
  UNVETTED_ID,
} from "./sources";

const curator = { pubkey: "c".repeat(64) };
const game = (name: string) =>
  ({ coordinate: `31990:p:${name}`, name, url: `https://${name}.io` }) as Game;

describe("source settings", () => {
  it("starts with Keyhall picks on and unvetted listings off", () => {
    expect(sourceList(defaultSources)).toEqual([
      { id: PICKS_ID, ref: PICKS_REF, enabled: true },
      { id: UNVETTED_ID, enabled: false },
    ]);
  });

  it("adds a curator once, switched on, and toggles and removes it", () => {
    const added = addCurator(addCurator(defaultSources, curator), curator);
    expect(sourceList(added).map((s) => [s.id, s.enabled])).toEqual([
      [PICKS_ID, true],
      [curator.pubkey, true],
      [UNVETTED_ID, false],
    ]);
    const toggled = toggleSource(
      toggleSource(toggleSource(added, PICKS_ID), curator.pubkey),
      UNVETTED_ID,
    );
    expect(sourceList(toggled).map((s) => s.enabled)).toEqual([false, false, true]);
    expect(removeCurator(toggled, curator.pubkey).curators).toEqual([]);
  });

  it("doesn't add the official list as a curator", () => {
    expect(addCurator(defaultSources, PICKS_REF)).toBe(defaultSources);
  });

  it("loads saved settings and falls back to the defaults for anything unreadable", () => {
    const saved = { picks: false, unvetted: true, curators: [{ ref: curator, enabled: false }] };
    expect(loadSources(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(loadSources(null)).toEqual(defaultSources);
    expect(loadSources({ picks: "no", curators: [{ ref: 1 }, "x"] })).toEqual(defaultSources);
  });
});

describe("union", () => {
  it("shows each game once with every enabled source it comes from", () => {
    const [chess, word5, wwz] = [game("Chess"), game("Word5"), game("WWZ")];
    const sources = sourceList(toggleSource(addCurator(defaultSources, curator), UNVETTED_ID));
    expect(
      union(sources, {
        [PICKS_ID]: [word5, chess],
        [curator.pubkey]: [chess],
        [UNVETTED_ID]: [wwz, chess],
      }),
    ).toEqual([
      { game: chess, from: [PICKS_ID, curator.pubkey, UNVETTED_ID] },
      { game: word5, from: [PICKS_ID] },
      { game: wwz, from: [UNVETTED_ID] },
    ]);
  });

  it("merges another author's copy of a picked game into the pick's entry", () => {
    const pick = { ...game("Chess"), url: "https://chess.io" };
    const copy = { ...game("Chess2"), url: "https://chess.io/" };
    const sources = sourceList({ ...defaultSources, unvetted: true });
    expect(union(sources, { [PICKS_ID]: [pick], [UNVETTED_ID]: [copy] })).toEqual([
      { game: pick, from: [PICKS_ID, UNVETTED_ID] },
    ]);
  });

  it("leaves out sources that are switched off", () => {
    const sources = sourceList(defaultSources);
    expect(union(sources, { [UNVETTED_ID]: [game("WWZ")] })).toEqual([]);
  });
});
