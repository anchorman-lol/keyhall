import {
  monthKey,
  monthName,
  payouts,
  playTime,
  previousMonth,
  type Share,
} from "@keyhall/core/budget";
import { findGame, monthSplit } from "@keyhall/core/launcher";
import { Badge } from "@keyhall/ui/components/badge";
import { Button } from "@keyhall/ui/components/button";
import { Card, CardContent } from "@keyhall/ui/components/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@keyhall/ui/components/dialog";
import { Input } from "@keyhall/ui/components/input";
import { ChartPieSliceIcon, LightningIcon, TimerIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Launcher } from "./launcher.ts";
import { Cover } from "./Library.tsx";

const SHADES = ["bg-primary", "bg-primary/75", "bg-primary/55", "bg-primary/40", "bg-primary/25"];
const sats = (n: number) => n.toLocaleString("en");
const games = (n: number) => `${n} ${n === 1 ? "game" : "games"}`;
const duration = (s: number) =>
  `${Math.floor(s / 3600)} h ${String(Math.floor(s / 60) % 60).padStart(2, "0")} m`;

const REASONS = {
  floor: "Under the 15-minute floor, not counted",
  unpayable: "No payment address · its share goes to the games above",
  minimum: "Under the 100-sat minimum payout · its share goes to the games above",
};

function Settings() {
  const { budget, wallet, walletError } = Launcher.useSelector((s) => s.context);
  const connecting = Launcher.useSelector((s) => s.matches({ budget: "connecting" }));
  const { send } = Launcher.useActorRef();
  const [amount, setAmount] = useState(String(budget.sats || ""));
  const [uri, setUri] = useState("");
  return (
    <Card size="sm">
      <CardContent className="grid gap-x-8 gap-y-3 md:grid-cols-2">
        <div className="grid content-start gap-3">
          <label className="text-sm font-medium" htmlFor="budget">
            Budget
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="budget"
              type="number"
              min={0}
              className="w-36"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <span className="text-sm whitespace-nowrap text-muted-foreground">sats / month</span>
            <Button
              variant="secondary"
              disabled={Number(amount) === budget.sats || !(Number(amount) >= 0)}
              onClick={() => send({ type: "budget.set", sats: Math.floor(Number(amount)) })}
            >
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            1% stays back as a reserve for routing fees.
          </p>
        </div>
        <div className="grid content-start gap-3">
          <label className="text-sm font-medium" htmlFor="nwc">
            Wallet
          </label>
          {wallet && (
            <span className="flex items-center gap-2 text-sm">
              <Badge variant="outline">
                <LightningIcon weight="fill" data-icon="inline-start" />
                {wallet} via NWC
              </Badge>
              <span className="text-muted-foreground">Paste a new connection to replace it.</span>
            </span>
          )}
          <div className="flex gap-2">
            <Input
              id="nwc"
              type="password"
              autoComplete="off"
              placeholder="nostr+walletconnect://…"
              value={uri}
              onChange={(e) => setUri(e.target.value)}
            />
            <Button
              variant="secondary"
              disabled={!uri || connecting}
              onClick={() => {
                send({ type: "wallet.connect", uri });
                setUri("");
              }}
            >
              Connect
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Kept in the macOS keychain, never shown to a game. Give the connection a monthly budget
            in your wallet too, so the wallet enforces the cap.
          </p>
          {walletError && <p className="text-sm text-destructive">{walletError}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ share, shade, note }: { share: Share; shade?: string; note: string }) {
  const game = Launcher.useSelector((s) => findGame(s.context, share.coordinate));
  const name = game?.name ?? share.coordinate.split(":")[2] ?? share.coordinate;
  return (
    <div className="grid grid-cols-[28px_minmax(0,1.3fr)_80px_56px_minmax(0,2fr)_64px] items-center gap-3 border-t py-2 text-sm">
      {game ? (
        <Cover game={game} className="size-7 rounded-md text-xs" />
      ) : (
        <span className="size-7 rounded-md bg-muted" />
      )}
      <span className="flex items-center gap-2 truncate font-medium">
        <i className={`size-2 shrink-0 rounded-full ${shade ?? "bg-muted-foreground/30"}`} />
        {name}
      </span>
      <span className="text-right tabular-nums">{duration(share.seconds)}</span>
      <span className="text-right text-muted-foreground tabular-nums">
        {share.percent ? `${(share.percent * 100).toFixed(1)}%` : "—"}
      </span>
      <span className="truncate text-muted-foreground" title={note}>
        {note}
      </span>
      <span
        className={`text-right tabular-nums ${share.sats ? "font-semibold" : "text-muted-foreground"}`}
      >
        {sats(share.sats)}
      </span>
    </div>
  );
}

function Split({ month, running }: { month: string; running?: boolean }) {
  const context = Launcher.useSelector((s) => s.context);
  const paying = Launcher.useSelector((s) => s.matches({ budget: "paying" }));
  const { send } = Launcher.useActorRef();
  const { shares, reserve, paid, payments } = monthSplit(context, month);
  const paidShares = shares.filter((s) => s.sats);
  const total = paidShares.reduce((a, s) => a + s.sats, 0);
  const due = payments.reduce((a, p) => a + p.sats, 0);
  const how = (coordinate: string) => {
    const payTo = findGame(context, coordinate)?.payTo ?? [];
    const keys = payTo.map((r) => `${coordinate} ${r.pubkey}`);
    const error = keys.map((k) => context.payErrors[k]).find(Boolean);
    if (error) return `Failed: ${error}`;
    if (keys.every((k) => k in paid)) return "Paid";
    return payTo.length > 1
      ? `zap split · ${payTo.length} developers`
      : (payTo[0]?.lud16 ?? "zap to the developer's lightning address");
  };
  return (
    <Card size="sm">
      <CardContent>
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="font-semibold">
            {monthName(month)}{" "}
            <small className="font-normal text-muted-foreground">
              {running
                ? "· so far; you can pay it once the month is over"
                : due
                  ? "· ready to pay"
                  : total
                    ? "· paid"
                    : ""}
            </small>
          </h2>
        </div>
        {shares.length ? (
          <>
            {total > 0 && (
              <div className="mb-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
                {paidShares.map((s, i) => (
                  <span
                    key={s.coordinate}
                    className={SHADES[i % SHADES.length]}
                    style={{ flex: s.sats }}
                  />
                ))}
              </div>
            )}
            {shares.map((share) => {
              const i = paidShares.indexOf(share);
              return (
                <Row
                  key={share.coordinate}
                  share={share}
                  shade={i >= 0 ? SHADES[i % SHADES.length] : undefined}
                  note={share.reason ? REASONS[share.reason] : how(share.coordinate)}
                />
              );
            })}
            <div className="flex items-center justify-between gap-4 border-t pt-3 text-sm text-muted-foreground">
              <span>
                Total {sats(total)} sats to {games(paidShares.length)} + {sats(reserve)} sats fee
                reserve
              </span>
              {!running && due > 0 && (
                <Dialog>
                  <DialogTrigger render={<Button disabled={!context.wallet || paying} />}>
                    <LightningIcon weight="fill" data-icon="inline-start" />
                    {paying ? "Paying…" : `Pay ${sats(due)} sats`}
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        Pay {sats(due)} sats for {monthName(month)}?
                      </DialogTitle>
                      <DialogDescription>
                        Keyhall zaps each game its share through {context.wallet}, signed with a
                        throwaway key so the zaps don't name you. Lightning payments can't be
                        undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
                      <DialogClose
                        render={<Button />}
                        onClick={() => send({ type: "budget.pay", month })}
                      >
                        Pay {sats(due)} sats
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No play time this month.</p>
        )}
      </CardContent>
    </Card>
  );
}

const STEPS = [
  {
    icon: TimerIcon,
    title: "Keyhall meters play time",
    text: "Every minute a game window is open counts, idle waiting included. It's measured on this device and never published.",
  },
  {
    icon: ChartPieSliceIcon,
    title: "Your budget is split by it",
    text: "At the end of the month each game gets its share of the time you played. Games under 15 minutes aren't counted.",
  },
  {
    icon: LightningIcon,
    title: "Each game gets an anonymous zap",
    text: "Paid from your wallet over Nostr Wallet Connect once you confirm. Your key and wallet never leave Keyhall.",
  },
];

export function BudgetPage() {
  const { sessions, budget } = Launcher.useSelector((s) => s.context);
  const month = monthKey(new Date());
  const last = previousMonth(month);
  const older = payouts(budget.paid).filter((p) => p.month !== last && p.month !== month);
  const played = Object.keys(playTime(sessions, last)).length > 0;
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Monthly budget</h1>
      <ol className="mb-6 grid gap-4 md:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3">
            <Icon className="mt-0.5 size-5 shrink-0 text-primary" weight="duotone" />
            <div>
              <h2 className="text-sm font-medium">{title}</h2>
              <p className="text-sm text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ol>
      <Settings />
      <div className="mt-8 grid gap-5">
        <Split month={month} running />
        <h2 className="mt-3 font-semibold">Past payouts</h2>
        {played && <Split month={last} />}
        {older.map((p) => (
          <div key={p.month} className="flex justify-between border-t pt-3 text-sm">
            <span>{monthName(p.month)}</span>
            <span className="text-muted-foreground tabular-nums">
              {sats(p.sats)} sats to {games(p.games)}
            </span>
          </div>
        ))}
        {!played && !older.length && (
          <p className="text-sm text-muted-foreground">Nothing paid yet.</p>
        )}
      </div>
    </>
  );
}
