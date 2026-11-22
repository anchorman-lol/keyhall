import { Button } from "@keyhall/ui/components/button";
import { Switch } from "@keyhall/ui/components/switch";
import { cn } from "@keyhall/ui/lib/utils";
import {
  AppWindowIcon,
  EyeIcon,
  EyeSlashIcon,
  KeyIcon,
  SignatureIcon,
  StopIcon,
} from "@phosphor-icons/react";
import { BUDGET, friend, REQUEST, RUNNING, SIGNATURES } from "../data.ts";
import { Avatar, Cover, Live, Sats } from "../kit.tsx";
import { useWin } from "./state.tsx";

const last = SIGNATURES[0]!;
const TICKS = [3, 9, 14, 21, 26, 34, 38, 47, 55, 61, 70, 76, 83, 88, 96];
const spent = BUDGET.split.reduce((s, x) => s + x.sats, 0);

function Answer({ size = "sm", className }: { size?: "xs" | "sm"; className?: string }) {
  const { set } = useWin();
  return (
    <span className={cn("flex shrink-0 gap-1.5", className)}>
      <Button size={size} variant="secondary" onClick={() => set({ signing: false })}>
        Deny
      </Button>
      <Button size={size} onClick={() => set({ signing: false })}>
        Allow
      </Button>
    </span>
  );
}

const asks = (name: string) => (
  <>
    <span className="font-medium text-foreground">{name}</span> wants to sign a kind {REQUEST.kind}{" "}
    event as you
  </>
);

/** The sidebar's now-playing card; with a signing request it becomes the request. */
export function RunningCard() {
  const { running, layout, presence, setPresence } = useWin();
  if (!running) return null;
  if (layout.signing)
    return (
      <div
        data-testid="request"
        className="rounded-xl bg-primary/[0.09] p-3 ring-1 ring-primary/30 [--ring-bg:var(--sidebar)]"
      >
        <div className="flex items-center gap-2.5">
          <Cover game={running} className="size-8 shrink-0 rounded-md" />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[13px] font-medium">{running.name}</div>
            <div className="flex items-center gap-1 text-[11px] text-primary">
              <KeyIcon weight="fill" className="size-3" /> Asks to sign
            </div>
          </div>
        </div>
        <p className="mt-2.5 text-[12px] leading-snug text-muted-foreground">
          {REQUEST.what}, kind {REQUEST.kind}. Allowing covers this kind until Keyhall quits.
        </p>
        <Answer className="mt-3 grid grid-cols-2" />
      </div>
    );
  return (
    <div className="overflow-hidden rounded-xl bg-white/[0.035] ring-1 ring-white/[0.07]">
      <div className="relative">
        <Cover game={running} className="h-[76px] w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1c1e25] via-[#1c1e25]/40 to-transparent" />
        <div className="absolute top-1.5 right-1.5 flex gap-1">
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Show game window"
            className="bg-black/50 text-white hover:bg-black/70"
          >
            <AppWindowIcon />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Quit game"
            className="bg-black/50 text-white hover:bg-black/70"
          >
            <StopIcon weight="fill" />
          </Button>
        </div>
        <div className="absolute inset-x-3 bottom-1.5 flex items-center justify-between">
          <span className="truncate text-[13px] font-semibold text-white">{running.name}</span>
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-white/80 tabular-nums">
            <Live className="size-1.5" /> {RUNNING.session}
          </span>
        </div>
      </div>
      <div className="px-3 pt-2 pb-2.5">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <SignatureIcon className="size-3.5 shrink-0 text-primary" />
          <span className="truncate">
            Signed {last.what.toLowerCase()} · {last.ago} ago
          </span>
        </div>
        <label className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Switch size="sm" checked={presence} onCheckedChange={setPresence} />
          <span className="truncate">{presence ? "Friends see you" : "Hidden from friends"}</span>
        </label>
      </div>
    </div>
  );
}

/** Full-width request strip for layouts with no running surface big enough to hold it. */
export function RequestBanner() {
  const { running } = useWin();
  if (!running) return null;
  return (
    <div
      data-testid="request"
      className="flex h-[52px] shrink-0 items-center gap-3 border-b border-primary/25 bg-primary/[0.08] px-5"
    >
      <KeyIcon weight="fill" className="size-4 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
        {asks(running.name)} · {REQUEST.what}
      </p>
      <Answer />
    </div>
  );
}

export function Dock() {
  const { running, layout, presence, setPresence } = useWin();
  if (!running) return null;
  const share = BUDGET.split.find((b) => b.game === running.id)!.sats;
  return (
    <div className="grid h-full grid-cols-[minmax(0,320px)_minmax(0,1fr)_auto] items-center gap-8 border-t border-white/[0.08] bg-[#16171d] px-5 shadow-[0_-16px_40px_-20px_rgba(0,0,0,0.7)] [--ring-bg:#16171d]">
      <div className="flex min-w-0 items-center gap-3.5">
        <Cover game={running} className="size-[52px] shrink-0 rounded-lg ring-1 ring-white/10" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold tracking-[-0.005em]">
            {running.name}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-foreground tabular-nums">
            <Live className="size-1.5" /> Running · {RUNNING.session}
          </div>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-[12px] text-muted-foreground">
          {presence ? "Friends see you" : "Hidden"}
          <Switch size="sm" checked={presence} onCheckedChange={setPresence} />
        </label>
      </div>

      {layout.signing ? (
        <div
          data-testid="request"
          className="flex min-w-0 items-center gap-3 rounded-xl bg-primary/[0.09] py-2.5 pr-2.5 pl-3.5 ring-1 ring-primary/30"
        >
          <KeyIcon weight="fill" className="size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1 leading-snug">
            <div className="truncate text-[13px] text-muted-foreground">{asks(running.name)}</div>
            <div className="truncate text-[12px] text-muted-foreground">
              {REQUEST.what} · allowing covers kind {REQUEST.kind} until Keyhall quits
            </div>
          </div>
          <Answer />
        </div>
      ) : (
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[12px]">
            <SignatureIcon className="size-4 shrink-0 text-primary" />
            <span className="truncate font-medium">Signed {last.what.toLowerCase()}</span>
            <span className="shrink-0 text-muted-foreground">
              kind {last.kind} · {last.ago} ago
            </span>
            <span className="ml-auto shrink-0 text-muted-foreground">
              14 this session, 0 denied
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums">
            <span>0:00</span>
            <div className="relative h-3 flex-1" aria-hidden>
              <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
              {TICKS.map((t, i) => (
                <span
                  key={t}
                  className={cn(
                    "absolute top-0.5 h-2 w-[3px] rounded-full",
                    i === TICKS.length - 1 ? "top-0 h-3 bg-primary" : "bg-foreground/30",
                  )}
                  style={{ left: `${t}%` }}
                />
              ))}
            </div>
            <span>{RUNNING.session}</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-6">
        {!layout.signing && (
          <div className="flex items-center gap-2.5 text-[12px]">
            <Avatar person={friend("kestrel")} size="sm" />
            <div className="leading-tight">
              <div className="font-medium">
                kestrel's best <Sats n={14200} />
              </div>
              <div className="text-muted-foreground">
                <Sats n={2160} /> to beat it
              </div>
            </div>
          </div>
        )}
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
    </div>
  );
}

export function StatusBar() {
  const { running, layout, presence, setPresence } = useWin();
  const here = layout.running === "status" ? running : null;
  return (
    <div className="flex h-full items-center gap-5 border-t border-white/[0.07] bg-sidebar pr-4 pl-3 text-[12px] [--ring-bg:var(--sidebar)]">
      {here && layout.signing ? (
        <div
          data-testid="request"
          className="-ml-1 flex h-[26px] min-w-0 items-center gap-2.5 rounded-md bg-primary/[0.12] pr-0.5 pl-2.5 ring-1 ring-primary/30"
        >
          <KeyIcon weight="fill" className="size-3.5 shrink-0 text-primary" />
          <span className="truncate text-muted-foreground">
            {asks(here.name)} · {REQUEST.what}
          </span>
          <Answer size="xs" />
        </div>
      ) : here ? (
        <div className="flex shrink-0 items-center gap-2.5">
          <Cover game={here} className="h-5 w-8 rounded-[4px]" />
          <span className="font-medium">{here.name}</span>
          <Live className="size-1.5" />
          <span className="text-muted-foreground tabular-nums">{RUNNING.session}</span>
          <button
            onClick={() => setPresence(!presence)}
            title={presence ? "Friends see you playing" : "Hidden from friends"}
            className="ml-1 grid size-6 place-items-center rounded text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
          >
            {presence ? <EyeIcon className="size-3.5" /> : <EyeSlashIcon className="size-3.5" />}
          </button>
          <button className="-ml-1 flex h-6 items-center gap-1 rounded px-1.5 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground">
            <StopIcon weight="fill" className="size-3" /> Quit
          </button>
        </div>
      ) : (
        <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
          <span className="size-1.5 rounded-full bg-online" /> Signer ready
        </span>
      )}
      <span className="h-3.5 w-px shrink-0 bg-white/10" />
      <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
        <SignatureIcon className="size-3.5 shrink-0 text-primary" />
        <span className="truncate">
          <span className="text-foreground/90">Signed {last.what.toLowerCase()}</span> · kind{" "}
          {last.kind} · {last.ago} ago
        </span>
        {!(here && layout.signing) && (
          <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-px text-[11px]">
            14 this session
          </span>
        )}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-3 text-muted-foreground">
        <span>
          {BUDGET.month} <Sats n={spent} className="text-foreground/90" /> of{" "}
          <Sats n={BUDGET.total} /> sats
        </span>
        <span className="flex h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.08]" aria-hidden>
          <span
            style={{ width: `${(spent / BUDGET.total) * 100}%` }}
            className="h-full bg-primary/80"
          />
        </span>
        <span>pays {BUDGET.paysOn}</span>
      </div>
    </div>
  );
}
