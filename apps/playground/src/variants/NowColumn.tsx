import { Button } from "@keyhall/ui/components/button";
import { cn } from "@keyhall/ui/lib/utils";
import {
  AppWindowIcon,
  CaretDownIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ProhibitIcon,
  StopIcon,
} from "@phosphor-icons/react";
import {
  BUDGET,
  FRIENDS,
  game,
  gamesIn,
  LIBRARY,
  ME,
  RUNNING,
  SIGNATURES,
  SOURCES,
} from "../data.ts";
import { Avatar, Cover, Live, Sats, Tile, TrafficLights, Wordmark } from "../kit.tsx";

export function NowColumn() {
  const running = game(RUNNING.game);
  const playing = FRIENDS.filter((f) => f.status === "ingame" && f.game !== RUNNING.game);
  const online = FRIENDS.filter((f) => f.status === "online");
  const spent = BUDGET.split.reduce((s, b) => s + b.sats, 0);
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-[52px] shrink-0 items-center gap-6 border-b border-white/[0.06] px-5">
        <TrafficLights />
        <Wordmark className="ml-2" />
        <nav className="ml-4 flex gap-6 text-[13px] font-medium">
          <span className="text-foreground">Library</span>
          <span className="text-muted-foreground">Discover</span>
          <span className="text-muted-foreground">Budget</span>
        </nav>
        <div className="ml-auto flex h-8 w-64 items-center gap-2 rounded-md bg-white/[0.05] px-2.5 text-muted-foreground">
          <MagnifyingGlassIcon className="size-4" />
          <span className="flex-1">Search</span>
          <kbd className="font-sans text-[11px]">⌘K</kbd>
        </div>
        <span className="font-mono text-[12px] text-muted-foreground">{ME.npub}</span>
        <Avatar person={ME} size="sm" />
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[372px_1fr]">
        <aside className="flex min-h-0 flex-col gap-7 border-r border-white/[0.06] bg-sidebar px-5 pt-5 pb-5 [--ring-bg:var(--sidebar)]">
          <section>
            <div className="relative overflow-hidden rounded-xl ring-1 ring-white/[0.08]">
              <Cover game={running} className="h-[168px] w-full" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
              <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                <Live className="size-1.5" /> You're playing · {RUNNING.session}
              </span>
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-3.5">
                <div>
                  <div className="text-[16px] font-semibold text-white">{running.name}</div>
                  <div className="text-[12px] text-white/70">
                    Best tonight 11,660 · kestrel's is 14,200
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="icon-sm"
                    variant="secondary"
                    aria-label="Show game window"
                    className="bg-white/15 text-white backdrop-blur-sm"
                  >
                    <AppWindowIcon />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="secondary"
                    aria-label="Quit game"
                    className="bg-white/15 text-white backdrop-blur-sm"
                  >
                    <StopIcon weight="fill" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between px-0.5 text-[12px]">
              <span className="font-medium">Keyhall signed for it</span>
              <span className="text-muted-foreground">14 this session</span>
            </div>
            <ul className="mt-1.5 grid gap-px overflow-hidden rounded-lg bg-white/[0.04] text-[12px]">
              {SIGNATURES.filter((s) => s.game === RUNNING.game).map((s) => (
                <li key={s.what} className="flex items-center gap-2.5 bg-sidebar/40 px-3 py-2">
                  {s.ok ? (
                    <CheckIcon weight="bold" className="size-3.5 text-online" />
                  ) : (
                    <ProhibitIcon className="size-3.5 text-destructive" />
                  )}
                  <span className="flex-1 truncate">{s.what}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{s.kind}</span>
                  <span className="w-10 text-right text-muted-foreground">{s.ago}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-2.5 flex items-baseline justify-between text-[13px] font-semibold">
              Friends playing{" "}
              <span className="text-[12px] font-normal text-muted-foreground">Join from here</span>
            </h3>
            <div className="grid gap-2.5">
              {playing.map((f) => {
                const g = game(f.game!);
                return (
                  <div
                    key={f.handle}
                    className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-white/[0.04]"
                  >
                    <span className="relative shrink-0">
                      <Cover game={g} className="h-[54px] w-[86px] rounded-md" />
                      <Avatar
                        person={f}
                        size="sm"
                        className="absolute -right-2 -bottom-2 rounded-full ring-2 ring-sidebar"
                      />
                    </span>
                    <div className="ml-1 min-w-0 flex-1 leading-snug">
                      <div className="truncate font-medium">{f.name}</div>
                      <div className="truncate text-[12px] text-ingame">{g.name}</div>
                      <div className="truncate text-[12px] text-muted-foreground">{f.line}</div>
                    </div>
                    <Button size="xs" variant="secondary">
                      Join
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="mb-2.5 text-[13px] font-semibold">Online</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {online.map((f) => (
                <span key={f.handle} className="flex items-center gap-2 text-[13px]">
                  <Avatar person={f} size="sm" dot /> {f.name}
                </span>
              ))}
              <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <span className="flex -space-x-1.5">
                  {FRIENDS.filter((f) => f.status === "offline").map((f) => (
                    <Avatar
                      key={f.handle}
                      person={f}
                      size="sm"
                      className="rounded-full opacity-50 ring-2 ring-sidebar"
                    />
                  ))}
                </span>
                2 offline
              </span>
            </div>
          </section>

          <section className="mt-auto rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-semibold">{BUDGET.month} budget</span>
              <span className="text-[12px] text-muted-foreground">pays {BUDGET.paysOn}</span>
            </div>
            <div className="mt-1 text-[12px] text-muted-foreground">
              <Sats n={spent} className="text-foreground" /> of <Sats n={BUDGET.total} /> sats,
              split by your play time
            </div>
            <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full">
              {BUDGET.split.slice(0, 6).map((b) => (
                <span
                  key={b.game}
                  className="h-full rounded-[1px] bg-primary/80 first:bg-primary"
                  style={{ flex: b.sats }}
                />
              ))}
              <span
                className="h-full bg-primary/25"
                style={{ flex: BUDGET.split.slice(6).reduce((s, b) => s + b.sats, 0) }}
              />
            </div>
            <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
              {BUDGET.split.slice(0, 3).map((b) => (
                <span key={b.game}>
                  {game(b.game).name} <Sats n={b.sats} className="text-foreground/80" />
                </span>
              ))}
            </div>
          </section>
        </aside>

        <main className="no-scrollbar min-h-0 overflow-hidden px-8">
          <div className="flex h-[52px] items-end gap-6 border-b border-white/[0.06] text-[13px]">
            {[
              { id: "all", name: "All", n: LIBRARY.length },
              ...SOURCES.filter((s) => s.on).map((s) => ({
                id: s.id,
                name: s.name,
                n: gamesIn(s.id).length,
              })),
            ].map((t, i) => (
              <span
                key={t.id}
                className={cn(
                  "-mb-px flex items-center gap-1.5 border-b-2 pb-3 font-medium",
                  i === 0
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground",
                )}
              >
                {t.name}
                <span className="text-[12px] font-normal text-muted-foreground tabular-nums">
                  {t.n}
                </span>
              </span>
            ))}
            <span className="-mb-px flex items-center gap-1 border-b-2 border-transparent pb-3 text-muted-foreground">
              <PlusIcon className="size-3.5" /> Curator
            </span>
            <Button variant="ghost" size="sm" className="mb-1.5 ml-auto text-muted-foreground">
              Last played <CaretDownIcon data-icon="inline-end" />
            </Button>
          </div>
          <div className="grid grid-cols-4 gap-x-5 gap-y-6 pt-6">
            {LIBRARY.filter((g) => g.id !== RUNNING.game)
              .slice(0, 16)
              .map((g) => (
                <Tile key={g.id} game={g} />
              ))}
          </div>
        </main>
      </div>
    </div>
  );
}
