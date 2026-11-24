import { addMessage, groupThread, sendDm, unread, watchDms, type Message } from "@keyhall/core/dm";
import { findGame, playing } from "@keyhall/core/launcher";
import { friendName, type Friend } from "@keyhall/core/presence";
import { Button } from "@keyhall/ui/components/button";
import { CaretDownIcon, CaretUpIcon, PaperPlaneRightIcon, XIcon } from "@phosphor-icons/react";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Avatar } from "./Friends.tsx";
import { dms, Launcher } from "./launcher.ts";
import { GameIcon } from "./Library.tsx";

type ChatMessage = Message & { state?: "sending" | "failed" };

const loadRead = (me: string) => {
  const stored = JSON.parse(localStorage.getItem("dmRead") ?? "null");
  return stored?.me === me ? (stored.read as Record<string, number>) : {};
};

function useChatState(me: string) {
  const [threads, setThreads] = useState<Record<string, ChatMessage[]>>({});
  const [tabs, setTabs] = useState<string[]>([]);
  const [active, setActive] = useState<string>();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [read, setRead] = useState(() => loadRead(me));
  const put = (peer: string, update: (thread: ChatMessage[]) => ChatMessage[]) =>
    setThreads((all) => ({ ...all, [peer]: update(all[peer] ?? []) }));

  useEffect(
    () =>
      watchDms(
        dms,
        me,
        (m) => put(m.from === me ? m.to : m.from, (t) => addMessage(t, m)),
        () => setReady(true),
      ),
    [me],
  );
  useEffect(() => localStorage.setItem("dmRead", JSON.stringify({ me, read })), [me, read]);
  const latest = (active && threads[active]?.at(-1)?.at) || 0;
  useEffect(() => {
    if (open && active)
      setRead((r) => (latest > (r[active] ?? 0) ? { ...r, [active]: latest } : r));
  }, [open, active, latest]);

  return {
    me,
    threads,
    tabs,
    active,
    open,
    ready,
    setOpen,
    unreadOf: (peer: string) => unread(threads[peer] ?? [], me, read[peer]),
    openChat(peer: string) {
      setTabs((t) => (t.includes(peer) ? t : [...t, peer]));
      setActive(peer);
      setOpen(true);
    },
    closeTab(peer: string) {
      const next = tabs.filter((p) => p !== peer);
      setTabs(next);
      if (active === peer) setActive(next[Math.max(0, tabs.indexOf(peer) - 1)]);
    },
    async send(peer: string, text: string, retry?: string) {
      const id = retry ?? crypto.randomUUID();
      const at = Math.floor(Date.now() / 1000);
      put(peer, (t) => [
        ...t.filter((m) => m.id !== id),
        { id, from: me, to: peer, text, at, state: "sending" },
      ]);
      try {
        const sent = await sendDm(dms, me, peer, text);
        put(peer, (t) =>
          addMessage(
            t.filter((m) => m.id !== id),
            sent,
          ),
        );
      } catch {
        put(peer, (t) => t.map((m) => (m.id === id ? { ...m, state: "failed" } : m)));
      }
    },
  };
}

const ChatContext = createContext<ReturnType<typeof useChatState> | undefined>(undefined);
export const useChat = () => useContext(ChatContext);

export function ChatProvider({ me, children }: { me: string; children: ReactNode }) {
  return <ChatContext value={useChatState(me)}>{children}</ChatContext>;
}

export const UnreadBadge = ({ count }: { count: number }) =>
  count > 0 && (
    <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground tabular-nums">
      {count > 99 ? "99+" : count}
    </span>
  );

function useFriend(pubkey: string): Friend {
  return Launcher.useSelector(
    (s) => s.context.friends?.find((f) => f.pubkey === pubkey) ?? { pubkey },
  );
}

const time = (at: number) =>
  new Date(at * 1000).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

function dayLabel(at: number) {
  const day = new Date(at * 1000);
  const days = Math.round(
    (new Date().setHours(0, 0, 0, 0) - new Date(day).setHours(0, 0, 0, 0)) / 864e5,
  );
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return day.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function Tab({ peer }: { peer: string }) {
  const chat = useChat()!;
  const friend = useFriend(peer);
  const selected = chat.active === peer && chat.open;
  const unreadCount = chat.unreadOf(peer);
  return (
    <div
      className={`group/tab relative flex max-w-44 min-w-0 flex-1 items-center border-r border-white/[0.06] ${selected ? "bg-popover" : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground"}`}
    >
      <button
        role="tab"
        aria-selected={selected}
        onClick={() => chat.openChat(peer)}
        className="flex h-full min-w-0 flex-1 items-center gap-2 pr-1 pl-3 text-left text-[12px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset"
      >
        <Avatar friend={friend} className="size-5 text-[9px]" />
        <span className="truncate">{friendName(friend)}</span>
        {unreadCount > 0 && !selected && (
          <span
            aria-label={`${unreadCount} unread`}
            className="size-1.5 shrink-0 rounded-full bg-primary"
          />
        )}
      </button>
      <button
        aria-label={`Close chat with ${friendName(friend)}`}
        onClick={() => chat.closeTab(peer)}
        className="mr-1.5 grid size-5 shrink-0 place-items-center rounded text-muted-foreground opacity-0 group-hover/tab:opacity-100 hover:bg-white/[0.08] hover:text-foreground focus-visible:opacity-100"
      >
        <XIcon className="size-3" />
      </button>
      {selected && <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" />}
    </div>
  );
}

function Presence({ friend }: { friend: Friend }) {
  const context = Launcher.useSelector((s) => s.context);
  const status = playing(context).find((p) => p.friend.pubkey === friend.pubkey)?.status;
  const game = status?.coordinate && findGame(context, status.coordinate);
  if (!status) return <span className="text-[12px] text-muted-foreground">Not playing</span>;
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-ingame">
      {game && <GameIcon game={game} className="size-4 rounded-[4px] text-[9px]" />}
      <span className="truncate">{game ? `Playing ${game.name}` : status.content}</span>
    </span>
  );
}

function Notice() {
  const [hidden, setHidden] = useState(() => !!localStorage.getItem("dmNoticeHidden"));
  if (hidden) return null;
  return (
    <p className="flex items-center gap-2 border-b border-white/[0.06] py-1.5 pr-2 pl-4 text-[11px] text-muted-foreground">
      <span className="flex-1">Regular Nostr DMs: any app with your key can read them.</span>
      <button
        aria-label="Dismiss"
        onClick={() => {
          localStorage.setItem("dmNoticeHidden", "1");
          setHidden(true);
        }}
        className="grid size-5 place-items-center rounded hover:bg-white/[0.06] hover:text-foreground"
      >
        <XIcon className="size-3" />
      </button>
    </p>
  );
}

function Skeleton() {
  return (
    <div aria-label="Loading messages" className="grid gap-5 px-4 py-4">
      {["w-40", "w-56", "w-32"].map((width) => (
        <div key={width} className="flex animate-pulse gap-3 motion-reduce:animate-none">
          <span className="size-8 shrink-0 rounded-full bg-white/[0.05]" />
          <span className="grid flex-1 content-start gap-2 pt-1">
            <span className="h-2.5 w-20 rounded bg-white/[0.06]" />
            <span className={`h-2.5 rounded bg-white/[0.04] ${width}`} />
          </span>
        </div>
      ))}
    </div>
  );
}

function Conversation({ peer, hidden }: { peer: string; hidden: boolean }) {
  const chat = useChat()!;
  const friend = useFriend(peer);
  const me = Launcher.useSelector((s) => s.context.profile) ?? { pubkey: chat.me };
  const thread = chat.threads[peer] ?? [];
  const [text, setText] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = input.current!;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);
  useEffect(() => {
    if (!hidden) input.current?.focus();
  }, [hidden]);
  const submit = () => {
    if (!text.trim()) return;
    void chat.send(peer, text.trim());
    setText("");
  };
  return (
    <div role="tabpanel" hidden={hidden} className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
        <Avatar friend={friend} className="size-9" />
        <span className="grid min-w-0 gap-0.5 leading-tight">
          <span className="truncate text-[14px] font-semibold">{friendName(friend)}</span>
          <Presence friend={friend} />
        </span>
      </header>
      <Notice />
      <div
        role="log"
        aria-live="polite"
        className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto"
      >
        <div className="pb-3">
          {!thread.length &&
            (chat.ready ? (
              <div className="grid justify-items-center gap-2 px-6 pt-14 pb-6 text-center">
                <Avatar friend={friend} className="size-14 text-lg" />
                <p className="mt-1 text-[13px] font-medium">{friendName(friend)}</p>
                <p className="text-[12px] text-muted-foreground">No messages yet. Say hi.</p>
              </div>
            ) : (
              <Skeleton />
            ))}
          {groupThread(thread).map((group) => {
            const mine = group.from === chat.me;
            const [first] = group.messages;
            return (
              <div key={first!.id}>
                {group.newDay && (
                  <div className="flex items-center gap-3 px-4 pt-4 pb-1 text-[11px] font-medium text-muted-foreground">
                    <span className="h-px flex-1 bg-white/[0.06]" />
                    {dayLabel(first!.at)}
                    <span className="h-px flex-1 bg-white/[0.06]" />
                  </div>
                )}
                <div className="flex gap-3 px-4 pt-3">
                  <Avatar friend={mine ? me : friend} className="mt-0.5 size-8" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-2 leading-snug">
                      <span className={`text-[13px] font-semibold ${mine ? "text-primary" : ""}`}>
                        {mine ? (me.name ?? "You") : friendName(friend)}
                      </span>
                      <time className="text-[11px] text-muted-foreground">{time(first!.at)}</time>
                    </p>
                    {group.messages.map((m, i) => (
                      <div key={m.id} className="group/line relative pr-12">
                        <p
                          className={`text-[13px] leading-relaxed break-words whitespace-pre-wrap text-foreground/90 ${m.state === "sending" ? "opacity-50" : ""}`}
                        >
                          {m.text}
                        </p>
                        {m.state === "failed" && (
                          <p className="text-[11px] text-destructive">
                            Not sent ·{" "}
                            <button
                              onClick={() => void chat.send(peer, m.text, m.id)}
                              className="font-medium underline-offset-2 hover:underline"
                            >
                              Retry
                            </button>
                          </p>
                        )}
                        {i > 0 && (
                          <time className="absolute top-0.5 right-0 text-[10px] text-muted-foreground opacity-0 group-hover/line:opacity-100">
                            {time(m.at)}
                          </time>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-end gap-2 border-t border-white/[0.06] p-3"
      >
        <textarea
          ref={input}
          rows={1}
          value={text}
          placeholder={`Message ${friendName(friend)}`}
          aria-label={`Message ${friendName(friend)}`}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          className="max-h-32 flex-1 resize-none rounded-lg border border-input bg-background/60 px-3 py-2 text-[13px] leading-5 outline-none placeholder:text-muted-foreground focus-visible:border-white/20"
        />
        <Button type="submit" size="icon" aria-label="Send" disabled={!text.trim()}>
          <PaperPlaneRightIcon weight="fill" />
        </Button>
      </form>
    </div>
  );
}

export function ChatPanel() {
  const chat = useChat();
  if (!chat?.tabs.length) return null;
  const Toggle = chat.open ? CaretDownIcon : CaretUpIcon;
  return (
    <section
      aria-label="Chat"
      onKeyDown={(e) => e.key === "Escape" && chat.setOpen(false)}
      className={`absolute right-4 bottom-4 z-10 flex animate-in fade-in slide-in-from-bottom-2 duration-200 motion-reduce:animate-none w-[min(400px,calc(100%-2rem))] flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-popover shadow-2xl shadow-black/50 ${chat.open ? "h-[min(560px,calc(100%-2rem))]" : ""}`}
    >
      <div className="flex h-10 shrink-0 items-stretch bg-sidebar">
        <div role="tablist" aria-label="Conversations" className="flex min-w-0 flex-1">
          {chat.tabs.map((peer) => (
            <Tab key={peer} peer={peer} />
          ))}
        </div>
        <button
          aria-label={chat.open ? "Minimize chat" : "Expand chat"}
          onClick={() => chat.setOpen(!chat.open)}
          className="grid w-9 shrink-0 place-items-center text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
        >
          <Toggle className="size-3.5" />
        </button>
      </div>
      {chat.tabs.map((peer) => (
        <Conversation key={peer} peer={peer} hidden={!chat.open || peer !== chat.active} />
      ))}
    </section>
  );
}
