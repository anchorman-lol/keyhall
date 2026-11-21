import { Button } from "@keyhall/ui/components/button";
import { cn } from "@keyhall/ui/lib/utils";
import {
  AppWindowIcon,
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
import type { ReactNode } from "react";
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
import { lastPlayed } from "./Library.tsx";
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

const hm = (m: number) => `${Math.floor(m / 60)} h ${m % 60} m`;

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

export function Inspector() {
  const { layout, set, running, compact } = useWin();
  const g = findGame(layout.selected!);
  const wide = layout.inspector === "wide";
  const src = source(g.source);
  const isRunning = running?.id === g.id;
  const joinable = friendsIn(g.id).find(() => g.multiplayer);
  const sections = wide
    ? [
        ...layout.sections.filter((s) => s === "stats"),
        ...layout.sections.filter((s) => s !== "stats"),
      ]
    : layout.sections;
  return (
    <aside
      data-scroll
      className="@container no-scrollbar relative h-full min-h-0 min-w-0 overflow-y-auto border-l border-white/[0.06] bg-background [--ring-bg:var(--background)]"
    >
      <div
        className={cn(
          "relative",
          wide ? (compact ? "h-[260px]" : "h-[300px]") : compact ? "h-[196px]" : "h-[228px]",
        )}
      >
        <Cover game={g} className="absolute inset-0 size-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/35 to-background/0" />
        <div className="absolute top-3.5 right-3.5 flex gap-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="More"
            className="bg-black/45 text-white hover:bg-black/60"
          >
            <DotsThreeIcon weight="bold" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close"
            className="bg-black/45 text-white hover:bg-black/60"
            onClick={() => set({ selected: null })}
          >
            <XIcon />
          </Button>
        </div>
      </div>
      <div className={cn("relative -mt-14 pb-8", wide ? "px-9" : "px-6")}>
        <div className="flex items-center gap-2 text-[12px] text-foreground/75">
          <span
            className="size-2 rounded-[2px]"
            style={{ background: sourceTint(src.hue, 0.8, 0.14) }}
          />
          <span className="truncate">
            {src.name} · {g.genre}
          </span>
        </div>
        <h1
          className={cn(
            "mt-1.5 leading-[1.05] font-semibold tracking-[-0.025em] text-balance",
            wide ? "text-[36px]" : "text-[28px]",
          )}
        >
          {g.name}
        </h1>
        <p className="mt-2.5 max-w-[60ch] text-[13px] leading-relaxed text-foreground/80 text-pretty">
          {g.what}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {isRunning ? (
            <>
              <Button size="lg">
                <AppWindowIcon data-icon="inline-start" /> Show window
              </Button>
              <Button size="lg" variant="secondary">
                <StopIcon weight="fill" data-icon="inline-start" /> Quit
              </Button>
              <span className="ml-1 flex items-center gap-1.5 text-[12px] text-online tabular-nums">
                <Live className="size-1.5" /> {RUNNING.session}
              </span>
            </>
          ) : (
            <>
              <Button size="lg" className="px-5">
                <PlayIcon weight="fill" data-icon="inline-start" /> Play
              </Button>
              {joinable && (
                <Button size="lg" variant="secondary" className="[--ring-bg:var(--secondary)]">
                  <Avatar person={joinable} size="xs" className="-ml-1" /> Join {joinable.name}
                </Button>
              )}
            </>
          )}
        </div>
        {sections.length > 0 && (
          <div
            className={cn(
              "mt-7 grid grid-cols-1 gap-x-10",
              compact ? "gap-y-5" : "gap-y-6",
              wide && "@min-[700px]:grid-cols-2",
            )}
          >
            {sections.map((s) => {
              const S = SECTION[s];
              return (
                <div key={s} className={cn("min-w-0", s === "stats" && "@min-[700px]:col-span-2")}>
                  <S g={g} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
