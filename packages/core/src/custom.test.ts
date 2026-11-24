import { describe, expect, it } from "vitest";
import { customGame, loadCustom, removeCustom, saveCustom, type CustomGame } from "./custom";

const web: CustomGame = { id: "a", name: "Chess", url: "https://chess.example", addedAt: 5 };
const app: CustomGame = { id: "b", name: "Celeste", url: "/Applications/Celeste.app", addedAt: 6 };

describe("custom games", () => {
  it("adds a web game or an app on this computer, and edits one in place", () => {
    const added = saveCustom([], { name: " Chess ", url: "https://chess.example" }, 5);
    expect(added).toEqual([
      { id: expect.any(String), name: "Chess", url: "https://chess.example", addedAt: 5 },
    ]);
    const id = (added as CustomGame[])[0]!.id;
    const both = saveCustom(added as CustomGame[], { name: "Celeste", url: app.url }, 6);
    expect(both).toHaveLength(2);
    expect(
      saveCustom(both as CustomGame[], { id, name: "Chess 2", url: web.url, lud16: "me@x.io" }, 9),
    ).toEqual([{ id, name: "Chess 2", url: web.url, lud16: "me@x.io", addedAt: 5 }, both[1]]);
  });

  it("takes a local program by its absolute path on any OS", () => {
    for (const url of ["/usr/games/nethack", "C:\\Games\\Doom.exe", "/Applications/Celeste.app"])
      expect(customGame(saveCustom([], { name: "X", url }, 1)[0] as CustomGame).custom).toBe("app");
  });

  it("rejects entries without a name, an https URL or a program, or with a bad lightning address", () => {
    expect(saveCustom([], { name: "", url: web.url }, 1)).toBe("Give it a name.");
    for (const url of ["http://x.io", "chess.example", "Games/doom.exe"])
      expect(saveCustom([], { name: "X", url }, 1)).toBe(
        "Enter an https:// address or choose an app.",
      );
    expect(saveCustom([], { name: "X", url: web.url, lud16: "nope" }, 1)).toBe(
      "A lightning address looks like name@domain.com.",
    );
  });

  it("removes one and loads only valid saved entries", () => {
    expect(removeCustom([web, app], "a")).toEqual([app]);
    expect(loadCustom([web, { id: 1 }, app])).toEqual([web, app]);
    expect(loadCustom("junk")).toEqual([]);
  });

  it("becomes a game: a web window or an app, payable only with a lightning address", () => {
    expect(customGame(web)).toMatchObject({
      coordinate: "custom:a",
      name: "Chess",
      url: web.url,
      custom: "web",
      createdAt: 5,
      payTo: [],
    });
    expect(customGame({ ...app, lud16: "me@x.io" })).toMatchObject({
      coordinate: "custom:b",
      custom: "app",
      payTo: [{ pubkey: "", weight: 1, lud16: "me@x.io" }],
    });
  });
});
