import { finalizeEvent, generateSecretKey, verifyEvent, type Event } from "nostr-tools/pure";
import { describe, expect, it, vi } from "vitest";
import type { Game } from "./listing";
import { payments, payOverNwc, zapInvoice } from "./zap";

const invoice = (sats: number) => `lnbc${sats * 10}n1${"q".repeat(60)}`;
const json = (body: unknown) => new Response(JSON.stringify(body));

function lnurl(over: Record<string, unknown> = {}) {
  const calls: URL[] = [];
  const fetch = vi.fn(async (input: string | URL) => {
    const url = new URL(input);
    calls.push(url);
    if (url.pathname === "/.well-known/lnurlp/dev")
      return json({
        callback: "https://x.io/cb",
        minSendable: 1000,
        maxSendable: 1e9,
        allowsNostr: true,
        nostrPubkey: "f".repeat(64),
        ...over,
      });
    return json({ pr: invoice(Number(url.searchParams.get("amount")) / 1000) });
  });
  return { fetch, calls };
}

const part = {
  key: "31990:a:x b",
  coordinate: "31990:a:x",
  pubkey: "b".repeat(64),
  lud16: "dev@x.io",
  sats: 500,
};

describe("zapInvoice", () => {
  it("requests an invoice with an anonymous zap request for the game", async () => {
    const { fetch, calls } = lnurl();
    const pr = await zapInvoice(fetch, part, "Keyhall budget, October", ["wss://nos.lol"]);
    expect(pr).toBe(invoice(500));
    const callback = calls[1]!;
    expect(callback.searchParams.get("amount")).toBe("500000");
    const request = JSON.parse(callback.searchParams.get("nostr")!) as Event;
    expect(verifyEvent(request)).toBe(true);
    expect(request.kind).toBe(9734);
    expect(request.pubkey).not.toBe(part.pubkey);
    expect(request.content).toBe("Keyhall budget, October");
    expect(request.tags).toEqual(
      expect.arrayContaining([
        ["p", part.pubkey],
        ["a", part.coordinate],
        ["amount", "500000"],
        ["relays", "wss://nos.lol"],
        ["anon"],
      ]),
    );
  });

  it("zaps Keyhall without a game coordinate", async () => {
    const { fetch, calls } = lnurl();
    await zapInvoice(fetch, { ...part, coordinate: "" }, "", []);
    const request = JSON.parse(calls[1]!.searchParams.get("nostr")!) as Event;
    expect(request.tags.find(([name]) => name === "a")).toBeUndefined();
  });

  it("falls back to a plain LNURL payment with a comment", async () => {
    const { fetch, calls } = lnurl({ allowsNostr: false, commentAllowed: 100 });
    await zapInvoice(fetch, part, "Keyhall budget", []);
    expect(calls[1]!.searchParams.get("nostr")).toBeNull();
    expect(calls[1]!.searchParams.get("comment")).toBe("Keyhall budget");
  });

  it("refuses an invoice for a different amount", async () => {
    const fetch = vi.fn(async (input: string | URL) =>
      String(input).includes("lnurlp")
        ? json({ callback: "https://x.io/cb", minSendable: 1000, maxSendable: 1e9 })
        : json({ pr: invoice(5000) }),
    );
    await expect(zapInvoice(fetch, part, "", [])).rejects.toThrow("asked for 5000 sats");
  });

  it("reports the LNURL server's errors and limits", async () => {
    const tooSmall = lnurl({ minSendable: 1_000_000 });
    await expect(zapInvoice(tooSmall.fetch, part, "", [])).rejects.toThrow("between 1000");
    const failing = vi.fn(async () => json({ status: "ERROR", reason: "no such user" }));
    await expect(zapInvoice(failing, part, "", [])).rejects.toThrow("no such user");
  });
});

describe("payments", () => {
  const game = (coordinate: string, payTo: Game["payTo"]) => ({ coordinate, payTo }) as Game;

  it("splits each share between the game's recipients by weight", () => {
    const games = [
      game("g1", [
        { pubkey: "b", weight: 9 },
        { pubkey: "c", weight: 1 },
      ]),
      game("g2", [{ pubkey: "d", weight: 1, lud16: "d@x.io" }]),
    ];
    const shares = [
      { coordinate: "g1", seconds: 1, percent: 1, sats: 1001 },
      { coordinate: "g2", seconds: 1, percent: 1, sats: 300 },
      { coordinate: "g3", seconds: 1, percent: 1, sats: 0, reason: "floor" as const },
    ];
    expect(payments(shares, games)).toEqual([
      { key: "g1 b", coordinate: "g1", pubkey: "b", sats: 901 },
      { key: "g1 c", coordinate: "g1", pubkey: "c", sats: 100 },
      { key: "g2 d", coordinate: "g2", pubkey: "d", lud16: "d@x.io", sats: 300 },
    ]);
  });
});

describe("payOverNwc", () => {
  const wallet = generateSecretKey();
  const request = finalizeEvent({ kind: 23194, content: "enc", tags: [], created_at: 1 }, wallet);

  function pool() {
    let onevent: (e: Event) => void = () => {};
    return {
      published: [] as Event[],
      subscribeMany: vi.fn(
        (_relays: string[], _filter: unknown, params: { onevent: typeof onevent }) => {
          onevent = params.onevent;
          return { close: vi.fn() };
        },
      ),
      publish(_relays: string[], event: Event) {
        this.published.push(event);
        return [Promise.resolve("")];
      },
      reply: (e: Event) => onevent(e),
    };
  }

  it("publishes the signed request and decodes the wallet's reply", async () => {
    const relays = pool();
    const decode = vi.fn(async () => "preimage");
    const paid = payOverNwc({ event: request, relay: "wss://r", wallet: "w" }, relays, decode);
    expect(relays.published).toEqual([request]);
    expect(relays.subscribeMany).toHaveBeenCalledWith(
      ["wss://r"],
      { kinds: [23195], authors: ["w"], "#e": [request.id] },
      expect.anything(),
    );
    const reply = { ...request, kind: 23195 };
    relays.reply(reply);
    await expect(paid).resolves.toBe("preimage");
    expect(decode).toHaveBeenCalledWith(reply);
  });

  it("gives up when the wallet doesn't answer", async () => {
    vi.useFakeTimers();
    const paid = payOverNwc({ event: request, relay: "wss://r", wallet: "w" }, pool(), vi.fn());
    vi.advanceTimersByTime(60_000);
    await expect(paid).rejects.toThrow("The wallet didn't answer");
    vi.useRealTimers();
  });
});
