import { exampleToast, type panels, type Toast } from "@keyhall/core/launcher";
import { nudge, place, type Point } from "@keyhall/core/overlay";
import { friendName } from "@keyhall/core/presence";
import { combo } from "@keyhall/core/shim";
import { Button } from "@keyhall/ui/components/button";
import { ChatCircleIcon, XIcon } from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Avatar } from "./Friends.tsx";
import { Launcher, minutes, useNow } from "./launcher.ts";
import { Notice } from "./Notice.tsx";

export interface Item {
  kind: string;
  id: string;
  props: unknown;
}

export const card = "rounded-2xl bg-background shadow-2xl ring-1 ring-foreground/10 text-[13px]";
const close = () => void invoke("close_panel");
const positions = (): Record<string, Point> =>
  JSON.parse(localStorage.getItem("overlay.positions") ?? "{}");

/** The panels Rust sends to this window, collected in `window.panel.items` from before React loads. */
export function useItems(inbox: Item[], merge: (items: Item[], item: Item) => Item[]) {
  const read = useRef(inbox.length);
  const [items, setItems] = useState(() => inbox.reduce(merge, []));
  useEffect(() => {
    document.body.style.background = "transparent";
    const take = () => {
      const fresh = inbox.slice(read.current);
      read.current = inbox.length;
      setItems((list) => fresh.reduce(merge, list));
    };
    take();
    addEventListener("panel", take);
    return () => removeEventListener("panel", take);
  }, [inbox, merge]);
  useEffect(() => {
    if (!items.length) close();
  }, [items]);
  const remove = useCallback(
    (item: Item) => setItems((list) => list.filter((i) => i !== item)),
    [],
  );
  return [items, remove] as const;
}

const append = (items: Item[], item: Item) => [...items, item];

const replace = (items: Item[], item: Item) => [
  ...items.filter((i) => i.kind !== item.kind || i.id !== item.id),
  item,
];

/** Only Rust sends `notice` panels; anything else the launcher sends never renders as one. */
function Panel(item: Item, cascade: number, done: () => void) {
  const props: unknown = { ...(item.props as object), id: item.id, cascade, done };
  if (item.kind === "session") return <Session {...(props as ComponentProps<typeof Session>)} />;
  if (item.kind === "notice") return <Notice {...(props as ComponentProps<typeof Notice>)} />;
}

export function Overlay({ items: initial }: { items: Item[] }) {
  const [items, remove] = useItems(initial, replace);
  const [front, setFront] = useState<Item>();
  const session = items.find((i) => i.kind === "session")?.props;
  const hotkey = (session as { hotkey?: string } | undefined)?.hotkey;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || combo(e) === hotkey) close();
      if (e.key === "Tab" && e.ctrlKey) {
        e.preventDefault();
        const headers = [...document.querySelectorAll("header")];
        const at = headers.findIndex((h) => h.contains(document.activeElement));
        headers[(at + (e.shiftKey ? headers.length - 1 : 1)) % headers.length]?.focus();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [hotkey]);
  return (
    <div className="relative h-screen overflow-hidden bg-black/65">
      {items.map((item, i) => (
        <div
          key={`${item.kind}-${item.id}`}
          onFocus={() => setFront(item)}
          className={front === item ? "relative z-10" : "relative"}
        >
          {Panel(item, i, () => remove(item))}
        </div>
      ))}
    </div>
  );
}

/** One Keyhall window in the overlay, moved by its header with the pointer or the arrow keys. */
export function Window({
  kind,
  title,
  subtitle,
  cascade,
  onClose,
  children,
}: {
  kind: string;
  title: ReactNode;
  subtitle?: ReactNode;
  cascade: number;
  onClose(): void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState({ width: innerWidth, height: innerHeight });
  const [saved, setSaved] = useState<Point | undefined>(() => positions()[kind]);
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() =>
      setSize({ width: ref.current!.offsetWidth, height: ref.current!.offsetHeight }),
    );
    observer.observe(ref.current!);
    const onResize = () => setView({ width: innerWidth, height: innerHeight });
    addEventListener("resize", onResize);
    return () => {
      observer.disconnect();
      removeEventListener("resize", onResize);
    };
  }, []);
  const at = place(size, view, saved, cascade);
  const move = (to: Point) => {
    const placed = place(size, view, to);
    setSaved(placed);
    localStorage.setItem("overlay.positions", JSON.stringify({ ...positions(), [kind]: placed }));
  };
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={typeof title === "string" ? title : kind}
      style={{ left: at.x, top: at.y, visibility: size.width ? "visible" : "hidden" }}
      className={`${card} absolute grid w-[420px] gap-5 p-6`}
    >
      <header
        tabIndex={0}
        aria-label="Arrow keys move this window, Ctrl+Tab switches windows"
        className="-m-2 flex cursor-grab items-start justify-between gap-3 rounded-xl p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onKeyDown={(e) => {
          const to = e.target === e.currentTarget && nudge(at, e.key, e.shiftKey);
          if (!to) return;
          e.preventDefault();
          move(to);
        }}
        onPointerDown={(e) => {
          if ((e.target as Element).closest("button")) return;
          const [x, y] = [e.clientX - at.x, e.clientY - at.y];
          const drag = (m: PointerEvent) => move({ x: m.clientX - x, y: m.clientY - y });
          addEventListener("pointermove", drag);
          addEventListener("pointerup", () => removeEventListener("pointermove", drag), {
            once: true,
          });
        }}
      >
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </div>
        <Button size="icon-sm" variant="ghost" aria-label="Close" onClick={onClose}>
          <XIcon />
        </Button>
      </header>
      {children}
    </div>
  );
}

function Session({
  game,
  since,
  hotkey,
  friends,
  cascade,
  done,
}: ReturnType<typeof panels.session> & { cascade: number; done(): void }) {
  const now = useNow();
  return (
    <Window
      kind="session"
      title={game}
      subtitle={since ? `Playing for ${minutes(now - since)}` : "Playing"}
      cascade={cascade}
      onClose={done}
    >
      <section className="grid gap-2">
        <h2 className="text-xs font-medium text-muted-foreground uppercase">Friends playing</h2>
        {friends.length ? (
          friends.map(({ friend, status }) => (
            <div key={friend.pubkey} className="flex items-center gap-3">
              <Avatar friend={friend} />
              <span className="truncate font-medium">{friendName(friend)}</span>
              <span className="ml-auto truncate text-ingame">{status.content}</span>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">None of your friends are playing right now.</p>
        )}
      </section>
      <Button variant="secondary" disabled>
        <ChatCircleIcon /> Messages · soon
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {hotkey} or Esc goes back to the game
      </p>
    </Window>
  );
}

export function Toasts({ items: initial }: { items: Item[] }) {
  const [items, remove] = useItems(initial, append);
  return (
    <div className="flex h-screen flex-col justify-end gap-2 p-4">
      {items.slice(-3).map((item) => (
        <ToastCard key={item.id} item={item} remove={remove} />
      ))}
    </div>
  );
}

function ToastCard({ item, remove }: { item: Item; remove(item: Item): void }) {
  const { title, body, ms } = item.props as Toast;
  useEffect(() => {
    const timer = setTimeout(() => remove(item), ms);
    return () => clearTimeout(timer);
  }, [item, remove, ms]);
  return (
    <div className={`${card} grid gap-0.5 px-4 py-3`}>
      <p className="font-semibold">{title}</p>
      {body && <p className="text-muted-foreground">{body}</p>}
    </div>
  );
}

export function OverlayHotkey() {
  const hotkey = Launcher.useSelector((s) => s.context.hotkey);
  const { send } = Launcher.useActorRef();
  const [recording, setRecording] = useState(false);
  return (
    <section>
      <h2 className="text-xl font-semibold">In-game overlay</h2>
      <p className="mt-2 text-muted-foreground">
        Press this in a game window to open Keyhall over the game. Games opened after a change use
        the new key.
      </p>
      <Button
        className="mt-4"
        variant="secondary"
        onClick={() => setRecording(true)}
        onBlur={() => setRecording(false)}
        onKeyDown={(e) => {
          if (!recording || ["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
          e.preventDefault();
          setRecording(false);
          if (e.key !== "Escape") send({ type: "hotkey.set", hotkey: combo(e.nativeEvent) });
        }}
      >
        {recording ? "Press a key…" : hotkey}
      </Button>
      {import.meta.env.DEV && (
        <Button
          className="mt-4 ml-2"
          variant="ghost"
          onClick={() => send({ type: "toast", toast: exampleToast })}
        >
          Test toast
        </Button>
      )}
    </section>
  );
}
