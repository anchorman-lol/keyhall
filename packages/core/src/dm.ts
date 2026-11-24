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
  subscribe(
    filter: Filter,
    onEvent: (event: Event) => void,
    relays: string[],
    onEose?: () => void,
  ): () => void;
}

export function watchDms(
  deps: WatchDeps,
  me: string,
  onMessage: (message: Message) => void,
  onReady?: () => void,
) {
  let close: (() => void) | undefined;
  let stopped = false;
  let stored: Promise<void>[] | undefined = [];
  void deps.inboxRelays(me).then((relays) => {
    if (stopped) return;
    close = deps.subscribe(
      { kinds: [1059], "#p": [me] },
      (wrap) => {
        const unwrapped = deps.unwrap(wrap).then(onMessage, () => {});
        stored?.push(unwrapped);
      },
      relays,
      () =>
        void Promise.all(stored ?? []).then(() => {
          stored = undefined;
          onReady?.();
        }),
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

export const unread = (thread: Message[], me: string, readAt = 0) =>
  thread.filter((m) => m.from !== me && m.at > readAt).length;

const day = (at: number) => new Date(at * 1000).toDateString();

export function groupThread<M extends Message>(thread: M[], pause = 300) {
  const groups: { from: string; newDay: boolean; messages: M[] }[] = [];
  thread.forEach((m, i) => {
    const prev = thread[i - 1];
    const newDay = !prev || day(prev.at) !== day(m.at);
    if (prev && !newDay && prev.from === m.from && m.at - prev.at < pause)
      groups.at(-1)!.messages.push(m);
    else groups.push({ from: m.from, newDay, messages: [m] });
  });
  return groups;
}
