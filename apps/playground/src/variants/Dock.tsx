import { Button } from "@keyhall/ui/components/button";
import { Switch } from "@keyhall/ui/components/switch";
import { cn } from "@keyhall/ui/lib/utils";
import {
  AppWindowIcon,
  CaretDownIcon,
  MagnifyingGlassIcon,
  SignatureIcon,
  SlidersHorizontalIcon,
  StopIcon,
} from "@phosphor-icons/react";
import {
  BUDGET,
  FRIENDS,
  friend,
  game,
  LIBRARY,
  ME,
  RECENT,
  RUNNING,
  SIGNATURES,
  SOURCES,
  gamesIn,
} from "../data.ts";
import { Avatar, Cover, Live, Sats, Tile, TrafficLights, Wordmark, sourceTint } from "../kit.tsx";

const TABS = ["Library", "Discover", "Friends", "Budget"];
const ticks = [3, 9, 14, 21, 26, 34, 38, 47, 55, 61, 70, 76, 83, 88, 96];

export function Dock() {
  const running = game(RUNNING.game);
  const share = BUDGET.split.find((b) => b.game === running.id)!.sats;
  const others = FRIENDS.filter((f) => f.status !== "offline");
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-[52px] shrink-0 items-center gap-5 border-b border-white/[0.06] bg-sidebar pr-4 pl-5">
        <TrafficLights />
        <Wordmark className="ml-3" />
        <nav className="ml-6 flex items-center gap-1">
          {TABS.map((t, i) => (
            <span
              key={t}
              className={cn(
                "rounded-md px-3 py-1.5 text-[13px] font-medium",
                i === 0
                  ? "bg-white/[0.08] text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </span>
          ))}
        </nav>
        <div className="ml-auto flex h-8 w-72 items-center gap-2 rounded-md bg-white/[0.05] px-2.5 text-muted-foreground">
          <MagnifyingGlassIcon className="size-4" />
          <span className="flex-1">Search games, npubs, curators</span>
          <kbd className="font-sans text-[11px]">⌘K</kbd>
        </div>
        <div className="flex items-center gap-2 [--ring-bg:var(--sidebar)]">
          <span className="flex -space-x-2">
            {others.slice(0, 4).map((f) => (
              <Avatar
                key={f.handle}
                person={f}
                size="sm"
                className="rounded-full ring-2 ring-sidebar"
              />
            ))}
          </span>
          <span className="text-[12px] text-muted-foreground">5 online</span>
        </div>
        <span className="h-5 w-px bg-white/10" />
        <Avatar person={ME} size="sm" />
      </header>

      <main className="no-scrollbar min-h-0 flex-1 overflow-hidden px-8 pt-6">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-foreground px-3 py-1 text-[12px] font-medium text-background">
            All sources
          </span>
          {SOURCES.filter((s) => s.on).map((s) => (
            <span
              key={s.id}
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] text-foreground/85 ring-1 ring-white/10 hover:bg-white/[0.04]"
            >
              {s.by ? (
                <Avatar person={friend(s.by)} size="xs" className="-ml-1.5" />
              ) : (
                <span
                  className="size-2 rounded-[2px]"
                  style={{ background: sourceTint(s.hue, 0.8, 0.14) }}
                />
              )}
              {s.name}
              <span className="text-muted-foreground tabular-nums">{gamesIn(s.id).length}</span>
            </span>
          ))}
          <Button variant="ghost" size="sm" className="text-[12px] text-muted-foreground">
            <SlidersHorizontalIcon data-icon="inline-start" /> Manage sources
          </Button>
        </div>

        <h2 className="mt-7 mb-3 text-[15px] font-semibold">Jump back in</h2>
        <div className="grid grid-cols-[1.6fr_1fr_1fr] gap-4">
          {RECENT.slice(0, 3).map((g, i) => (
            <div
              key={g.id}
              className="group relative overflow-hidden rounded-xl ring-1 ring-white/[0.06]"
            >
              <Cover game={g} className={cn("w-full", i === 0 ? "h-[200px]" : "h-[200px]")} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-semibold text-white">{g.name}</div>
                  <div className="text-[12px] text-white/70">
                    {g.id === RUNNING.game
                      ? "Running now"
                      : `Played ${g.lastPlayed?.toLowerCase()}`}{" "}
                    · {Math.round((g.minutes ?? 0) / 6) / 10} h this month
                  </div>
                </div>
                {g.id !== RUNNING.game && (
                  <Button size="sm" className="shrink-0">
                    Play
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 mb-3 flex items-center gap-3">
          <h2 className="text-[15px] font-semibold">All games</h2>
          <span className="text-muted-foreground tabular-nums">{LIBRARY.length}</span>
          <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground">
            Last played <CaretDownIcon data-icon="inline-end" />
          </Button>
        </div>
        <div className="grid grid-cols-6 gap-x-4 gap-y-5">
          {LIBRARY.filter((g) => !RECENT.slice(0, 3).includes(g))
            .slice(0, 12)
            .map((g) => (
              <Tile key={g.id} game={g} />
            ))}
        </div>
      </main>

      <footer className="relative grid h-[84px] shrink-0 grid-cols-[340px_1fr_auto] items-center gap-8 border-t border-white/[0.08] bg-[#17181f] px-5 shadow-[0_-12px_32px_-12px_rgba(0,0,0,0.6)]">
        <div className="flex min-w-0 items-center gap-3.5">
          <Cover game={running} className="size-[52px] shrink-0 rounded-md" />
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold">{running.name}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Live className="size-1.5" /> Running · {RUNNING.session}
            </div>
          </div>
          <label className="ml-auto flex shrink-0 items-center gap-2 rounded-full bg-white/[0.05] py-1 pr-1.5 pl-3 text-[12px] text-muted-foreground">
            Friends see you
            <Switch size="sm" defaultChecked aria-label="Show friends what you play" />
          </label>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[12px]">
            <SignatureIcon className="size-4 text-primary" />
            <span className="font-medium">Signed {SIGNATURES[0]!.what.toLowerCase()}</span>
            <span className="text-muted-foreground">
              kind {SIGNATURES[0]!.kind} · {SIGNATURES[0]!.ago} ago
            </span>
            <span className="ml-auto text-muted-foreground">
              14 signatures this session, 0 refused
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>{RUNNING.session}</span>
            <div className="relative h-3 flex-1">
              <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
              {ticks.map((t, i) => (
                <span
                  key={t}
                  className={cn(
                    "absolute top-0 h-3 w-[3px] rounded-full",
                    i === ticks.length - 1 ? "bg-primary" : "bg-foreground/35",
                  )}
                  style={{ left: `${t}%` }}
                />
              ))}
            </div>
            <span>now</span>
          </div>
        </div>

        <div className="flex items-center gap-5 [--ring-bg:#17181f]">
          <div className="flex items-center gap-2 text-[12px]">
            <Avatar person={friend("kestrel")} size="sm" />
            <div className="leading-tight">
              <div className="font-medium">kestrel's best 14,200</div>
              <div className="text-muted-foreground">you're 2,540 behind</div>
            </div>
          </div>
          <div className="text-right text-[12px] leading-tight">
            <div>
              <Sats n={share} className="font-medium" />{" "}
              <span className="text-muted-foreground">sats</span>
            </div>
            <div className="text-muted-foreground">from your budget</div>
          </div>
          <div className="flex gap-1.5">
            <Button variant="secondary" size="icon-sm" aria-label="Show game window">
              <AppWindowIcon />
            </Button>
            <Button variant="secondary" size="icon-sm" aria-label="Quit game">
              <StopIcon weight="fill" />
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
