import { describe, expect, it } from "vitest";
import { nudge, place } from "./overlay";

const card = { width: 400, height: 300 };
const view = { width: 1000, height: 700 };

describe("in-game window placement", () => {
  it("centres a window that was never moved, cascading the later ones", () => {
    expect(place(card, view)).toEqual({ x: 300, y: 200 });
    expect(place(card, view, undefined, 2)).toEqual({ x: 364, y: 264 });
  });

  it("keeps a moved window where it was left, and on-screen when the game shrinks", () => {
    expect(place(card, view, { x: 20, y: 380 })).toEqual({ x: 20, y: 380 });
    expect(place(card, { width: 600, height: 500 }, { x: 500, y: 380 })).toEqual({
      x: 200,
      y: 200,
    });
    expect(place(card, { width: 300, height: 200 }, { x: -50, y: 10 })).toEqual({ x: 0, y: 0 });
  });

  it("nudges with the arrow keys, further with Shift", () => {
    expect(nudge({ x: 100, y: 100 }, "ArrowLeft", false)).toEqual({ x: 90, y: 100 });
    expect(nudge({ x: 100, y: 100 }, "ArrowDown", true)).toEqual({ x: 100, y: 150 });
    expect(nudge({ x: 100, y: 100 }, "Enter", false)).toBeUndefined();
  });
});
