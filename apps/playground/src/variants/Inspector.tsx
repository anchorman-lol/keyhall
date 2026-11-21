import { Button } from "@keyhall/ui/components/button";
import { Switch } from "@keyhall/ui/components/switch";
import { cn } from "@keyhall/ui/lib/utils";
import {
  CompassIcon,
  CoinsIcon,
  DotsThreeIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  SealCheckIcon,
  ShieldCheckIcon,
  SignatureIcon,
  SquaresFourIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import {
  BUDGET,
  friend,
  friendsIn,
  game,
  GAMES,
  LIBRARY,
  ME,
  RUNNING,
  SIGNATURES,
  SOURCES,
  source,
  type Game,
} from "../data.ts";
import { Avatar, Cover, Live, Sats, TrafficLights, sourceTint } from "../kit.tsx";

const SELECTED = "forgerealms";
const GROUPS: { title: string; ids: string[] }[] = [
  { title: "Playing now", ids: ["neonsentinel"] },
  { title: "Friends are in", ids: ["forgerealms", "nochess", "xenophon"] },
  { title: "Recently played", ids: ["sanki", "blockstr", "deadmans", "nomad", "spacezappers"] },
  { title: "Not played yet", ids: ["pallasite", "plume", "vibecampvania", "gorilator"] },
];

function ListRow({ g }: { g: Game }) {
  const here = friendsIn(g.id);
  const selected = g.id === SELECTED;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-2 py-1.5",
        selected ? "bg-primary/[0.13] ring-1 ring-primary/30" : "hover:bg-white/[0.04]",
      )}
    >
      <Cover game={g} className="h-[42px] w-[68px] shrink-0 rounded-md" />
      <div className="min-w-0 flex-1 leading-snug">
        <div className="truncate font-medium">{g.name}</div>
        <div className="truncate text-[12px] text-muted-foreground">
          {g.genre} · {source(g.source).name}
        </div>
      </div>
      {g.id === RUNNING.game ? (
        <span className="flex items-center gap-1.5 text-[12px] text-online">
          <Live className="size-1.5" /> {RUNNING.session}
        </span>
      ) : here.length ? (
        <span className="flex -space-x-1.5">
          {here.map((f) => (
            <Avatar
              key={f.handle}
              person={f}
              size="xs"
              className="rounded-full ring-2 ring-background"
            />
          ))}
        </span>
      ) : (
        <span className="text-[12px] text-muted-foreground">{g.lastPlayed ?? ""}</span>
      )}
    </div>
  );
}

export function Inspector() {
  const g = game(SELECTED);
  const running = game(RUNNING.game);
  const share = BUDGET.split.find((b) => b.game === g.id)!.sats;
  const tomasz = friend("tomasz");
  return (
    <div className="grid h-full grid-cols-[216px_404px_1fr]">
      <aside className="flex min-h-0 flex-col border-r border-white/[0.06] bg-sidebar px-3 [--ring-bg:var(--sidebar)]">
        <TrafficLights className="mt-[18px] ml-2" />
        <nav className="mt-6 grid gap-0.5 text-[13px]">
          {[
            { icon: SquaresFourIcon, label: "Library", n: String(LIBRARY.length), on: true },
            { icon: CompassIcon, label: "Discover" },
            { icon: UsersThreeIcon, label: "Friends", n: "5 online" },
            { icon: CoinsIcon, label: "Budget", n: "Dec 1" },
          ].map((r) => (
            <div
              key={r.label}
              className={cn(
                "flex h-8 items-center gap-2.5 rounded-md px-2.5",
                r.on ? "bg-white/[0.07] font-medium" : "text-foreground/85",
              )}
            >
              <r.icon className="size-4" />
              <span className="flex-1">{r.label}</span>
              {r.n && <span className="text-[12px] font-normal text-muted-foreground">{r.n}</span>}
            </div>
          ))}
        </nav>
        <div className="mt-7 mb-2 px-2.5 text-[12px] font-semibold text-muted-foreground">
          Sources
        </div>
        <div className="grid gap-1">
          {SOURCES.map((s) => (
            <label
              key={s.id}
              className="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px]"
            >
              <span
                className="size-2 shrink-0 rounded-[2px]"
                style={{ background: sourceTint(s.hue, s.on ? 0.8 : 0.5, s.on ? 0.14 : 0.04) }}
              />
              <span className={cn("min-w-0 flex-1 truncate", !s.on && "text-muted-foreground")}>
                {s.name}
              </span>
              <Switch size="sm" defaultChecked={s.on} aria-label={s.name} />
            </label>
          ))}
          <div className="px-2.5 pt-1 text-[12px] text-muted-foreground">+ Add a curator</div>
        </div>

        <div className="mt-auto mb-3 overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06]">
          <div className="relative">
            <Cover game={running} className="h-[84px] w-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1d1f27] to-transparent" />
            <span className="absolute bottom-2 left-3 flex items-center gap-1.5 text-[11px] font-medium text-white/90">
              <Live className="size-1.5" /> Running · {RUNNING.session}
            </span>
          </div>
          <div className="px-3 pt-1.5 pb-3">
            <div className="truncate font-medium">{running.name}</div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <SignatureIcon className="size-3.5 text-primary" />
              <span className="truncate">
                Signed {SIGNATURES[0]!.what.toLowerCase()} · {SIGNATURES[0]!.ago}
              </span>
            </div>
          </div>
        </div>
        <div className="mb-3 flex items-center gap-2.5 px-2">
          <Avatar person={ME} size="sm" />
          <span className="truncate font-mono text-[11px] text-muted-foreground">{ME.npub}</span>
        </div>
      </aside>

      <section className="flex min-h-0 flex-col border-r border-white/[0.06]">
        <div className="flex h-[54px] shrink-0 items-center gap-2 px-4">
          <div className="flex h-8 flex-1 items-center gap-2 rounded-md bg-white/[0.05] px-2.5 text-muted-foreground">
            <MagnifyingGlassIcon className="size-4" />
            Filter {LIBRARY.length} games
          </div>
        </div>
        <div className="no-scrollbar min-h-0 flex-1 overflow-hidden px-2">
          {GROUPS.map((grp) => (
            <div key={grp.title} className="mb-3">
              <div className="px-3 pt-2 pb-1.5 text-[12px] font-medium text-muted-foreground">
                {grp.title}
              </div>
              <div className="grid gap-0.5">
                {grp.ids.map((id) => (
                  <ListRow key={id} g={GAMES.find((x) => x.id === id)!} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <main className="relative min-h-0 overflow-hidden">
        <div className="relative h-[330px]">
          <Cover game={g} className="absolute inset-0 size-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-background/0" />
          <div className="absolute inset-x-0 bottom-0 px-10 pb-2">
            <div className="flex items-center gap-2 text-[12px] text-foreground/80">
              <span
                className="size-2 rounded-[2px]"
                style={{ background: sourceTint(source(g.source).hue, 0.8, 0.14) }}
              />
              {source(g.source).name}, curated by Tomasz · {g.genre} · multiplayer on relays
            </div>
            <h1 className="mt-2 text-[40px] leading-none font-semibold tracking-[-0.025em]">
              {g.name}
            </h1>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-4 right-4 bg-black/40 text-white backdrop-blur-sm"
            aria-label="More"
          >
            <DotsThreeIcon weight="bold" />
          </Button>
        </div>

        <div className="px-10">
          <p className="max-w-[60ch] text-[14px] leading-relaxed text-foreground/85">{g.what}</p>
          <div className="mt-5 flex items-center gap-2.5 [--ring-bg:var(--secondary)]">
            <Button size="lg" className="px-6">
              <PlayIcon weight="fill" data-icon="inline-start" /> Play
            </Button>
            <Button size="lg" variant="secondary">
              <Avatar person={tomasz} size="xs" className="-ml-1" /> Join Tomasz
            </Button>
            <span className="ml-2 text-[12px] text-muted-foreground">
              He's raiding the river village
            </span>
          </div>

          <div className="mt-7 grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-white/[0.06] ring-1 ring-white/[0.06]">
            <div className="bg-background p-4">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-online">
                <ShieldCheckIcon weight="fill" className="size-4" /> Signs through Keyhall
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                Asks for your public key and signs village moves. Your nsec never reaches the game.
              </p>
              <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                <SealCheckIcon className="size-3.5 text-primary" /> Checked by Tomasz
              </div>
            </div>
            <div className="bg-background p-4">
              <div className="text-[12px] font-medium">Your play</div>
              <div className="mt-1 text-[22px] font-semibold tracking-tight tabular-nums">
                2 h 40 m
              </div>
              <div className="text-[12px] text-muted-foreground">
                this month · last played yesterday
              </div>
            </div>
            <div className="bg-background p-4">
              <div className="text-[12px] font-medium">From your budget</div>
              <div className="mt-1 text-[22px] font-semibold tracking-tight">
                <Sats n={share} />{" "}
                <span className="text-[13px] font-normal text-muted-foreground">sats</span>
              </div>
              <div className="text-[12px] text-muted-foreground">
                {Math.round((share / BUDGET.total) * 100)}% of November, pays {BUDGET.paysOn}
              </div>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-[1fr_1fr] gap-10">
            <section>
              <h3 className="mb-2 text-[13px] font-semibold">Friends</h3>
              {[
                { f: tomasz, line: "Playing now · raiding the river village", on: true },
                { f: friend("juno"), line: "Played Saturday · 1 h 10 m" },
                { f: friend("ren"), line: "Has it in their library" },
              ].map(({ f, line, on }) => (
                <div key={f.handle} className="flex items-center gap-3 py-1.5">
                  <Avatar person={{ ...f, status: on ? "ingame" : "offline" }} size="sm" dot />
                  <span className="font-medium">{f.name}</span>
                  <span
                    className={cn(
                      "truncate text-[12px]",
                      on ? "text-ingame" : "text-muted-foreground",
                    )}
                  >
                    {line}
                  </span>
                </div>
              ))}
            </section>
            <section>
              <h3 className="mb-2 text-[13px] font-semibold">Listing</h3>
              <dl className="grid grid-cols-[96px_1fr] gap-y-1.5 text-[12px]">
                <dt className="text-muted-foreground">Developer</dt>
                <dd className="font-mono text-[11px]">npub1forge…8ka2</dd>
                <dt className="text-muted-foreground">Updated</dt>
                <dd>Jul 26, scores yesterday</dd>
                <dt className="text-muted-foreground">Plays on</dt>
                <dd>relay.forgerealms.gg, nos.lol</dd>
                <dt className="text-muted-foreground">Opens</dt>
                <dd>In its own window, 1280 × 800</dd>
              </dl>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
