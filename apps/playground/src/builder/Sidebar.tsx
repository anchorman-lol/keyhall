import { Button } from "@keyhall/ui/components/button";
import { Switch } from "@keyhall/ui/components/switch";
import { cn } from "@keyhall/ui/lib/utils";
import {
  ClockCounterClockwiseIcon,
  CoinsIcon,
  CompassIcon,
  EyeSlashIcon,
  GearSixIcon,
  KeyholeIcon,
  KeyIcon,
  PlusIcon,
  SquaresFourIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { FRIENDS, friend, game, gamesIn, ME, SOURCES, UNVETTED, type Source } from "../data.ts";
import { Avatar, Cover, Live, TrafficLights, sourceTint } from "../kit.tsx";
import { RunningCard } from "./Running.tsx";
import { useWin, visibleGames, type View } from "./state.tsx";

const playing = FRIENDS.filter((f) => f.status === "ingame");
const online = FRIENDS.filter((f) => f.status === "online");

function SourceMark({ s, on, size = "xs" }: { s: Source; on: boolean; size?: "xs" | "md" }) {
  if (s.by)
    return (
      <Avatar person={friend(s.by)} size={size} className={cn(!on && "opacity-40 grayscale")} />
    );
  return (
    <span
      className={cn(
        "grid place-items-center rounded-[5px]",
        size === "xs" ? "size-5" : "size-8 rounded-lg",
      )}
      style={{ background: sourceTint(s.hue, on ? 0.42 : 0.3, on ? 0.09 : 0.02) }}
    >
      <KeyholeIcon
        weight="fill"
        className={size === "xs" ? "size-3" : "size-4"}
        style={{ color: sourceTint(s.hue, on ? 0.88 : 0.6, on ? 0.12 : 0.02) }}
      />
    </span>
  );
}

function Row({
  icon,
  children,
  end,
  active,
  muted,
  onClick,
}: {
  icon: ReactNode;
  children: ReactNode;
  end?: ReactNode;
  active?: boolean;
  muted?: boolean;
  onClick?: () => void;
}) {
  const { compact } = useWin();
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className={cn(
        "group/row flex shrink-0 cursor-default items-center gap-2.5 rounded-md px-2 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
        compact ? "h-7" : "h-8",
        active
          ? "bg-white/[0.075] font-medium text-foreground"
          : "text-foreground/85 hover:bg-white/[0.04] hover:text-foreground",
        muted && !active && "text-muted-foreground",
      )}
    >
      <span className="grid w-5 shrink-0 place-items-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {end != null && (
        <span className="shrink-0 text-[12px] font-normal text-muted-foreground tabular-nums">
          {end}
        </span>
      )}
    </div>
  );
}

function Heading({ children, end }: { children: ReactNode; end?: ReactNode }) {
  const { compact } = useWin();
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-between px-2 text-[12px] font-medium text-muted-foreground",
        compact ? "mt-4 mb-1 h-6" : "mt-6 mb-1.5 h-6",
      )}
    >
      {children}
      {end}
    </div>
  );
}

function Me() {
  return (
    <div className="flex shrink-0 items-center gap-2.5 rounded-md px-2 py-2 hover:bg-white/[0.04]">
      <Avatar person={ME} size="sm" />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="text-[13px] font-medium">{ME.name}</div>
        <div className="truncate font-mono text-[11px] text-muted-foreground">{ME.npub}</div>
      </div>
      <GearSixIcon className="size-4 shrink-0 text-muted-foreground" />
    </div>
  );
}

function FriendsBlock() {
  const { compact } = useWin();
  return (
    <>
      <Heading end={<span className="font-normal">{playing.length + online.length} online</span>}>
        Friends
      </Heading>
      <div className="grid gap-px">
        {playing.map((f) => (
          <div
            key={f.handle}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2 hover:bg-white/[0.04]",
              compact ? "h-9" : "h-10",
            )}
          >
            <Avatar person={f} size="sm" dot />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[13px]">{f.name}</div>
              <div className="truncate text-[11px] text-ingame">{game(f.game!).name}</div>
            </div>
          </div>
        ))}
        <div className={cn("flex items-center gap-2.5 px-2", compact ? "h-8" : "h-9")}>
          <span className="flex shrink-0 -space-x-2">
            {online.map((f) => (
              <Avatar
                key={f.handle}
                person={f}
                size="xs"
                className="rounded-full ring-2 ring-sidebar"
              />
            ))}
          </span>
          <span className="truncate text-[12px] text-muted-foreground">
            {online.map((f) => f.name).join(" and ")} online
          </span>
        </div>
      </div>
    </>
  );
}

function Lights() {
  return (
    <div className="flex h-[52px] shrink-0 items-center px-2">
      <TrafficLights />
    </div>
  );
}

function Foot() {
  const { layout, running } = useWin();
  return (
    <div className="mt-auto grid shrink-0 gap-2 pt-4 pb-2.5">
      {layout.running === "sidebar" && running && <RunningCard />}
      <Me />
    </div>
  );
}

function SourceListSidebar() {
  const { view, setView, on, layout } = useWin();
  const nav: { v: View; icon: ReactNode; label: string }[] = [
    { v: "all", icon: <SquaresFourIcon className="size-4" />, label: "All games" },
    {
      v: "recent",
      icon: <ClockCounterClockwiseIcon className="size-4" />,
      label: "Recently played",
    },
    { v: "friends", icon: <UsersThreeIcon className="size-4" />, label: "Played by friends" },
  ];
  return (
    <>
      <Lights />
      <nav className="mt-1 grid gap-px">
        {nav.map((n) => (
          <Row
            key={n.v}
            icon={n.icon}
            active={view === n.v}
            onClick={() => setView(n.v)}
            end={visibleGames(n.v, on).length}
          >
            {n.label}
          </Row>
        ))}
      </nav>
      <Heading
        end={
          <Button size="icon-xs" variant="ghost" aria-label="Add a curator" className="-mr-1">
            <PlusIcon />
          </Button>
        }
      >
        Sources
      </Heading>
      <div className="grid gap-px">
        {SOURCES.map((s) => (
          <Row
            key={s.id}
            icon={<SourceMark s={s} on={on[s.id]} />}
            active={view === s.id}
            muted={!on[s.id]}
            onClick={() => setView(s.id)}
            end={on[s.id] ? gamesIn(s.id).length : "Off"}
          >
            {s.name}
          </Row>
        ))}
        <Row muted icon={<EyeSlashIcon className="size-4" />} end={UNVETTED}>
          Unvetted listings
        </Row>
      </div>
      {layout.friends === "sidebar" && <FriendsBlock />}
      <Foot />
    </>
  );
}

function SwitchesSidebar() {
  const { view, setView, on, toggle, layout, compact } = useWin();
  const nav: { v?: View; icon: typeof SquaresFourIcon; label: string; end?: string }[] = [
    {
      v: "all",
      icon: SquaresFourIcon,
      label: "Library",
      end: String(visibleGames("all", on).length),
    },
    { icon: CompassIcon, label: "Discover" },
    ...(layout.friends === "sidebar"
      ? []
      : [{ v: "friends" as View, icon: UsersThreeIcon, label: "Friends", end: "5 online" }]),
    { icon: CoinsIcon, label: "Budget", end: "Dec 1" },
  ];
  return (
    <>
      <Lights />
      <nav className="mt-1 grid gap-px">
        {nav.map((n) => (
          <Row
            key={n.label}
            icon={<n.icon className="size-4" />}
            active={n.v !== undefined && view === n.v}
            onClick={() => n.v && setView(n.v)}
            end={n.end}
          >
            {n.label}
          </Row>
        ))}
      </nav>
      <Heading>Sources</Heading>
      <div className="grid gap-px">
        {SOURCES.map((s) => (
          <label
            key={s.id}
            className={cn(
              "flex shrink-0 cursor-default items-center gap-2.5 rounded-md px-2 text-[13px] hover:bg-white/[0.04]",
              compact ? "h-7" : "h-8",
              !on[s.id] && "text-muted-foreground",
            )}
          >
            <span className="grid w-5 shrink-0 place-items-center">
              <SourceMark s={s} on={on[s.id]} />
            </span>
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            <Switch
              size="sm"
              checked={on[s.id]}
              onCheckedChange={() => toggle(s.id)}
              aria-label={s.name}
            />
          </label>
        ))}
        <Row muted icon={<PlusIcon className="size-3.5" />}>
          Add a curator
        </Row>
      </div>
      {layout.friends === "sidebar" && <FriendsBlock />}
      <Foot />
    </>
  );
}

function RailButton({
  children,
  label,
  active,
  onClick,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "relative grid size-10 shrink-0 place-items-center rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        active
          ? "bg-white/[0.08] text-foreground"
          : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Rail() {
  const { view, setView, on, layout, running } = useWin();
  return (
    <div className="flex h-full flex-col items-center">
      <div className="flex h-[52px] shrink-0 items-center">
        <TrafficLights className="gap-[7px] [&>span]:size-[11px]" />
      </div>
      <nav className="mt-1 grid gap-1">
        <RailButton label="All games" active={view === "all"} onClick={() => setView("all")}>
          <SquaresFourIcon className="size-5" />
        </RailButton>
        <RailButton
          label="Recently played"
          active={view === "recent"}
          onClick={() => setView("recent")}
        >
          <ClockCounterClockwiseIcon className="size-5" />
        </RailButton>
        <RailButton
          label="Played by friends"
          active={view === "friends"}
          onClick={() => setView("friends")}
        >
          <UsersThreeIcon className="size-5" />
        </RailButton>
        <RailButton label="Budget">
          <CoinsIcon className="size-5" />
        </RailButton>
      </nav>
      <span className="my-3 h-px w-8 shrink-0 bg-white/[0.08]" />
      <div className="grid gap-1">
        {SOURCES.map((s) => (
          <RailButton
            key={s.id}
            label={s.name}
            active={view === s.id}
            onClick={() => setView(s.id)}
          >
            <SourceMark s={s} on={on[s.id]} size="md" />
          </RailButton>
        ))}
        <RailButton label="Add a curator">
          <PlusIcon className="size-4" />
        </RailButton>
      </div>
      {layout.friends === "sidebar" && (
        <>
          <span className="my-3 h-px w-8 shrink-0 bg-white/[0.08]" />
          <div className="grid gap-2 [--ring-bg:var(--sidebar)]">
            {[...playing, ...online].map((f) => (
              <span
                key={f.handle}
                title={f.game ? `${f.name} · ${game(f.game).name}` : `${f.name} · online`}
              >
                <Avatar person={f} dot />
              </span>
            ))}
          </div>
        </>
      )}
      <div className="mt-auto grid shrink-0 justify-items-center gap-3 pt-4 pb-3.5">
        {layout.running === "sidebar" && running && (
          <span className="relative" title={`${running.name} is running`}>
            <Cover game={running} className="size-10 rounded-lg ring-1 ring-white/15" />
            <span className="absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full bg-sidebar">
              {layout.signing ? (
                <KeyIcon weight="fill" className="size-3 text-primary" />
              ) : (
                <Live className="size-2" />
              )}
            </span>
          </span>
        )}
        <Avatar person={ME} size="sm" />
      </div>
    </div>
  );
}

export function Sidebar() {
  const { layout } = useWin();
  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col border-r border-white/[0.06] bg-sidebar [--ring-bg:var(--sidebar)]",
        layout.sidebar !== "rail" && "px-2.5",
      )}
    >
      {layout.sidebar === "sources" && <SourceListSidebar />}
      {layout.sidebar === "switches" && <SwitchesSidebar />}
      {layout.sidebar === "rail" && <Rail />}
    </aside>
  );
}
