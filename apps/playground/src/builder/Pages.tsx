import { Button } from "@keyhall/ui/components/button";
import { Switch } from "@keyhall/ui/components/switch";
import { cn } from "@keyhall/ui/lib/utils";
import { UserPlusIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { BUDGET, FRIENDS, game, ME } from "../data.ts";
import { Avatar, Cover, Sats } from "../kit.tsx";
import { useWin } from "./state.tsx";

const spent = BUDGET.split.reduce((s, x) => s + x.sats, 0);

function Frame({
  title,
  meta,
  action,
  children,
}: {
  title: string;
  meta: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="@container flex h-full min-h-0 min-w-0 flex-col bg-background [--ring-bg:var(--background)]">
      <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-white/[0.06] px-6">
        <h1 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h1>
        <span className="truncate text-[13px] text-muted-foreground">{meta}</span>
        <span className="ml-auto">{action}</span>
      </header>
      <div data-scroll className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[880px] px-8 pt-6 pb-12">{children}</div>
      </div>
    </main>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="mt-8 mb-3 text-[13px] font-semibold first:mt-0">{children}</h2>;
}

function FriendsPage() {
  const { open, presence, setPresence, running } = useWin();
  const playing = FRIENDS.filter((f) => f.status === "ingame");
  const rest = FRIENDS.filter((f) => f.status !== "ingame");
  return (
    <Frame
      title="Friends"
      meta={`${FRIENDS.filter((f) => f.status !== "offline").length} online`}
      action={
        <Button variant="secondary" size="sm" className="rounded-lg">
          <UserPlusIcon data-icon="inline-start" /> Add a friend
        </Button>
      }
    >
      <div className="flex items-center gap-3 rounded-xl bg-white/[0.025] px-4 py-3 ring-1 ring-white/[0.07]">
        <Avatar person={{ ...ME, status: presence ? "ingame" : "online" }} dot />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[13px] font-medium">
            {presence
              ? running
                ? `Friends see you in ${running.name}`
                : "Friends see you online"
              : "Hidden from friends"}
          </div>
          <div className="text-[12px] text-muted-foreground">
            Shared with the 7 people you follow back
          </div>
        </div>
        <Switch checked={presence} onCheckedChange={setPresence} aria-label="Share what you play" />
      </div>
      <Heading>Playing now</Heading>
      <div className="grid grid-cols-1 gap-3 @min-[640px]:grid-cols-3">
        {playing.map((f) => {
          const g = game(f.game!);
          return (
            <button
              key={f.handle}
              onClick={() => open(g.id)}
              className="group/card overflow-hidden rounded-xl bg-card text-left ring-1 ring-white/[0.07] outline-none hover:ring-white/20 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Cover game={g} className="aspect-[16/8] w-full" />
              <div className="flex items-center gap-2.5 px-3.5 py-3">
                <Avatar person={f} size="sm" dot />
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-[13px] font-medium">{f.name}</div>
                  <div className="truncate text-[12px] text-ingame">{g.name}</div>
                </div>
              </div>
              <div className="truncate px-3.5 pb-3 text-[12px] text-muted-foreground">{f.line}</div>
            </button>
          );
        })}
      </div>
      <Heading>Everyone</Heading>
      <div className="grid divide-y divide-white/[0.05]">
        {rest.map((f) => (
          <div key={f.handle} className="flex h-12 items-center gap-3">
            <Avatar
              person={f}
              size="sm"
              dot
              className={cn(f.status === "offline" && "opacity-55")}
            />
            <span className="min-w-0 flex-1 truncate text-[13px]">{f.name}</span>
            <span className="truncate text-[12px] text-muted-foreground">{f.line}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function BudgetPage() {
  const { open } = useWin();
  const top = BUDGET.split[0]!.sats;
  return (
    <Frame title="Budget" meta={`${BUDGET.month} · pays ${BUDGET.paysOn}`}>
      <div className="grid grid-cols-3 divide-x divide-white/[0.07] rounded-xl bg-white/[0.025] ring-1 ring-white/[0.07]">
        {[
          [
            "This month",
            <>
              <Sats n={BUDGET.total} /> sats
            </>,
            "set in Settings",
          ],
          [
            "Shared out so far",
            <>
              <Sats n={spent} /> sats
            </>,
            `across ${BUDGET.split.length} games`,
          ],
          ["Pays out", BUDGET.paysOn, `${BUDGET.daysLeft} days left`],
        ].map(([label, value, hint]) => (
          <div key={String(label)} className="min-w-0 px-5 py-4">
            <div className="text-[12px] text-muted-foreground">{label}</div>
            <div className="mt-0.5 text-[20px] font-semibold tracking-[-0.015em] tabular-nums">
              {value}
            </div>
            <div className="truncate text-[12px] text-muted-foreground">{hint}</div>
          </div>
        ))}
      </div>
      <Heading>Where it goes</Heading>
      <p className="-mt-1 mb-3 max-w-[64ch] text-[12px] leading-relaxed text-muted-foreground">
        Split by the time you played. On {BUDGET.paysOn} each game's developer is zapped its share.
      </p>
      <div className="grid gap-px">
        {BUDGET.split.map((b) => {
          const g = game(b.game);
          return (
            <button
              key={b.game}
              onClick={() => open(g.id)}
              className="grid h-11 grid-cols-[48px_minmax(0,180px)_minmax(0,1fr)_80px] items-center gap-4 rounded-lg px-2 text-left hover:bg-white/[0.035]"
            >
              <Cover game={g} className="h-7 w-12 rounded-md" />
              <span className="truncate text-[13px]">{g.name}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <span
                  className="block h-full rounded-full bg-primary/80"
                  style={{ width: `${(b.sats / top) * 100}%` }}
                />
              </span>
              <span className="text-right text-[12px] text-muted-foreground tabular-nums">
                <Sats n={b.sats} className="text-foreground" /> sats
              </span>
            </button>
          );
        })}
      </div>
    </Frame>
  );
}

function Setting({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center gap-6 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[13px]">{label}</div>
        <div className="text-[12px] text-muted-foreground">{hint}</div>
      </div>
      {children}
    </div>
  );
}

function SettingsPage() {
  const { presence, setPresence } = useWin();
  return (
    <Frame title="Settings" meta="Signer, sharing, budget">
      <Heading>Signer</Heading>
      <div className="grid divide-y divide-white/[0.05]">
        <Setting label="Your key" hint="Kept in the macOS keychain; games only see signatures">
          <span className="font-mono text-[12px] text-muted-foreground">{ME.npub}</span>
        </Setting>
        <Setting
          label="Ask for each new kind"
          hint="A game asks once per event kind it wants signed"
        >
          <Switch defaultChecked aria-label="Ask for each new kind" />
        </Setting>
        <Setting
          label="Forget allowed kinds when Keyhall quits"
          hint="Otherwise they stay allowed per game"
        >
          <Switch defaultChecked aria-label="Forget allowed kinds" />
        </Setting>
      </div>
      <Heading>Sharing</Heading>
      <div className="grid divide-y divide-white/[0.05]">
        <Setting
          label="Show friends what I play"
          hint="Publishes your current game to people you follow back"
        >
          <Switch
            checked={presence}
            onCheckedChange={setPresence}
            aria-label="Show friends what I play"
          />
        </Setting>
      </div>
      <Heading>Budget</Heading>
      <div className="grid divide-y divide-white/[0.05]">
        <Setting label="Monthly budget" hint={`Shared out by play time on ${BUDGET.paysOn}`}>
          <span className="text-[13px] tabular-nums">
            <Sats n={BUDGET.total} /> sats
          </span>
        </Setting>
        <Setting label="Wallet" hint="Nostr Wallet Connect">
          <span className="flex items-center gap-1.5 text-[12px] text-online">
            <span className="size-1.5 rounded-full bg-online" /> Connected
          </span>
        </Setting>
      </div>
    </Frame>
  );
}

export function OtherPage() {
  const { layout } = useWin();
  if (layout.page === "friends") return <FriendsPage />;
  if (layout.page === "budget") return <BudgetPage />;
  return <SettingsPage />;
}
