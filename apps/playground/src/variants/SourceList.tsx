import { Button } from "@keyhall/ui/components/button";
import { cn } from "@keyhall/ui/lib/utils";
import {
  CaretDownIcon,
  ClockCounterClockwiseIcon,
  EyeSlashIcon,
  GearSixIcon,
  GridFourIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  RowsIcon,
  SignatureIcon,
  SquaresFourIcon,
  StopIcon,
  UsersThreeIcon,
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
  UNVETTED,
} from "../data.ts";
import { Avatar, Cover, Live, Sats, Tile, TrafficLights, sourceTint } from "../kit.tsx";

function Row({
  icon,
  label,
  count,
  active,
  muted,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  count?: React.ReactNode;
  active?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px]",
        active
          ? "bg-white/[0.07] font-medium text-foreground"
          : "text-foreground/85 hover:bg-white/[0.04]",
        muted && "text-muted-foreground",
      )}
    >
      <span className="grid w-4 place-items-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count != null && (
        <span className="text-[12px] text-muted-foreground tabular-nums">{count}</span>
      )}
    </div>
  );
}

const playing = FRIENDS.filter((f) => f.status === "ingame");
const online = FRIENDS.filter((f) => f.status === "online");
const offline = FRIENDS.filter((f) => f.status === "offline");

export function SourceList() {
  const running = game(RUNNING.game);
  const last = SIGNATURES[0]!;
  const spent = BUDGET.split.reduce((s, x) => s + x.sats, 0);
  return (
    <div className="grid h-full grid-cols-[244px_1fr_272px] grid-rows-[1fr_40px]">
      <aside className="flex flex-col border-r border-white/[0.06] bg-sidebar px-3">
        <TrafficLights className="mt-[18px] ml-2" />
        <div className="mt-5 flex h-8 items-center gap-2 rounded-md bg-white/[0.05] px-2.5 text-muted-foreground">
          <MagnifyingGlassIcon className="size-4" />
          <span className="flex-1">Search</span>
          <kbd className="text-[11px] font-sans">⌘K</kbd>
        </div>

        <nav className="mt-5 grid gap-0.5">
          <Row
            icon={<SquaresFourIcon className="size-4" />}
            label="All games"
            count={LIBRARY.length}
            active
          />
          <Row
            icon={<ClockCounterClockwiseIcon className="size-4" />}
            label="Recently played"
            count={9}
          />
          <Row icon={<UsersThreeIcon className="size-4" />} label="Played by friends" count={6} />
        </nav>

        <div className="mt-6 mb-1.5 flex items-center justify-between px-2.5">
          <span className="text-[12px] font-semibold text-muted-foreground">Sources</span>
          <Button size="icon-xs" variant="ghost" aria-label="Add a curator">
            <PlusIcon />
          </Button>
        </div>
        <div className="grid gap-0.5">
          {SOURCES.map((s) => (
            <Row
              key={s.id}
              muted={!s.on}
              icon={
                s.by ? (
                  <Avatar
                    person={FRIENDS.find((f) => f.handle === s.by)!}
                    size="xs"
                    className={cn(!s.on && "opacity-50")}
                  />
                ) : (
                  <span
                    className="size-2.5 rounded-[3px]"
                    style={{ background: sourceTint(s.hue, 0.8, 0.14) }}
                  />
                )
              }
              label={
                <>
                  {s.name}
                  {s.by && <span className="ml-1.5 text-muted-foreground">{s.by}</span>}
                </>
              }
              count={s.on ? gamesIn(s.id).length : "Off"}
            />
          ))}
          <Row
            muted
            icon={<EyeSlashIcon className="size-4" />}
            label="Unvetted listings"
            count={UNVETTED}
          />
        </div>

        <div className="mt-auto mb-3 flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-white/[0.04]">
          <Avatar person={ME} size="sm" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-[13px] font-medium">{ME.name}</div>
            <div className="truncate font-mono text-[11px] text-muted-foreground">{ME.npub}</div>
          </div>
          <GearSixIcon className="size-4 text-muted-foreground" />
        </div>
      </aside>

      <main className="flex min-h-0 flex-col">
        <header className="flex h-[54px] shrink-0 items-center gap-3 border-b border-white/[0.06] px-7">
          <h1 className="text-[15px] font-semibold">All games</h1>
          <span className="text-muted-foreground tabular-nums">{LIBRARY.length}</span>
          <span className="ml-3 text-[12px] text-muted-foreground">from 4 of 5 sources</span>
          <div className="ml-auto flex items-center gap-1 text-muted-foreground">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              Last played <CaretDownIcon data-icon="inline-end" />
            </Button>
            <div className="ml-1 flex rounded-md bg-white/[0.05] p-0.5">
              <span className="grid size-7 place-items-center rounded bg-white/[0.08] text-foreground">
                <GridFourIcon className="size-4" />
              </span>
              <span className="grid size-7 place-items-center rounded">
                <RowsIcon className="size-4" />
              </span>
            </div>
          </div>
        </header>
        <div className="no-scrollbar min-h-0 flex-1 overflow-hidden px-7 pt-6">
          <div className="grid grid-cols-4 gap-x-5 gap-y-6">
            {LIBRARY.slice(0, 16).map((g) => (
              <Tile key={g.id} game={g} running={g.id === RUNNING.game} />
            ))}
          </div>
        </div>
      </main>

      <aside className="flex min-h-0 flex-col border-l border-white/[0.06] bg-sidebar [--ring-bg:var(--sidebar)]">
        <header className="flex h-[54px] shrink-0 items-center justify-between border-b border-white/[0.06] px-5">
          <span className="text-[13px] font-semibold">Friends</span>
          <span className="text-[12px] text-muted-foreground">5 online</span>
        </header>
        <div className="flex min-w-0 flex-col gap-5 px-3 pt-4">
          <section>
            <h3 className="mb-1 px-2 text-[12px] font-medium text-muted-foreground">Playing</h3>
            {playing.map((f) => {
              const g = game(f.game!);
              return (
                <div
                  key={f.handle}
                  className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-white/[0.04]"
                >
                  <Avatar person={f} dot />
                  <div className="min-w-0 flex-1 leading-snug">
                    <div className="truncate font-medium">{f.name}</div>
                    <div className="truncate text-[12px] text-ingame">{g.name}</div>
                    <div className="truncate text-[12px] text-muted-foreground">{f.line}</div>
                  </div>
                  <Cover game={g} className="h-9 w-14 shrink-0 rounded" />
                </div>
              );
            })}
          </section>
          <section>
            <h3 className="mb-1 px-2 text-[12px] font-medium text-muted-foreground">Online</h3>
            {online.map((f) => (
              <div key={f.handle} className="flex items-center gap-3 rounded-md px-2 py-1.5">
                <Avatar person={f} dot size="sm" />
                <span className="flex-1 truncate">{f.name}</span>
              </div>
            ))}
          </section>
          <section>
            <h3 className="mb-1 px-2 text-[12px] font-medium text-muted-foreground">Offline</h3>
            {offline.map((f) => (
              <div
                key={f.handle}
                className="flex items-center gap-3 rounded-md px-2 py-1.5 text-muted-foreground"
              >
                <Avatar person={f} size="sm" className="opacity-60" />
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-[11px]">
                  {f.status === "offline" && f.game ? "2 h" : "3 d"}
                </span>
              </div>
            ))}
          </section>
        </div>
      </aside>

      <footer className="col-span-3 flex items-center gap-6 border-t border-white/[0.06] bg-sidebar px-4 text-[12px]">
        <div className="flex items-center gap-2.5">
          <Cover game={running} className="h-6 w-10 rounded-sm" />
          <span className="font-medium">{running.name}</span>
          <Live className="size-1.5" />
          <span className="text-muted-foreground tabular-nums">{RUNNING.session}</span>
          <button className="ml-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground">
            <StopIcon weight="fill" className="size-3" /> Quit
          </button>
        </div>
        <span className="h-4 w-px bg-white/10" />
        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
          <SignatureIcon className="size-4 text-primary" />
          <span className="text-foreground">Signed {last.what.toLowerCase()}</span>
          <span>kind {last.kind}</span>
          <span>·</span>
          <span>{last.ago} ago</span>
          <span className="ml-1 rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px]">
            14 this session
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3 text-muted-foreground">
          <span>
            {BUDGET.month} budget <Sats n={spent} className="text-foreground" /> /{" "}
            <Sats n={BUDGET.total} /> sats
          </span>
          <span className="flex h-1.5 w-28 overflow-hidden rounded-full bg-white/[0.08]">
            {BUDGET.split.slice(0, 5).map((b, i) => (
              <span
                key={b.game}
                style={{ width: `${(b.sats / BUDGET.total) * 100}%`, opacity: 1 - i * 0.16 }}
                className="h-full bg-primary"
              />
            ))}
            <span
              style={{
                width: `${(BUDGET.split.slice(5).reduce((s, b) => s + b.sats, 0) / BUDGET.total) * 100}%`,
              }}
              className="h-full bg-primary/25"
            />
          </span>
          <span>pays {BUDGET.paysOn}</span>
        </div>
      </footer>
    </div>
  );
}
