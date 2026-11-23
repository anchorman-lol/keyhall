// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { shimScript } from "./shim";

type Win = Window & {
  nostr: { getPublicKey(): Promise<string>; signEvent(e: object): Promise<object> };
  __TAURI_INTERNALS__: { invoke: ReturnType<typeof vi.fn> };
};

const sent: string[] = [];
class FakeSocket {
  send(data: string) {
    sent.push(data);
  }
}

let win: Win;
let invoke: ReturnType<typeof vi.fn>;

beforeEach(() => {
  sent.length = 0;
  invoke = vi.fn(async (cmd: string) =>
    cmd === "nostr_get_public_key" ? "ab".repeat(32) : { id: "1", sig: "2" },
  );
  win = window as unknown as Win;
  win.__TAURI_INTERNALS__ = { invoke };
  (win as unknown as { WebSocket: unknown }).WebSocket = FakeSocket;
  delete (win as Partial<Win>).nostr;
  document.body.innerHTML = "";
  new Function(shimScript("Shift+Tab"))();
});

describe("shim", () => {
  it("answers getPublicKey through the host", async () => {
    await expect(win.nostr.getPublicKey()).resolves.toBe("ab".repeat(32));
    expect(invoke).toHaveBeenCalledWith("nostr_get_public_key", {});
  });

  it("forwards only the unsigned fields of signEvent", async () => {
    const event = {
      kind: 1,
      content: "hi",
      tags: [["t", "x"]],
      created_at: 5,
      pubkey: "evil",
      id: "x",
      sig: "y",
    };
    await win.nostr.signEvent(event);
    expect(invoke).toHaveBeenCalledWith("nostr_sign_event", {
      event: { kind: 1, content: "hi", tags: [["t", "x"]], created_at: 5 },
    });
  });

  it("rejects when the host refuses", async () => {
    invoke.mockRejectedValueOnce("denied");
    await expect(
      win.nostr.signEvent({ kind: 1, content: "", tags: [], created_at: 1 }),
    ).rejects.toBe("denied");
  });

  it("reports each newly seen kind the game publishes or subscribes to, once", () => {
    const ws = new (win as unknown as { WebSocket: new () => FakeSocket }).WebSocket();
    ws.send(JSON.stringify(["REQ", "s", { kinds: [64, 0] }, { kinds: [64] }]));
    ws.send(JSON.stringify(["EVENT", { kind: 30762 }]));
    ws.send(JSON.stringify(["REQ", "t", { kinds: [0] }]));
    ws.send("not json");
    expect(sent).toHaveLength(4);
    expect(invoke.mock.calls.filter(([cmd]) => cmd === "nostr_observe")).toEqual([
      ["nostr_observe", { kinds: [64, 0] }],
      ["nostr_observe", { kinds: [30762] }],
    ]);
  });

  it("asks for the overlay on its hotkey and keeps that key from the game", () => {
    const game = vi.fn();
    document.addEventListener("keydown", game);
    const press = (init: KeyboardEventInit) =>
      document.body.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));
    press({ key: "Tab", shiftKey: true });
    press({ key: "Tab" });
    expect(invoke.mock.calls.filter(([cmd]) => cmd === "open_overlay")).toEqual([
      ["open_overlay", {}],
    ]);
    expect(game).toHaveBeenCalledOnce();
  });

  const keyFields = () => invoke.mock.calls.filter(([cmd]) => cmd === "nostr_key_field");
  const settle = () => new Promise((r) => setTimeout(r));

  const focus = (selector: string) => document.querySelector<HTMLElement>(selector)!.focus();

  it.each([
    ['<input placeholder="nsec1...">'],
    ['<input name="privateKey">'],
    ['<input aria-label="Secret key">'],
    ['<label for="k">Your private key</label><input id="k" type="password">'],
    [`<textarea placeholder="${"0f".repeat(32)}"></textarea>`],
  ])("reports a key-shaped field once it gets focus, without its contents: %s", async (html) => {
    document.body.innerHTML = `<div>${html}</div><input placeholder="nsec">`;
    await settle();
    expect(keyFields()).toEqual([]);
    focus("div :is(input, textarea)");
    focus("body > input");
    expect(keyFields()).toEqual([["nostr_key_field", {}]]);
  });

  it("stays quiet about an optional key field until it is revealed and focused", async () => {
    document.body.innerHTML = "<button>Use your own key</button>";
    const button = document.querySelector("button")!;
    button.addEventListener("click", () =>
      document.body.insertAdjacentHTML("beforeend", '<input placeholder="nsec1...">'),
    );
    button.click();
    await settle();
    expect(keyFields()).toEqual([]);
    focus("input");
    expect(keyFields()).toEqual([["nostr_key_field", {}]]);
  });

  it("ignores ordinary fields and never reads a value", async () => {
    const input = document.createElement("input");
    input.placeholder = "Your name";
    Object.defineProperty(input, "value", {
      get: () => {
        throw new Error("read the value");
      },
    });
    document.body.replaceChildren(input);
    input.focus();
    expect(keyFields()).toEqual([]);
  });
});
