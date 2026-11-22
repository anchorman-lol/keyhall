import { Button } from "@keyhall/ui/components/button";
import { cn } from "@keyhall/ui/lib/utils";
import { EyeSlashIcon } from "@phosphor-icons/react";
import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { friendsIn, RUNNING, source, UNVETTED, type Game } from "../data.ts";
import { Avatar, Cover, Live } from "../kit.tsx";
import { Expanded, Sheet } from "./Detail.tsx";
import { LibraryHeader } from "./FilterBar.tsx";
import { groups, useWin, visibleGames } from "./state.tsx";

const lastPlayed = (g: Game, running: Game | null) =>
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
  if (friendsIn(game.id).length) return <Faces game={game} />;
  return (
    <span className="text-[12px] text-muted-foreground">{lastPlayed(game, running) ?? "New"}</span>
  );
}

function useSelect(game: Game) {
  const { layout, open } = useWin();
  const selected = layout.selected === game.id;
  return {
    selected,
    props: {
      role: "button",
      tabIndex: 0,
      "aria-expanded": selected,
      "data-game": game.id,
      onClick: () => open(selected ? null : game.id),
      onKeyDown: (e: React.KeyboardEvent) => e.key === "Enter" && open(game.id),
    },
  };
}

const TABLE = "@min-[720px]:grid-cols-[auto_minmax(0,1.5fr)_minmax(0,1fr)_72px_88px_96px]";

function ListRow({ game }: { game: Game }) {
  const { compact, running } = useWin();
  const { selected, props } = useSelect(game);
  return (
    <div
      {...props}
      className={cn(
        "group/row grid cursor-default grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
        TABLE,
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
      <div className="hidden @min-[720px]:block">
        <Faces game={game} />
      </div>
      <div className="hidden text-right text-[12px] text-muted-foreground tabular-nums @min-[720px]:block">
        {hours(game.minutes)}
      </div>
      <div className="hidden justify-end pr-1 text-[12px] text-muted-foreground @min-[720px]:flex">
        {game.id === running?.id ? <Status game={game} /> : (lastPlayed(game, running) ?? "New")}
      </div>
    </div>
  );
}

function List({ games }: { games: Game[] }) {
  const { layout, running, compact, filters } = useWin();
  const inPlace = layout.detail === "expand";
  return (
    <div className={cn("pb-6", compact ? "px-3" : "px-4")}>
      <div
        className={cn(
          "sticky top-0 z-10 hidden h-8 items-center gap-3 bg-background px-2 text-[11px] font-medium text-muted-foreground @min-[720px]:grid",
          TABLE,
        )}
      >
        <span className={compact ? "w-[52px]" : "w-[68px]"} />
        <span>Game</span>
        <span>Source</span>
        <span>Friends</span>
        <span className="text-right">This month</span>
        <span className="pr-1 text-right">Last played</span>
      </div>
      {groups(games, running, filters.sort).map((g) => (
        <section key={g.title} className={compact ? "mt-2" : "mt-3"}>
          <h3 className="flex h-7 items-center gap-2 px-2 text-[12px] font-medium text-muted-foreground">
            {g.title}
            <span className="font-normal text-muted-foreground/70 tabular-nums">
              {g.games.length}
            </span>
          </h3>
          <div className="grid gap-px">
            {g.games.map((game) => (
              <Fragment key={game.id}>
                <ListRow game={game} />
                {inPlace && layout.selected === game.id && (
                  <div className="pt-2 pb-3">
                    <Expanded />
                  </div>
                )}
              </Fragment>
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

/** Columns the auto-fill grid currently has, so an in-place detail can follow the clicked row. */
function useColumns() {
  const ref = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(4);
  useLayoutEffect(() => {
    const el = ref.current!;
    const measure = () =>
      setCols(getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length || 1);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);
  return { ref, cols };
}

function Grid({ games }: { games: Game[] }) {
  const { layout, compact } = useWin();
  const { ref, cols } = useColumns();
  const at = layout.detail === "expand" ? games.findIndex((g) => g.id === layout.selected) : -1;
  const after =
    at === -1 ? -1 : Math.min(games.length - 1, Math.floor(at / cols) * cols + cols - 1);
  return (
    <div
      ref={ref}
      className={cn(
        "grid content-start",
        compact
          ? "grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-4 gap-y-4 px-5 pt-4 pb-6"
          : "grid-cols-[repeat(auto-fill,minmax(184px,1fr))] gap-x-5 gap-y-6 px-6 pt-5 pb-8 @max-[480px]:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] @max-[480px]:gap-x-4",
      )}
    >
      {games.map((g, i) => (
        <Fragment key={g.id}>
          <Tile game={g} />
          {i === after && <Expanded notch={(((at % cols) + 0.5) / cols) * 100} />}
        </Fragment>
      ))}
    </div>
  );
}

function Note({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="mx-6 mb-8 flex items-start gap-3.5 rounded-xl px-5 py-4 outline-1 -outline-offset-1 outline-white/15 outline-dashed">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{title}</div>
        <div className="mt-0.5 max-w-[64ch] text-[12px] leading-relaxed text-muted-foreground text-pretty">
          {children}
        </div>
      </div>
    </div>
  );
}

export function Library() {
  const { layout, filters, running, clearFilters } = useWin();
  const games = visibleGames(filters, running);
  return (
    <main className="@container relative flex h-full min-h-0 min-w-0 flex-col bg-background [--ring-bg:var(--background)]">
      <LibraryHeader />
      <div data-scroll className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        {games.length > 0 &&
          (layout.main === "list" ? <List games={games} /> : <Grid games={games} />)}
        {games.length === 0 && !filters.unvetted && (
          <div className="grid justify-items-center gap-3 px-8 pt-24 text-center">
            <div className="text-[15px] font-medium">No games match</div>
            <p className="max-w-[44ch] text-[13px] leading-relaxed text-muted-foreground">
              {filters.q
                ? `Nothing in your sources is called “${filters.q}”.`
                : "The filters you picked leave nothing in your sources."}{" "}
              Turn a source back on, or loosen a filter.
            </p>
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        )}
        {filters.unvetted && (
          <div className={games.length ? "" : "pt-6"}>
            <Note
              icon={<EyeSlashIcon className="size-5" />}
              title={`${UNVETTED} unvetted listings`}
            >
              No curator has checked these yet. They load from relays as you scroll, carry no
              sign-in rating, and Keyhall asks before it signs anything for them.
            </Note>
          </div>
        )}
      </div>
      {layout.detail === "sheet" && layout.selected && <Sheet />}
    </main>
  );
}
