import { getSatoshisAmountFromBolt11 } from "nostr-tools/nip57";
import { finalizeEvent, generateSecretKey, type Event } from "nostr-tools/pure";
import { apportion, type Share } from "./budget";
import type { Game } from "./listing";

export interface Payment {
  key: string;
  coordinate: string;
  pubkey: string;
  lud16?: string;
  sats: number;
}

export interface WalletRequest {
  event: Event;
  relay: string;
  wallet: string;
}

interface Pool {
  subscribeMany(
    relays: string[],
    filter: { kinds: number[]; authors: string[]; "#e": string[] },
    params: { onevent: (event: Event) => void },
  ): { close(): void };
  publish(relays: string[], event: Event): Promise<string>[];
}

export function payments(shares: Share[], games: Game[]): Payment[] {
  return shares.flatMap(({ coordinate, sats }) => {
    const payTo = games.find((g) => g.coordinate === coordinate)?.payTo ?? [];
    if (!sats || !payTo.length) return [];
    const parts = apportion(
      sats,
      payTo.map((r) => r.weight),
    );
    return payTo.map(({ pubkey, lud16 }, i) => ({
      key: `${coordinate} ${pubkey}`,
      coordinate,
      pubkey,
      ...(lud16 && { lud16 }),
      sats: parts[i]!,
    }));
  });
}

const read = async (res: Response) => {
  const body = (await res.json()) as Record<string, unknown>;
  if (body.status === "ERROR") throw new Error(String(body.reason));
  return body;
};

export async function zapInvoice(
  fetch: (url: string | URL) => Promise<Response>,
  payment: Payment & { lud16: string },
  comment: string,
  relays: string[],
): Promise<string> {
  const [name, domain] = payment.lud16.split("@");
  const pay = await read(await fetch(`https://${domain}/.well-known/lnurlp/${name}`));
  const msats = payment.sats * 1000;
  const [min, max] = [Number(pay.minSendable), Number(pay.maxSendable)];
  if (msats < min || msats > max)
    throw new Error(`${payment.lud16} takes between ${min / 1000} and ${max / 1000} sats`);
  const url = new URL(String(pay.callback));
  url.searchParams.set("amount", String(msats));
  if (pay.allowsNostr && pay.nostrPubkey) {
    const request = finalizeEvent(
      {
        kind: 9734,
        content: comment,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ["p", payment.pubkey],
          ...(payment.coordinate ? [["a", payment.coordinate]] : []),
          ["amount", String(msats)],
          ["relays", ...relays],
          ["anon"],
        ],
      },
      generateSecretKey(),
    );
    url.searchParams.set("nostr", JSON.stringify(request));
  } else if (Number(pay.commentAllowed) > 0) {
    url.searchParams.set("comment", comment.slice(0, Number(pay.commentAllowed)));
  }
  const pr = String((await read(await fetch(url))).pr);
  const asked = getSatoshisAmountFromBolt11(pr);
  if (asked !== payment.sats) throw new Error(`The invoice asked for ${asked} sats`);
  return pr;
}

export function payOverNwc(
  { event, relay, wallet }: WalletRequest,
  pool: Pool,
  decode: (reply: Event) => Promise<string>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      sub.close();
      reject(new Error("The wallet didn't answer"));
    }, 60_000);
    const sub = pool.subscribeMany(
      [relay],
      { kinds: [23195], authors: [wallet], "#e": [event.id] },
      {
        onevent: (reply) => {
          clearTimeout(timeout);
          sub.close();
          decode(reply).then(resolve, reject);
        },
      },
    );
    void Promise.allSettled(pool.publish([relay], event));
  });
}
