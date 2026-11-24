import type { Filter } from "nostr-tools/filter";
import type { Event } from "nostr-tools/pure";
import { normalizeRelay } from "./relaySettings";

export interface Message {
  id: string;
  from: string;
  to: string;
  text: string;
  at: number;
}

export interface DmDeps {
  wrap(to: string, text: string): Promise<[Event, Event]>;
  unwrap(wrap: Event): Promise<Message>;
  inboxRelays(pubkey: string): Promise<string[]>;
  publish(event: Event, relays: string[]): Promise<void>;
}

export const inboxRelays = (list: Event | undefined) =>
  (list?.tags ?? []).flatMap((t) => {
    const url = t[0] === "relay" && t[1] ? normalizeRelay(t[1]) : undefined;
    return url ? [url] : [];
  });

export async function sendDm(deps: DmDeps, me: string, to: string, text: string) {
  const [theirs, mine] = await deps.wrap(to, text);
  const [theirRelays, myRelays] = await Promise.all([deps.inboxRelays(to), deps.inboxRelays(me)]);
  await Promise.all([deps.publish(theirs, theirRelays), deps.publish(mine, myRelays)]);
  return deps.unwrap(mine);
}

interface WatchDeps extends Pick<DmDeps, "inboxRelays" | "unwrap"> {
  subscribe(filter: Filter, onEvent: (event: Event) => void, relays: string[]): () => void;
}

export function watchDms(deps: WatchDeps, me: string, onMessage: (message: Message) => void) {
  let close: (() => void) | undefined;
  let stopped = false;
  void deps.inboxRelays(me).then((relays) => {
    if (stopped) return;
    close = deps.subscribe(
      { kinds: [1059], "#p": [me] },
      (wrap) => deps.unwrap(wrap).then(onMessage, () => {}),
      relays,
    );
  });
  return () => {
    stopped = true;
    close?.();
  };
}

export const addMessage = (thread: Message[], message: Message) =>
  thread.some((m) => m.id === message.id)
    ? thread
    : [...thread, message].sort((a, b) => a.at - b.at);
