import { monthKey, playTime } from "@keyhall/core/budget";
import {
  activeFilters,
  filterGames,
  NO_FILTERS,
  type Filters,
  type Sort,
} from "@keyhall/core/filters";
import {
  depthOf,
  library,
  playing,
  running,
  signInOf,
  unreachable,
  updatedAt,
} from "@keyhall/core/launcher";
import type { Game } from "@keyhall/core/listing";
import { sourceList } from "@keyhall/core/sources";
import { Button } from "@keyhall/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@keyhall/ui/components/empty";
import { Input } from "@keyhall/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@keyhall/ui/components/popover";
import { Switch } from "@keyhall/ui/components/switch";
import { cn } from "@keyhall/ui/lib/utils";
import {
  BroadcastIcon,
  CaretDownIcon,
  CheckIcon,
  FunnelSimpleIcon,
  MagnifyingGlassIcon,
  SortAscendingIcon,
  StackIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { SignInBadge, verifiers } from "./badges.tsx";
import { FriendsPlaying } from "./Friends.tsx";
import { KeyDialog } from "./KeyDialog.tsx";
import { Launcher, minutes, useNow } from "./launcher.ts";
import { RelayToggles } from "./Relays.tsx";
import { Sources } from "./Sources.tsx";

export function Cover({ game, className }: { game: Game; className: string }) {
  const art = game.banner ?? game.picture;
  return art ? (
    <img src={art} alt="" className={cn("bg-muted object-cover", className)} />
  ) : (
    <div className={cn("grid place-items-center bg-muted text-muted-foreground", className)}>
      {game.name.slice(0, 1)}
    </div>
  );
}

export function GameIcon({ game, className }: { game: Game; className: string }) {
  const art = game.picture ?? game.banner;
  return art ? (
    <img src={art} alt="" className={cn("shrink-0 bg-muted object-cover", className)} />
  ) : (
    <span
      className={cn(
        "grid shrink-0 place-items-center bg-primary/15 font-semibold text-primary uppercase",
        className,
      )}
    >
      {game.name.slice(0, 1)}
    </span>
  );
}

export function Live() {
  return (
    <span className="relative inline-flex size-1.5">
      <span className="absolute inset-0 animate-ping rounded-full bg-online/60 motion-reduce:hidden" />
      <span className="relative size-1.5 rounded-full bg-online" />
    </span>
  );
}

const SORTS: Record<Sort, string> = {
  name: "Name",
  updated: "Recently updated",
  played: "Most played this month",
};

const TOGGLES = [
  ["signer", "Signs through Keyhall", "Your key never reaches the game"],
  ["friends", "Friends playing", "Someone you follow is in it now"],
  ["updated", "Updated recently", "In the last two weeks"],
] as const;

const DEPTHS = [
  [undefined, "Any"],
  ["identity", "Uses your key"],
  ["multiplayer", "Plays over relays"],
] as const;

const CHIPS: Record<ReturnType<typeof activeFilters>[number], (f: Filters) => string> = {
  signer: () => "Signs through Keyhall",
  friends: () => "Friends playing",
  updated: () => "Updated recently",
  depth: (f) => DEPTHS.find(([d]) => d === f.depth)![1],
};

function Menu({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="secondary" size="sm" className="rounded-lg" />}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 rounded-xl p-1.5">
        {children}
      </PopoverContent>
    </Popover>
  );
}

function Row({ children, end }: { children: ReactNode; end: ReactNode }) {
  return (
    <label className="flex min-h-9 items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] hover:bg-white/[0.05]">
      <span className="min-w-0 flex-1 leading-tight">{children}</span>
      {end}
    </label>
  );
}

function Toolbar({
  count,
  filters,
  setFilters,
}: {
  count: number;
  filters: Filters;
  setFilters: (f: Filters) => void;
}) {
  const { sources, npub, relays } = Launcher.useSelector((s) => s.context);
  const set = (f: Partial<Filters>) => setFilters({ ...filters, ...f });
  const on = sourceList(sources).filter((s) => s.enabled).length;
  const active = activeFilters(filters);
  return (
    <>
      <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-white/[0.06] px-6">
        <h1 className="text-[15px] font-semibold">Library</h1>
        <span className="text-muted-foreground tabular-nums">{count}</span>
        <div className="ml-auto flex min-w-0 items-center gap-1.5">
          <label className="relative w-56 min-w-0">
            <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.q}
              onChange={(e) => set({ q: e.target.value })}
              placeholder="Search games"
              aria-label="Search games"
              className="h-8 rounded-lg pl-8 text-[13px]"
            />
          </label>
          <Menu
            trigger={
              <>
                <StackIcon data-icon="inline-start" />
                Sources
                <span className="text-muted-foreground tabular-nums">
                  {on}/{sourceList(sources).length}
                </span>
              </>
            }
          >
            <div className="py-1.5">
              <Sources />
            </div>
          </Menu>
          <Menu
            trigger={
              <>
                <BroadcastIcon data-icon="inline-start" />
                Relays
                <span className="text-muted-foreground tabular-nums">
                  {relays.filter((r) => r.enabled).length}/{relays.length}
                </span>
              </>
            }
          >
            <RelayToggles />
          </Menu>
          <Menu
            trigger={
              <>
                <FunnelSimpleIcon data-icon="inline-start" />
                Filters
                {active.length > 0 && (
                  <span className="grid size-4 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                    {active.length}
                  </span>
                )}
              </>
            }
          >
            {TOGGLES.map(([key, label, hint]) => (
              <Row
                key={key}
                end={
                  <Switch
                    size="sm"
                    checked={filters[key]}
                    onCheckedChange={(v) => set({ [key]: v })}
                  />
                }
              >
                <span className="block">{label}</span>
                <span className="block text-[11px] text-muted-foreground">{hint}</span>
              </Row>
            ))}
            <div className="px-2 pt-2.5 pb-1.5 text-[12px] font-medium text-muted-foreground">
              Nostr depth, at least
            </div>
            <div className="mx-1 mb-1 grid grid-cols-3 gap-0.5 rounded-lg bg-black/30 p-0.5 ring-1 ring-white/[0.06]">
              {DEPTHS.map(([depth, label]) => (
                <button
                  key={label}
                  aria-pressed={filters.depth === depth}
                  onClick={() => set({ depth })}
                  className="h-9 rounded-md px-1 text-[11px] leading-tight text-muted-foreground hover:text-foreground aria-pressed:bg-white/[0.1] aria-pressed:font-medium aria-pressed:text-foreground"
                >
                  {label}
                </button>
              ))}
            </div>
          </Menu>
          <Popover>
            <PopoverTrigger
              render={
                <Button variant="ghost" size="sm" className="rounded-lg text-muted-foreground" />
              }
            >
              <SortAscendingIcon data-icon="inline-start" />
              {SORTS[filters.sort]}
              <CaretDownIcon data-icon="inline-end" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 gap-0 rounded-xl p-1.5">
              {(Object.keys(SORTS) as Sort[]).map((sort) => (
                <button
                  key={sort}
                  onClick={() => set({ sort })}
                  className="flex h-9 items-center rounded-lg px-2 text-left text-[13px] hover:bg-white/[0.05]"
                >
                  <span className="flex-1">{SORTS[sort]}</span>
                  {filters.sort === sort && (
                    <CheckIcon weight="bold" className="size-3.5 text-primary" />
                  )}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          {!npub && <KeyDialog />}
        </div>
      </header>
      {active.length > 0 && (
        <div className="flex h-10 shrink-0 items-center gap-1.5 px-6">
          {active.map((key) => (
            <button
              key={key}
              onClick={() => set({ [key]: NO_FILTERS[key] })}
              className="flex h-6 items-center gap-1 rounded-full bg-primary/[0.12] pr-1.5 pl-2.5 text-[12px] text-primary ring-1 ring-primary/30 hover:bg-primary/[0.18]"
            >
              {CHIPS[key](filters)}
              <XIcon className="size-3" />
            </button>
          ))}
          <button
            onClick={() => setFilters({ ...NO_FILTERS, sort: filters.sort })}
            className="px-2 text-[12px] text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      )}
    </>
  );
}

export function Library({
  filters,
  setFilters,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
}) {
  const context = Launcher.useSelector((s) => s.context);
  const { send } = Launcher.useActorRef();
  const now = useNow();
  const friends = playing(context, now);
  const played = playTime(context.sessions, monthKey(new Date(now * 1000)));
  const since = new Map(running(context).map((r) => [r.game.coordinate, r.since]));
  const entries = library(context);
  const games = filterGames(
    entries.map((e) => e.game),
    (game) => ({
      name: game.name,
      signIn: signInOf(context, game).value,
      depth: depthOf(context, game).value,
      friends: friends.filter((p) => p.status.coordinate === game.coordinate).length,
      updated: updatedAt(context, game),
      played: played[game.coordinate] ?? 0,
    }),
    filters,
    now,
  );
  return (
    <main className="flex h-full min-h-0 flex-col">
      <Toolbar count={games.length} filters={filters} setFilters={setFilters} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!entries.length && !context.loading.length && unreachable(context) ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Couldn't reach your relays</EmptyTitle>
              <EmptyDescription>
                None of the relays your sources read from answered. Switch others on or add one.
              </EmptyDescription>
            </EmptyHeader>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => send({ type: "view", view: "relays" })}
            >
              Open relay settings
            </Button>
          </Empty>
        ) : !entries.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>
                {context.loading.length
                  ? "Looking for games on relays…"
                  : "No games in your sources"}
              </EmptyTitle>
              <EmptyDescription>
                Open Sources to switch one on, add a curator's list or show unvetted listings.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : !games.length ? (
          <div className="grid justify-items-center gap-3 px-8 pt-24 text-center">
            <div className="text-[15px] font-medium">No games match</div>
            <p className="max-w-[44ch] text-[13px] text-muted-foreground">
              {filters.q
                ? `Nothing in your sources is called “${filters.q}”.`
                : "The filters you picked leave nothing in your sources."}
            </p>
            <Button variant="secondary" size="sm" onClick={() => setFilters(NO_FILTERS)}>
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(184px,1fr))] content-start gap-x-5 gap-y-6 px-6 pt-5 pb-8">
            {games.map((game) => {
              const signIn = signInOf(context, game);
              const started = since.get(game.coordinate);
              return (
                <button
                  key={game.coordinate}
                  onClick={() => send({ type: "select", game })}
                  className="group/tile flex min-w-0 flex-col gap-2 text-left outline-none"
                >
                  <span className="relative block overflow-hidden rounded-lg ring-1 ring-white/[0.07] transition-shadow group-hover/tile:ring-white/25 group-focus-visible/tile:ring-2 group-focus-visible/tile:ring-ring">
                    <Cover
                      game={game}
                      className="aspect-[16/10] w-full text-4xl transition-transform duration-300 ease-out group-hover/tile:scale-[1.025] motion-reduce:transition-none"
                    />
                    {since.has(game.coordinate) && (
                      <span className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white tabular-nums">
                        <Live /> {started ? minutes(now - started) : "Running"}
                      </span>
                    )}
                  </span>
                  <span className="flex items-start gap-2.5 px-0.5">
                    <GameIcon game={game} className="mt-0.5 size-8 rounded-md text-sm" />
                    <span className="grid min-w-0 flex-1 gap-1">
                      <span className="truncate text-[13px] font-medium">{game.name}</span>
                      <span className="flex">
                        <SignInBadge verdict={signIn} by={verifiers(context, signIn)} />
                      </span>
                      <FriendsPlaying coordinate={game.coordinate} />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
