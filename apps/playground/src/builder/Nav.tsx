import { cn } from "@keyhall/ui/lib/utils";
import {
  CoinsIcon,
  GearSixIcon,
  KeyIcon,
  SquaresFourIcon,
  UsersThreeIcon,
  type Icon,
} from "@phosphor-icons/react";
import { BUDGET, FRIENDS, game, ME } from "../data.ts";
import { Avatar, Cover, Live, TrafficLights } from "../kit.tsx";
import type { Nav as NavStyle, PageId } from "./config.ts";
import { RunningCard } from "./Running.tsx";
import { useWin, visibleGames } from "./state.tsx";

const playing = FRIENDS.filter((f) => f.status === "ingame");
const online = FRIENDS.filter((f) => f.status === "online");

export const NAV_W: Record<NavStyle, number> = { labels: 84, hover: 72, sidebar: 200, icons: 72 };

const DESTINATIONS: { id: PageId; icon: Icon; label: string }[] = [
  { id: "library", icon: SquaresFourIcon, label: "Library" },
  { id: "friends", icon: UsersThreeIcon, label: "Friends" },
  { id: "budget", icon: CoinsIcon, label: "Budget" },
  { id: "settings", icon: GearSixIcon, label: "Settings" },
];

function useGo() {
  const { layout, set } = useWin();
  return (page: PageId) =>
    set(page === "library" && layout.detail === "page" ? { page, selected: null } : { page });
}

function Item({
  style,
  d,
  end,
}: {
  style: NavStyle;
  d: (typeof DESTINATIONS)[number];
  end?: string;
}) {
  const { layout, compact } = useWin();
  const go = useGo();
  const active = layout.page === d.id;
  const common = {
    "aria-current": active ? ("page" as const) : undefined,
    "data-nav": d.id,
    onClick: () => go(d.id),
  };
  const ring = "outline-none focus-visible:ring-2 focus-visible:ring-ring/60";
  if (style === "labels")
    return (
      <button
        {...common}
        className={cn(
          "group/item grid w-[68px] justify-items-center gap-1 py-1",
          ring,
          "rounded-lg",
        )}
      >
        <span
          className={cn(
            "grid h-8 w-12 place-items-center rounded-full transition-colors",
            active
              ? "bg-primary/[0.16] text-primary"
              : "text-muted-foreground group-hover/item:bg-white/[0.06] group-hover/item:text-foreground",
          )}
        >
          <d.icon weight={active ? "fill" : "regular"} className="size-5" />
        </span>
        <span
          className={cn(
            "text-[11px] leading-none",
            active ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          {d.label}
        </span>
      </button>
    );
  if (style === "icons")
    return (
      <button
        {...common}
        title={d.label}
        aria-label={d.label}
        className={cn(
          "grid size-10 place-items-center rounded-lg transition-colors",
          ring,
          active
            ? "bg-white/[0.08] text-foreground"
            : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground",
        )}
      >
        <d.icon className="size-5" />
      </button>
    );
  return (
    <button
      {...common}
      className={cn(
        "flex shrink-0 items-center rounded-lg text-[13px] transition-colors",
        ring,
        style === "hover" ? "h-10 w-full" : cn("w-full gap-2.5 px-2", compact ? "h-8" : "h-9"),
        active
          ? "bg-white/[0.075] font-medium text-foreground"
          : "text-foreground/80 hover:bg-white/[0.04] hover:text-foreground",
      )}
    >
      <span className={cn("grid shrink-0 place-items-center", style === "hover" ? "w-10" : "w-5")}>
        <d.icon
          weight={active ? "fill" : "regular"}
          className={cn("size-[18px]", active ? "text-primary" : "text-muted-foreground")}
        />
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-left",
          style === "hover" &&
            "pl-1.5 opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100",
        )}
      >
        {d.label}
      </span>
      {end && (
        <span
          className={cn(
            "shrink-0 pr-1 text-[12px] font-normal text-muted-foreground tabular-nums",
            style === "hover" &&
              "pr-2 opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100",
          )}
        >
          {end}
        </span>
      )}
    </button>
  );
}

function ends() {
  return {
    library: undefined as string | undefined,
    friends: `${playing.length} playing`,
    budget: BUDGET.paysOn,
    settings: undefined,
  };
}

function Faces() {
  return (
    <div className="grid justify-items-center gap-2">
      {[...playing, ...online].map((f) => (
        <span
          key={f.handle}
          title={f.game ? `${f.name} · ${game(f.game).name}` : `${f.name} · online`}
        >
          <Avatar person={f} dot />
        </span>
      ))}
    </div>
  );
}

function FriendRows({ hover }: { hover?: boolean }) {
  const { compact, open } = useWin();
  const fade = hover
    ? "opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100"
    : "";
  return (
    <div className="grid gap-px">
      <div
        className={cn(
          "flex h-7 items-center px-2 text-[12px] font-medium text-muted-foreground",
          fade,
          hover && "pl-3",
        )}
      >
        Playing now
      </div>
      {playing.map((f) => (
        <button
          key={f.handle}
          onClick={() => open(f.game!)}
          className={cn(
            "flex items-center gap-2.5 rounded-lg text-left outline-none hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-ring/60",
            hover ? "h-11 pl-2" : cn("px-2", compact ? "h-9" : "h-10"),
          )}
        >
          <Avatar person={f} size={hover ? "md" : "sm"} dot />
          <span className={cn("min-w-0 flex-1 leading-tight", fade)}>
            <span className="block truncate text-[13px]">{f.name}</span>
            <span className="block truncate text-[11px] text-ingame">{game(f.game!).name}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** The running game on a rail: its cover, with the request key when it asks to sign. */
function RailRunning({ labelled }: { labelled?: boolean }) {
  const { running, layout } = useWin();
  if (!running) return null;
  return (
    <span
      data-testid={layout.signing ? "request-badge" : undefined}
      title={layout.signing ? `${running.name} asks to sign` : `${running.name} is running`}
      className="grid justify-items-center gap-1"
    >
      <span className="relative">
        <Cover
          game={running}
          className={cn(
            "size-10 rounded-lg ring-1",
            layout.signing ? "ring-2 ring-primary" : "ring-white/15",
          )}
        />
        <span className="absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full bg-sidebar">
          {layout.signing ? (
            <KeyIcon weight="fill" className="size-3 text-primary" />
          ) : (
            <Live className="size-2" />
          )}
        </span>
      </span>
      {labelled && (
        <span
          className={cn(
            "text-[11px] leading-none whitespace-nowrap tabular-nums",
            layout.signing ? "font-medium text-primary" : "text-muted-foreground",
          )}
        >
          {layout.signing ? "Asks to sign" : "23 min"}
        </span>
      )}
    </span>
  );
}

function Rule() {
  return <span className="my-3 h-px w-8 shrink-0 self-center bg-white/[0.08]" />;
}

function Rail({ labelled }: { labelled: boolean }) {
  const { layout } = useWin();
  const e = ends();
  return (
    <div className="flex h-full flex-col items-center">
      <div className="flex h-[52px] shrink-0 items-center">
        <TrafficLights className="gap-[7px] [&>span]:size-[11px]" />
      </div>
      <nav className={cn("mt-1 grid", labelled ? "gap-2" : "gap-1")}>
        {DESTINATIONS.map((d) => (
          <Item key={d.id} style={labelled ? "labels" : "icons"} d={d} end={e[d.id]} />
        ))}
      </nav>
      {layout.friends === "nav" && (
        <>
          <Rule />
          <Faces />
        </>
      )}
      <div className="mt-auto grid shrink-0 justify-items-center gap-3 pt-4 pb-3.5">
        {layout.running === "nav" && <RailRunning labelled={labelled} />}
        <Avatar person={ME} size="sm" />
      </div>
    </div>
  );
}

function HoverRail() {
  const { layout, running } = useWin();
  const e = ends();
  const fade =
    "opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100";
  return (
    <div
      data-hover-rail
      className="group/rail absolute inset-y-0 left-0 z-30 flex w-[72px] flex-col overflow-hidden border-r border-white/[0.06] bg-sidebar px-4 transition-[width,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:w-[232px] hover:shadow-[16px_0_40px_-12px_rgba(0,0,0,0.65)] focus-within:w-[232px] motion-reduce:transition-none"
    >
      <div className="flex h-[52px] shrink-0 items-center pl-[3px]">
        <TrafficLights className="gap-[7px] [&>span]:size-[11px]" />
      </div>
      <nav className="mt-1 grid gap-1">
        {DESTINATIONS.map((d) => (
          <Item key={d.id} style="hover" d={d} end={e[d.id]} />
        ))}
      </nav>
      {layout.friends === "nav" && (
        <div className="mt-4 -mx-2">
          <FriendRows hover />
        </div>
      )}
      <div className="mt-auto grid shrink-0 gap-3 pt-4 pb-3.5">
        {layout.running === "nav" && running && (
          <div className="relative min-h-10">
            <div className="absolute bottom-0 left-0 transition-opacity duration-150 group-hover/rail:opacity-0 group-focus-within/rail:opacity-0">
              <RailRunning />
            </div>
            <div className={cn("w-[200px]", fade)}>
              <RunningCard />
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 pl-2">
          <Avatar person={ME} size="sm" />
          <span className={cn("min-w-0 flex-1 leading-tight", fade)}>
            <span className="block truncate text-[13px] font-medium">{ME.name}</span>
            <span className="block truncate font-mono text-[11px] text-muted-foreground">
              {ME.npub}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function SlimSidebar() {
  const { layout, running, filters } = useWin();
  const e = { ...ends(), library: String(visibleGames(filters, running).length) };
  return (
    <div className="flex h-full flex-col px-2.5">
      <div className="flex h-[52px] shrink-0 items-center px-2">
        <TrafficLights />
      </div>
      <nav className="mt-1 grid gap-px">
        {DESTINATIONS.map((d) => (
          <Item key={d.id} style="sidebar" d={d} end={e[d.id]} />
        ))}
      </nav>
      {layout.friends === "nav" && (
        <div className="mt-6">
          <FriendRows />
        </div>
      )}
      <div className="mt-auto grid shrink-0 gap-2 pt-4 pb-2.5">
        {layout.running === "nav" && running && <RunningCard />}
        <div className="flex items-center gap-2.5 px-2 py-2">
          <Avatar person={ME} size="sm" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-[13px] font-medium">{ME.name}</div>
            <div className="truncate font-mono text-[11px] text-muted-foreground">{ME.npub}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Nav() {
  const { layout } = useWin();
  return (
    <aside
      className={cn(
        "relative h-full min-h-0 bg-sidebar [--ring-bg:var(--sidebar)]",
        layout.nav !== "hover" && "border-r border-white/[0.06]",
      )}
    >
      {layout.nav === "labels" && <Rail labelled />}
      {layout.nav === "icons" && <Rail labelled={false} />}
      {layout.nav === "hover" && <HoverRail />}
      {layout.nav === "sidebar" && <SlimSidebar />}
    </aside>
  );
}
