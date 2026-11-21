import { Button } from "@keyhall/ui/components/button";
import { cn } from "@keyhall/ui/lib/utils";
import { CaretDownIcon, GridFourIcon, MagnifyingGlassIcon, RowsIcon } from "@phosphor-icons/react";
import { friendsIn, RUNNING, SOURCES, source, type Game } from "../data.ts";
import { Avatar, Cover, Live } from "../kit.tsx";
import { RequestBanner } from "./Running.tsx";
import { byRecency, groups, useWin, viewTitle, visibleGames } from "./state.tsx";

export const lastPlayed = (g: Game, running: Game | null) =>
  g.lastPlayed === "Now" && running?.id !== g.id ? "Today" : g.lastPlayed;

const hours = (m?: number) =>
  !m ? "" : m < 60 ? `${m} m` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} m`;

function Faces({ game }: { game: Game }) {
  const here = friendsIn(game.id);
  if (!here.length) return null;
  return (
    <span className="flex -space-x-1.5">
      {here.map((f) => (
        <Avatar
          key={f.handle}
          person={f}
          size="xs"
          className="rounded-full ring-2 ring-[var(--ring-bg)]"
        />
      ))}
    </span>
  );
}

function Status({ game }: { game: Game }) {
  const { running } = useWin();
  if (game.id === running?.id)
    return (
      <span className="flex items-center gap-1.5 text-[12px] text-online tabular-nums">
        <Live className="size-1.5" /> {RUNNING.session}
      </span>
    );
  const here = friendsIn(game.id);
  if (here.length) return <Faces game={game} />;
  return (
    <span className="text-[12px] text-muted-foreground">{lastPlayed(game, running) ?? "New"}</span>
  );
}

function useSelect(game: Game) {
  const { layout, set } = useWin();
  const selected = layout.selected === game.id;
  return {
    selected,
    props: {
      role: "button",
      tabIndex: 0,
      "aria-pressed": selected,
      "data-game": game.id,
      onClick: () => set({ selected: selected ? null : game.id }),
      onKeyDown: (e: React.KeyboardEvent) => e.key === "Enter" && set({ selected: game.id }),
    },
  };
}

function ListRow({ game }: { game: Game }) {
  const { compact, running } = useWin();
  const { selected, props } = useSelect(game);
  const here = friendsIn(game.id);
  return (
    <div
      {...props}
      className={cn(
        "group/row grid cursor-default items-center gap-3 rounded-lg px-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
        "grid-cols-[auto_minmax(0,1fr)_auto] @min-[720px]:grid-cols-[auto_minmax(0,1.5fr)_minmax(0,1fr)_72px_88px_96px]",
        compact ? "py-1" : "py-1.5",
        selected
          ? "bg-primary/[0.12] ring-1 ring-primary/30 [--ring-bg:#2a2719]"
          : "hover:bg-white/[0.035]",
      )}
    >
      <Cover
        game={game}
        className={cn(
          "shrink-0 rounded-md ring-1 ring-white/[0.06]",
          compact ? "h-8 w-[52px]" : "h-[42px] w-[68px]",
        )}
      />
      <div className="min-w-0 leading-snug">
        <div className="truncate text-[13px] font-medium">{game.name}</div>
        <div className="truncate text-[12px] text-muted-foreground">
          {game.genre}
          <span className="@min-[720px]:hidden"> · {source(game.source).name}</span>
        </div>
      </div>
      <div className="@min-[720px]:hidden">
        <Status game={game} />
      </div>
      <div className="hidden truncate text-[12px] text-muted-foreground @min-[720px]:block">
        {source(game.source).name}
      </div>
      <div className="hidden @min-[720px]:block">{here.length > 0 && <Faces game={game} />}</div>
      <div className="hidden text-right text-[12px] text-muted-foreground tabular-nums @min-[720px]:block">
        {hours(game.minutes)}
      </div>
      <div className="hidden justify-end pr-1 text-[12px] text-muted-foreground @min-[720px]:flex">
        {game.id === running?.id ? <Status game={game} /> : (lastPlayed(game, running) ?? "New")}
      </div>
    </div>
  );
}

function List() {
  const { view, on, running, compact } = useWin();
  return (
    <div className={cn("pb-6", compact ? "px-3" : "px-4")}>
      <div className="sticky top-0 z-10 hidden h-8 grid-cols-[auto_minmax(0,1.5fr)_minmax(0,1fr)_72px_88px_96px] items-center gap-3 bg-background px-2 text-[11px] font-medium text-muted-foreground @min-[720px]:grid">
        <span className={compact ? "w-[52px]" : "w-[68px]"} />
        <span>Game</span>
        <span>Source</span>
        <span>Friends</span>
        <span className="text-right">This month</span>
        <span className="pr-1 text-right">Last played</span>
      </div>
      {groups(visibleGames(view, on), running).map((g) => (
        <section key={g.title} className={compact ? "mt-2" : "mt-3"}>
          <h3 className="flex h-7 items-center gap-2 px-2 text-[12px] font-medium text-muted-foreground">
            {g.title}
            <span className="font-normal text-muted-foreground/70 tabular-nums">
              {g.games.length}
            </span>
          </h3>
          <div className="grid gap-px">
            {g.games.map((game) => (
              <ListRow key={game.id} game={game} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Tile({ game }: { game: Game }) {
  const { running } = useWin();
  const { selected, props } = useSelect(game);
  return (
    <div {...props} className="group/tile flex min-w-0 cursor-default flex-col gap-2 outline-none">
      <span
        className={cn(
          "relative block overflow-hidden rounded-lg ring-1 transition-shadow",
          selected
            ? "ring-2 ring-primary"
            : "ring-white/[0.07] group-hover/tile:ring-white/25 group-focus-visible/tile:ring-2 group-focus-visible/tile:ring-ring",
        )}
      >
        <Cover
          game={game}
          className="aspect-[16/10] w-full transition-transform duration-300 ease-out group-hover/tile:scale-[1.025] motion-reduce:transition-none"
        />
        {game.id === running?.id && (
          <span className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white tabular-nums">
            <Live className="size-1.5" /> {RUNNING.session}
          </span>
        )}
      </span>
      <span className="flex items-start justify-between gap-2 px-0.5">
        <span className="min-w-0 leading-snug">
          <span
            className={cn("block truncate text-[13px] font-medium", selected && "text-primary")}
          >
            {game.name}
          </span>
          <span className="block truncate text-[12px] text-muted-foreground">{game.genre}</span>
        </span>
        <span className="pt-0.5">
          <Faces game={game} />
        </span>
      </span>
    </div>
  );
}

function Grid() {
  const { view, on, compact, running } = useWin();
  const games = visibleGames(view, on).sort(
    (a, b) => Number(b.id === running?.id) - Number(a.id === running?.id) || byRecency(a, b),
  );
  return (
    <div
      className={cn(
        "grid content-start",
        compact
          ? "grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-4 gap-y-4 px-5 pt-4 pb-6"
          : "grid-cols-[repeat(auto-fill,minmax(184px,1fr))] gap-x-5 gap-y-6 px-6 pt-5 pb-8 @max-[480px]:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] @max-[480px]:gap-x-4",
      )}
    >
      {games.map((g) => (
        <Tile key={g.id} game={g} />
      ))}
    </div>
  );
}

export function Library({ banner }: { banner: boolean }) {
  const { layout, set, view, on, compact } = useWin();
  const count = visibleGames(view, on).length;
  const sourcesOn = SOURCES.filter((s) => on[s.id]).length;
  return (
    <main className="@container flex h-full min-h-0 min-w-0 flex-col bg-background [--ring-bg:var(--background)]">
      <header
        className={cn(
          "flex h-[52px] shrink-0 items-center gap-3 border-b border-white/[0.06]",
          compact ? "px-5" : "px-6",
        )}
      >
        <h1 className="truncate text-[15px] font-semibold tracking-[-0.01em]">{viewTitle(view)}</h1>
        <span className="text-muted-foreground tabular-nums">{count}</span>
        {view === "all" && (
          <span className="hidden truncate text-[12px] text-muted-foreground @min-[560px]:inline">
            from {sourcesOn} of {SOURCES.length} sources
          </span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <div className="hidden h-8 w-56 items-center gap-2 rounded-md bg-white/[0.05] px-2.5 text-muted-foreground ring-1 ring-white/[0.04] @min-[640px]:flex">
            <MagnifyingGlassIcon className="size-4" />
            <span className="flex-1 text-[13px]">Search</span>
            <kbd className="font-sans text-[11px]">⌘K</kbd>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Search"
            className="text-muted-foreground @min-[640px]:hidden"
          >
            <MagnifyingGlassIcon />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="hidden text-muted-foreground @min-[420px]:inline-flex"
          >
            Last played <CaretDownIcon data-icon="inline-end" />
          </Button>
          <div className="flex rounded-md bg-white/[0.05] p-0.5">
            {(
              [
                ["grid", GridFourIcon, "Cover grid"],
                ["list", RowsIcon, "Grouped list"],
              ] as const
            ).map(([v, Icon, label]) => (
              <button
                key={v}
                aria-label={label}
                aria-pressed={layout.main === v}
                onClick={() => set({ main: v })}
                className={cn(
                  "grid size-7 place-items-center rounded transition-colors",
                  layout.main === v
                    ? "bg-white/[0.09] text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
              </button>
            ))}
          </div>
        </div>
      </header>
      {banner && <RequestBanner />}
      <div data-scroll className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        {layout.main === "list" ? <List /> : <Grid />}
      </div>
    </main>
  );
}
