import { Button } from "@keyhall/ui/components/button";
import { cn } from "@keyhall/ui/lib/utils";
import {
  AppWindowIcon,
  ArrowLeftIcon,
  CheckIcon,
  DotsThreeIcon,
  IdentificationBadgeIcon,
  PlayIcon,
  QuestionIcon,
  SealCheckIcon,
  ShieldCheckIcon,
  StopIcon,
  UserCircleDashedIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, type ReactNode } from "react";
import {
  BUDGET,
  CURATOR,
  friend,
  friendsIn,
  game as findGame,
  PLAYED_BY,
  RUNNING,
  SIGNATURES,
  source,
  type Game,
  type SignIn,
} from "../data.ts";
import { Avatar, Cover, Live, Sats, sourceTint } from "../kit.tsx";
import type { Section } from "./config.ts";
import { useWin } from "./state.tsx";

const TRUST: Record<
  SignIn,
  { label: string; tone: string; icon: typeof ShieldCheckIcon; text: string }
> = {
  signer: {
    label: "Signs through Keyhall",
    tone: "text-online",
    icon: ShieldCheckIcon,
    text: "Asks Keyhall for your public key and signatures. Your nsec never reaches the game.",
  },
  "signer-or-nsec": {
    label: "Signer, or a pasted nsec",
    tone: "text-primary",
    icon: WarningIcon,
    text: "Offers a signer but also accepts a pasted key. Keyhall answers for you, so use the signer.",
  },
  throwaway: {
    label: "Guest key",
    tone: "text-ingame",
    icon: UserCircleDashedIcon,
    text: "Makes a session key for each match. Safe, but your profile and friends don't come along.",
  },
  none: {
    label: "No login",
    tone: "text-muted-foreground",
    icon: IdentificationBadgeIcon,
    text: "Doesn't use your Nostr identity at all.",
  },
  unknown: {
    label: "Sign-in not checked",
    tone: "text-primary",
    icon: QuestionIcon,
    text: "The listing doesn't say how it signs you in. Keyhall will ask before anything is signed.",
  },
};

const hm = (m: number) => (m < 60 ? `${m} m` : `${Math.floor(m / 60)} h ${m % 60} m`);
const lastPlayed = (g: Game, running: Game | null) =>
  g.lastPlayed === "Now" && running?.id !== g.id ? "Today" : g.lastPlayed;

function Block({ title, end, children }: { title: string; end?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <h3 className="mb-2.5 flex items-baseline justify-between gap-3 text-[13px] font-semibold">
        {title}
        {end && (
          <span className="truncate text-[12px] font-normal text-muted-foreground">{end}</span>
        )}
      </h3>
      {children}
    </section>
  );
}

function Trust({ g }: { g: Game }) {
  const t = TRUST[g.signIn];
  return (
    <Block title="Sign-in">
      <div className={cn("flex items-center gap-1.5 text-[13px] font-medium", t.tone)}>
        <t.icon weight="fill" className="size-4 shrink-0" /> {t.label}
      </div>
      <p className="mt-1 max-w-[52ch] text-[12px] leading-relaxed text-muted-foreground">
        {t.text}
      </p>
      {g.signIn !== "unknown" && (
        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <SealCheckIcon className="size-3.5 text-primary" /> Checked by {CURATOR[g.source]}
        </div>
      )}
    </Block>
  );
}

function Stats({ g }: { g: Game }) {
  const { running } = useWin();
  const share = BUDGET.split.find((b) => b.game === g.id)?.sats;
  return (
    <div className="grid grid-cols-2 divide-x divide-white/[0.07] rounded-xl bg-white/[0.025] ring-1 ring-white/[0.07]">
      <div className="min-w-0 px-4 py-3">
        <div className="text-[12px] text-muted-foreground">Your play</div>
        <div className="mt-0.5 text-[20px] font-semibold tracking-[-0.015em] tabular-nums">
          {g.minutes ? hm(g.minutes) : "None yet"}
        </div>
        <div className="truncate text-[12px] text-muted-foreground">
          {g.minutes
            ? `this month · ${(lastPlayed(g, running) ?? "").toLowerCase()}`
            : "Not played this month"}
        </div>
      </div>
      <div className="min-w-0 px-4 py-3">
        <div className="text-[12px] text-muted-foreground">From your budget</div>
        <div className="mt-0.5 text-[20px] font-semibold tracking-[-0.015em]">
          {share ? (
            <>
              <Sats n={share} />{" "}
              <span className="text-[13px] font-normal text-muted-foreground">sats</span>
            </>
          ) : (
            "0 sats"
          )}
        </div>
        <div className="truncate text-[12px] text-muted-foreground">
          {share
            ? `${Math.round((share / BUDGET.total) * 100)}% of ${BUDGET.month}`
            : "Play it to give it a share"}
        </div>
      </div>
    </div>
  );
}

function Friends({ g }: { g: Game }) {
  const now = friendsIn(g.id);
  const before = PLAYED_BY[g.id] ?? [];
  return (
    <Block title="Friends" end={now.length ? `${now.length} playing now` : undefined}>
      {now.length + before.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">
          None of your friends have played it yet.
        </p>
      ) : (
        <div className="grid gap-0.5">
          {now.map((f) => (
            <div key={f.handle} className="flex h-9 items-center gap-2.5">
              <Avatar person={f} size="sm" dot />
              <div className="min-w-0 flex-1 truncate text-[13px]">
                <span className="font-medium">{f.name}</span>{" "}
                <span className="text-[12px] text-ingame">{f.line}</span>
              </div>
              {g.multiplayer && (
                <Button size="xs" variant="secondary">
                  Join
                </Button>
              )}
            </div>
          ))}
          {before.map((p) => {
            const f = friend(p.handle);
            return (
              <div key={p.handle} className="flex h-9 items-center gap-2.5">
                <Avatar person={{ ...f, status: "offline" }} size="sm" />
                <div className="min-w-0 flex-1 truncate text-[13px]">
                  <span className="font-medium">{f.name}</span>{" "}
                  <span className="text-[12px] text-muted-foreground">{p.line}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Block>
  );
}

function Signatures({ g }: { g: Game }) {
  const mine = SIGNATURES.filter((s) => s.game === g.id).slice(0, 3);
  return (
    <Block title="Signatures" end={mine.length ? "kept for 30 days" : undefined}>
      {mine.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">Keyhall hasn't signed anything for it.</p>
      ) : (
        <div className="grid gap-px">
          {mine.map((s) => (
            <div key={s.what} className="flex h-7 items-center gap-2 text-[12px]">
              <CheckIcon weight="bold" className="size-3.5 shrink-0 text-online" />
              <span className="min-w-0 flex-1 truncate">{s.what}</span>
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{s.kind}</span>
              <span className="w-16 shrink-0 text-right text-muted-foreground">{s.ago}</span>
            </div>
          ))}
        </div>
      )}
    </Block>
  );
}

function Listing({ g }: { g: Game }) {
  return (
    <Block title="Listing">
      <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-y-1.5 text-[12px]">
        <dt className="text-muted-foreground">Developer</dt>
        <dd className="truncate font-mono text-[11px] leading-[18px]">
          npub1{g.id.slice(0, 5)}…8ka2
        </dd>
        <dt className="text-muted-foreground">Updated</dt>
        <dd className="truncate">{g.updated}</dd>
        <dt className="text-muted-foreground">Players</dt>
        <dd className="truncate">{g.multiplayer ? "Multiplayer on relays" : "Single player"}</dd>
        <dt className="text-muted-foreground">Opens</dt>
        <dd className="truncate">In its own window</dd>
      </dl>
    </Block>
  );
}

const SECTION: Record<Section, (p: { g: Game }) => ReactNode> = {
  trust: Trust,
  stats: Stats,
  friends: Friends,
  signatures: Signatures,
  listing: Listing,
};

function Sections({ g, only, className }: { g: Game; only: Section[]; className?: string }) {
  const { layout } = useWin();
  const list = layout.sections.filter((s) => only.includes(s));
  if (!list.length) return null;
  return (
    <div className={className}>
      {list.map((s) => {
        const S = SECTION[s];
        return (
          <div key={s} className="min-w-0">
            <S g={g} />
          </div>
        );
      })}
    </div>
  );
}

function Actions({ g, size = "lg" }: { g: Game; size?: "default" | "lg" }) {
  const { running } = useWin();
  const joinable = friendsIn(g.id).find(() => g.multiplayer);
  if (running?.id === g.id)
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button size={size}>
          <AppWindowIcon data-icon="inline-start" /> Show window
        </Button>
        <Button size={size} variant="secondary">
          <StopIcon weight="fill" data-icon="inline-start" /> Quit
        </Button>
        <span className="ml-1 flex items-center gap-1.5 text-[12px] text-online tabular-nums">
          <Live className="size-1.5" /> {RUNNING.session}
        </span>
      </div>
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size={size} className="px-5">
        <PlayIcon weight="fill" data-icon="inline-start" /> Play
      </Button>
      {joinable && (
        <Button size={size} variant="secondary" className="[--ring-bg:var(--secondary)]">
          <Avatar person={joinable} size="xs" className="-ml-1" /> Join {joinable.name}
        </Button>
      )}
    </div>
  );
}

function Kicker({ g, className }: { g: Game; className?: string }) {
  const src = source(g.source);
  return (
    <div className={cn("flex items-center gap-2 text-[12px] text-foreground/75", className)}>
      <span
        className="size-2 rounded-[2px]"
        style={{ background: sourceTint(src.hue, 0.8, 0.14) }}
      />
      <span className="truncate">
        {src.name} · {g.genre}
      </span>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  children,
  overlay,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  overlay?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      onClick={onClick}
      className={overlay ? "bg-black/45 text-white hover:bg-black/60" : "text-muted-foreground"}
    >
      {children}
    </Button>
  );
}

/** Round 3's wide pane: the game takes the room beside a narrow library column. */
export function WidePane() {
  const { layout, set, compact } = useWin();
  const g = findGame(layout.selected!);
  const order: Section[] = ["stats", "trust", "friends", "signatures", "listing"];
  return (
    <aside
      data-scroll
      data-detail="wide"
      className="@container no-scrollbar relative h-full min-h-0 min-w-0 overflow-y-auto border-l border-white/[0.06] bg-background [--ring-bg:var(--background)]"
    >
      <div className={cn("relative", compact ? "h-[260px]" : "h-[300px]")}>
        <Cover game={g} className="absolute inset-0 size-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/35 to-background/0" />
        <div className="absolute top-3.5 right-3.5 flex gap-1.5">
          <IconAction label="More" overlay>
            <DotsThreeIcon weight="bold" />
          </IconAction>
          <IconAction label="Close" overlay onClick={() => set({ selected: null })}>
            <XIcon />
          </IconAction>
        </div>
      </div>
      <div className="relative -mt-14 px-9 pb-8">
        <Kicker g={g} />
        <h1 className="mt-1.5 text-[36px] leading-[1.05] font-semibold tracking-[-0.025em] text-balance">
          {g.name}
        </h1>
        <p className="mt-2.5 max-w-[60ch] text-[13px] leading-relaxed text-foreground/80 text-pretty">
          {g.what}
        </p>
        <div className="mt-4">
          <Actions g={g} />
        </div>
        <div
          className={cn(
            "mt-7 grid grid-cols-1 gap-x-10 @min-[700px]:grid-cols-2",
            compact ? "gap-y-5" : "gap-y-6",
          )}
        >
          {order
            .filter((s) => layout.sections.includes(s))
            .map((s) => {
              const S = SECTION[s];
              return (
                <div key={s} className={cn("min-w-0", s === "stats" && "@min-[700px]:col-span-2")}>
                  <S g={g} />
                </div>
              );
            })}
        </div>
      </div>
    </aside>
  );
}

/** A full page for the game: a big hero, the sections in a main and a side column. */
export function GamePage() {
  const { layout, set, compact } = useWin();
  const g = findGame(layout.selected!);
  return (
    <main
      data-detail="page"
      className="@container relative flex h-full min-h-0 min-w-0 flex-col bg-background [--ring-bg:var(--background)]"
    >
      <div className="absolute inset-x-0 top-0 z-20 flex h-[52px] items-center justify-between px-4">
        <Button
          variant="ghost"
          size="sm"
          data-back
          onClick={() => set({ selected: null })}
          className="rounded-lg bg-black/45 text-white backdrop-blur-sm hover:bg-black/60"
        >
          <ArrowLeftIcon data-icon="inline-start" /> Library
        </Button>
        <IconAction label="More" overlay>
          <DotsThreeIcon weight="bold" />
        </IconAction>
      </div>
      <div data-scroll className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className={cn("relative", compact ? "h-[340px]" : "h-[400px]")}>
          <Cover game={g} className="absolute inset-0 size-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/5" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-background/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[1040px] px-10 pb-8">
            <Kicker g={g} className="text-foreground/85" />
            <h1 className="mt-2 text-[48px] leading-[1.02] font-semibold tracking-[-0.03em] text-balance">
              {g.name}
            </h1>
            <p className="mt-3 max-w-[58ch] text-[14px] leading-relaxed text-foreground/85 text-pretty">
              {g.what}
            </p>
            <div className="mt-5">
              <Actions g={g} />
            </div>
          </div>
        </div>
        <div
          className={cn(
            "mx-auto grid max-w-[1040px] grid-cols-1 gap-x-12 px-10 pt-4 pb-12 @min-[860px]:grid-cols-[minmax(0,1fr)_300px]",
            compact ? "gap-y-6" : "gap-y-8",
          )}
        >
          <Sections
            g={g}
            only={["stats", "friends", "signatures"]}
            className={cn("grid content-start", compact ? "gap-6" : "gap-8")}
          />
          <Sections
            g={g}
            only={["trust", "listing"]}
            className="grid content-start gap-6 self-start rounded-xl bg-white/[0.025] p-5 ring-1 ring-white/[0.07]"
          />
        </div>
      </div>
    </main>
  );
}

/** The game opened inside the library, under the row of the tile or list row that was clicked. */
export function Expanded({ notch }: { notch?: number }) {
  const { layout, set, compact } = useWin();
  const g = findGame(layout.selected!);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest" });
  }, [g.id]);
  return (
    <div
      ref={ref}
      data-detail="expand"
      className="@container relative col-span-full scroll-my-4 animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none"
    >
      {notch !== undefined && (
        <span
          className="absolute -top-[7px] size-3.5 -translate-x-1/2 rotate-45 rounded-[3px] border-t border-l border-white/[0.09] bg-card"
          style={{ left: `${notch}%` }}
        />
      )}
      <div className="relative grid grid-cols-1 gap-x-8 gap-y-6 overflow-hidden rounded-xl bg-card p-5 ring-1 ring-white/[0.09] [--ring-bg:var(--card)] @min-[760px]:grid-cols-[minmax(0,240px)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="absolute top-3 right-3">
          <IconAction label="Close" onClick={() => set({ selected: null })}>
            <XIcon />
          </IconAction>
        </div>
        <div className="grid content-start gap-4 @max-[759px]:grid-cols-[180px_minmax(0,1fr)] @max-[759px]:gap-x-5">
          <Cover game={g} className="aspect-[16/10] w-full rounded-lg ring-1 ring-white/[0.08]" />
          <div className="min-w-0">
            <Kicker g={g} className="@min-[760px]:hidden" />
            <h2 className="mt-1 text-[22px] leading-tight font-semibold tracking-[-0.02em] @min-[760px]:hidden">
              {g.name}
            </h2>
            <div className="mt-3 @min-[760px]:mt-0">
              <Actions g={g} size="default" />
            </div>
          </div>
        </div>
        <div className={cn("grid min-w-0 content-start", compact ? "gap-4" : "gap-5")}>
          <div className="hidden pr-10 @min-[760px]:block">
            <Kicker g={g} />
            <h2 className="mt-1 text-[24px] leading-tight font-semibold tracking-[-0.02em] text-balance">
              {g.name}
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/80 text-pretty">
              {g.what}
            </p>
          </div>
          <Sections
            g={g}
            only={["trust", "listing"]}
            className={cn("grid", compact ? "gap-4" : "gap-5")}
          />
        </div>
        <Sections
          g={g}
          only={["stats", "friends", "signatures"]}
          className={cn(
            "grid min-w-0 content-start @min-[760px]:pt-9",
            compact ? "gap-4" : "gap-5",
          )}
        />
      </div>
    </div>
  );
}

/** A sheet over the library from the right; the library stays put underneath. */
export function Sheet() {
  const { layout, set, compact } = useWin();
  const g = findGame(layout.selected!);
  const close = () => set({ selected: null });
  return (
    <div className="absolute inset-0 z-30" data-detail="sheet">
      <div
        aria-hidden
        onClick={close}
        className="absolute inset-0 bg-black/45 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
      />
      <aside
        role="dialog"
        aria-label={g.name}
        className="absolute inset-y-0 right-0 flex w-[min(480px,100%)] flex-col border-l border-white/[0.08] bg-card shadow-[-24px_0_60px_-16px_rgba(0,0,0,0.7)] [--ring-bg:var(--card)] animate-in slide-in-from-right duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none"
      >
        <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-white/[0.06] pr-3 pl-5">
          <Kicker g={g} className="min-w-0 flex-1" />
          <IconAction label="More">
            <DotsThreeIcon weight="bold" />
          </IconAction>
          <IconAction label="Close" onClick={close}>
            <XIcon />
          </IconAction>
        </div>
        <div data-scroll className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
          <div className="px-5 pt-5">
            <Cover game={g} className="aspect-[16/9] w-full rounded-xl ring-1 ring-white/[0.08]" />
            <h1 className="mt-4 text-[26px] leading-tight font-semibold tracking-[-0.02em] text-balance">
              {g.name}
            </h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/80 text-pretty">
              {g.what}
            </p>
            <div className="mt-4">
              <Actions g={g} />
            </div>
          </div>
          <Sections
            g={g}
            only={["stats", "trust", "friends", "signatures", "listing"]}
            className={cn(
              "mt-6 grid divide-y divide-white/[0.06] border-t border-white/[0.06] px-5 [&>div]:py-5",
              compact && "[&>div]:py-4",
            )}
          />
        </div>
      </aside>
    </div>
  );
}
