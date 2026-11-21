import { Button } from "@keyhall/ui/components/button";
import { cn } from "@keyhall/ui/lib/utils";
import {
  AppWindowIcon,
  CaretRightIcon,
  CoinsIcon,
  DotsThreeIcon,
  KeyIcon,
  MagnifyingGlassIcon,
  UserPlusIcon,
} from "@phosphor-icons/react";
import {
  BUDGET,
  FRIENDS,
  friend,
  game,
  gamesIn,
  ME,
  RUNNING,
  SIGNATURES,
  source,
  type SourceId,
} from "../data.ts";
import { Avatar, Cover, Live, Sats, Tile, TrafficLights, Wordmark, sourceTint } from "../kit.tsx";

function Shelf({ id }: { id: SourceId }) {
  const s = source(id);
  const games = gamesIn(id).filter((g) => g.id !== RUNNING.game);
  return (
    <section className="mt-9">
      <div className="mb-3.5 flex items-center gap-3 pr-8">
        {s.by ? (
          <Avatar person={friend(s.by)} size="sm" />
        ) : (
          <span
            className="grid size-6 place-items-center rounded-md"
            style={{ background: sourceTint(s.hue, 0.35, 0.06) }}
          >
            <span
              className="size-2 rounded-[2px]"
              style={{ background: sourceTint(s.hue, 0.82, 0.14) }}
            />
          </span>
        )}
        <h2 className="text-[15px] font-semibold">{s.name}</h2>
        <span className="text-[13px] text-muted-foreground">
          {s.by ? `${friend(s.by).name}'s list · ` : ""}
          {s.blurb}
        </span>
        <span className="ml-auto flex items-center gap-1 text-[12px] text-muted-foreground">
          All {games.length + (id === "picks" ? 1 : 0)} <CaretRightIcon className="size-3" />
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`${s.name} options`}
          className="text-muted-foreground"
        >
          <DotsThreeIcon weight="bold" />
        </Button>
      </div>
      <div className="flex gap-4 overflow-hidden">
        {games.map((g) => (
          <Tile key={g.id} game={g} className="w-[228px] shrink-0" />
        ))}
      </div>
    </section>
  );
}

export function Shelves() {
  const running = game(RUNNING.game);
  const spent = BUDGET.split.reduce((s, b) => s + b.sats, 0);
  const mira = friend("mira");
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-[52px] shrink-0 items-center gap-4 border-b border-white/[0.06] pr-4 pl-5">
        <TrafficLights />
        <Wordmark className="ml-2" />
        <div className="mx-auto flex h-8 w-[440px] items-center gap-2 rounded-md bg-white/[0.05] px-2.5 text-muted-foreground">
          <MagnifyingGlassIcon className="size-4" />
          <span className="flex-1">Search your shelves, or paste an npub or naddr</span>
          <kbd className="font-sans text-[11px]">⌘K</kbd>
        </div>
        <span className="flex h-8 items-center gap-2 rounded-full bg-white/[0.05] px-3 text-[12px]">
          <CoinsIcon className="size-4 text-primary" />
          <Sats n={spent} />{" "}
          <span className="text-muted-foreground">
            / <Sats n={BUDGET.total} /> sats · pays {BUDGET.paysOn}
          </span>
        </span>
        <span className="flex h-8 items-center gap-2 rounded-full bg-white/[0.05] px-3 text-[12px]">
          <KeyIcon className="size-4 text-online" /> Signer on
        </span>
        <Avatar person={ME} size="sm" />
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_76px]">
        <main className="no-scrollbar min-h-0 overflow-hidden pt-6 pl-8">
          <section className="relative mr-8 h-[232px] overflow-hidden rounded-2xl ring-1 ring-white/[0.08]">
            <Cover game={running} className="absolute inset-0 size-full" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-black/10" />
            <div className="relative flex h-full items-end justify-between gap-10 p-7">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white">
                  <Live className="size-1.5" /> Running · {RUNNING.session}
                </span>
                <h1 className="mt-3 text-[30px] leading-tight font-semibold tracking-[-0.02em] text-white">
                  {running.name}
                </h1>
                <p className="mt-1 text-[13px] text-white/75">
                  Best tonight 11,660 · kestrel's is 14,200
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-[12px] text-white/60">
                  <KeyIcon className="size-3.5 text-primary" />
                  Keyhall signed {SIGNATURES[0]!.what.toLowerCase()}, {SIGNATURES[0]!.ago} ago · 14
                  signatures this session
                </p>
                <div className="mt-4 flex gap-2">
                  <Button>
                    <AppWindowIcon data-icon="inline-start" /> Show game
                  </Button>
                  <Button variant="secondary" className="bg-white/10 text-white">
                    Quit
                  </Button>
                </div>
              </div>
            </div>
          </section>
          <Shelf id="picks" />
          <Shelf id="arcade" />
          <Shelf id="board" />
        </main>

        <aside className="relative flex flex-col items-center gap-3 border-l border-white/[0.06] bg-sidebar pt-5 [--ring-bg:var(--sidebar)]">
          <span className="text-[11px] font-medium text-muted-foreground">Friends</span>
          {FRIENDS.map((f) => (
            <span key={f.handle} className={cn("relative", f.status === "offline" && "opacity-45")}>
              <Avatar
                person={f}
                size="lg"
                dot={f.status === "online"}
                className={cn(
                  f.handle === "mira" &&
                    "rounded-full ring-2 ring-primary ring-offset-2 ring-offset-sidebar",
                )}
              />
              {f.status === "ingame" && (
                <Cover
                  game={game(f.game!)}
                  className="absolute -right-2 -bottom-1 size-[22px] rounded-[6px] ring-2 ring-sidebar"
                />
              )}
            </span>
          ))}
          <span className="mt-1 h-px w-8 bg-white/10" />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Add a friend"
            className="text-muted-foreground"
          >
            <UserPlusIcon />
          </Button>

          <div className="absolute top-[118px] right-[68px] z-10 w-[272px] rounded-xl bg-popover p-3 shadow-2xl ring-1 ring-white/10">
            <div className="flex items-center gap-2.5">
              <Avatar person={mira} size="md" />
              <div className="leading-tight">
                <div className="font-medium">{mira.name}</div>
                <div className="text-[12px] text-ingame">Playing Nochess</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Cover game={game("nochess")} className="h-[46px] w-[74px] rounded-md" />
              <div className="text-[12px] leading-snug text-muted-foreground">
                {mira.line}
                <br />
                Curates Board-game table
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" className="flex-1">
                Watch game
              </Button>
              <Button size="sm" variant="secondary" className="flex-1">
                Message
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
