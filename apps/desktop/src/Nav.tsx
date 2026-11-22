import { pubkeyOf, running } from "@keyhall/core/launcher";
import type { Game } from "@keyhall/core/listing";
import type { Friend } from "@keyhall/core/presence";
import { Button } from "@keyhall/ui/components/button";
import { cn } from "@keyhall/ui/lib/utils";
import {
  AppWindowIcon,
  CoinsIcon,
  GearSixIcon,
  KeyholeIcon,
  SquaresFourIcon,
  StopIcon,
  type Icon,
} from "@phosphor-icons/react";
import { minutes, Launcher, useNow } from "./launcher.ts";
import { Avatar } from "./Friends.tsx";
import { Cover, GameIcon, Live } from "./Library.tsx";

const fade =
  "opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-has-[:focus-visible]/rail:opacity-100";

function Item({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: Icon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "flex h-10 w-full shrink-0 items-center rounded-lg text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        active
          ? "bg-white/[0.075] font-medium"
          : "text-foreground/80 hover:bg-white/[0.04] hover:text-foreground",
      )}
    >
      <span className="grid w-10 shrink-0 place-items-center">
        <Icon
          weight={active ? "fill" : "regular"}
          className={cn("size-[18px]", active ? "text-primary" : "text-muted-foreground")}
        />
      </span>
      <span className={cn("min-w-0 flex-1 truncate pl-1.5 text-left", fade)}>{label}</span>
    </button>
  );
}

function RunningCard({ game, since }: { game: Game; since: number | undefined }) {
  const now = useNow();
  const { send } = Launcher.useActorRef();
  return (
    <div className="relative min-h-10">
      <button
        title={`${game.name} is running`}
        onClick={() => send({ type: "select", game })}
        className="absolute bottom-0 left-0 grid justify-items-center gap-1 transition-opacity duration-150 group-hover/rail:opacity-0 group-has-[:focus-visible]/rail:opacity-0"
      >
        <span className="relative">
          <GameIcon game={game} className="size-10 rounded-lg ring-1 ring-white/15" />
          <span className="absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full bg-sidebar">
            <Live />
          </span>
        </span>
        {since && (
          <span className="text-[11px] leading-none text-muted-foreground tabular-nums">
            {minutes(now - since)}
          </span>
        )}
      </button>
      <div
        className={cn(
          "w-[200px] overflow-hidden rounded-xl bg-white/[0.035] ring-1 ring-white/[0.07]",
          fade,
        )}
      >
        <button className="relative block w-full" onClick={() => send({ type: "select", game })}>
          <Cover game={game} className="h-[76px] w-full text-2xl" />
          <span className="absolute inset-0 bg-gradient-to-t from-sidebar via-sidebar/40 to-transparent" />
          <span className="absolute inset-x-3 bottom-1.5 flex items-center justify-between gap-2">
            <span className="truncate text-[13px] font-semibold">{game.name}</span>
            {since && (
              <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-foreground/80 tabular-nums">
                <Live /> {minutes(now - since)}
              </span>
            )}
          </span>
        </button>
        <div className="grid grid-cols-2 gap-1.5 p-2">
          <Button size="xs" variant="secondary" onClick={() => send({ type: "play", game })}>
            <AppWindowIcon data-icon="inline-start" />
            Show
          </Button>
          <Button size="xs" variant="secondary" onClick={() => send({ type: "quit", game })}>
            <StopIcon weight="fill" data-icon="inline-start" />
            Quit
          </Button>
        </div>
      </div>
    </div>
  );
}

function Identity({ npub, me }: { npub: string; me: Friend }) {
  const short = `${npub.slice(0, 12)}…${npub.slice(-4)}`;
  return (
    <div title={npub} className="flex h-10 items-center">
      <span className="grid w-10 shrink-0 place-items-center">
        <Avatar
          friend={me}
          className="size-8"
          fallback={<KeyholeIcon weight="fill" className="size-[18px] text-primary" />}
        />
      </span>
      <span className={cn("grid min-w-0 flex-1 pl-1.5 leading-tight", fade)}>
        <span
          className={cn("truncate", me.name ? "text-[13px] font-medium" : "font-mono text-[11px]")}
        >
          {me.name ?? short}
        </span>
        {me.name && (
          <span className="truncate font-mono text-[11px] text-muted-foreground">{short}</span>
        )}
      </span>
    </div>
  );
}

export function Nav() {
  const context = Launcher.useSelector((s) => s.context);
  const { send } = Launcher.useActorRef();
  const { view, npub, profile } = context;
  return (
    <aside className="relative z-30 h-full">
      <div className="group/rail absolute inset-y-0 left-0 flex w-[72px] flex-col overflow-clip border-r border-white/[0.06] bg-sidebar px-4 transition-[width,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] has-[:focus-visible]:w-[232px] hover:w-[232px] hover:shadow-[16px_0_40px_-12px_rgba(0,0,0,0.65)] motion-reduce:transition-none">
        <nav className="mt-1.5 grid grid-cols-1 gap-1">
          <Item
            icon={SquaresFourIcon}
            label="Library"
            active={!view}
            onClick={() => send({ type: "select" })}
          />
          <Item
            icon={CoinsIcon}
            label="Monthly budget"
            active={view === "budget"}
            onClick={() => send({ type: "view", view: "budget" })}
          />
          <Item
            icon={GearSixIcon}
            label="Settings"
            active={view === "settings"}
            onClick={() => send({ type: "view", view: "settings" })}
          />
        </nav>
        <div className="mt-auto grid shrink-0 grid-cols-1 gap-3 pt-4 pb-3.5">
          {running(context).map(({ game, since }) => (
            <RunningCard key={game.coordinate} game={game} since={since} />
          ))}
          {npub && <Identity npub={npub} me={profile ?? { pubkey: pubkeyOf(context)! }} />}
        </div>
      </div>
    </aside>
  );
}
