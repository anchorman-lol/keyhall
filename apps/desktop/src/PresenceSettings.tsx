import type { PresenceMode } from "@keyhall/core/presence";
import { Badge } from "@keyhall/ui/components/badge";
import { Button } from "@keyhall/ui/components/button";
import { EyeIcon, EyeSlashIcon, UsersIcon } from "@phosphor-icons/react";
import { Launcher } from "./launcher.ts";
import { Cover } from "./Library.tsx";

const MODES = [
  {
    mode: "public",
    icon: EyeIcon,
    label: "Public",
    text: "Anyone on Nostr can see what you're playing.",
    detail: "Publishes a 30315 status under your key that expires after 3 h",
  },
  {
    mode: "friends",
    icon: UsersIcon,
    label: "Friends only",
    text: "Only people you follow can read it.",
    detail: "One event per update, encrypted to your circle key",
  },
  {
    mode: "hidden",
    icon: EyeSlashIcon,
    label: "Hidden",
    text: "Nothing is published.",
    detail: "No events",
  },
] as const;

const SHORT: Record<PresenceMode, string> = {
  public: "Public",
  friends: "Friends",
  hidden: "Hidden",
};

export function ModeToggle({ coordinate }: { coordinate: string }) {
  const { games, mode: fallback } = Launcher.useSelector((s) => s.context.presence);
  const value = games[coordinate];
  const { send } = Launcher.useActorRef();
  return (
    <span className="inline-flex gap-0.5 rounded-4xl border p-0.5">
      {([undefined, "public", "friends", "hidden"] as const).map((mode) => (
        <Button
          key={mode ?? "default"}
          size="xs"
          variant={value === mode ? "secondary" : "ghost"}
          aria-pressed={value === mode}
          onClick={() => send({ type: "presence.game", coordinate, mode })}
        >
          {mode ? SHORT[mode] : `Default · ${SHORT[fallback]}`}
        </Button>
      ))}
    </span>
  );
}

export function PresenceSettings() {
  const { presence, listings, observed, friends } = Launcher.useSelector((s) => s.context);
  const { send } = Launcher.useActorRef();
  const listed = Object.values(listings).filter(
    (g) => observed[g.coordinate] || presence.games[g.coordinate],
  );
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">Presence</h1>
      <p className="mt-2 text-muted-foreground">
        Shows “Playing …” next to your name. It updates only when a game window opens or closes, so
        each session publishes 2 events.
      </p>
      <div role="radiogroup" className="mt-6 grid grid-cols-3 gap-3">
        {MODES.map(({ mode, icon: Icon, label, text, detail }) => (
          <button
            key={mode}
            role="radio"
            aria-checked={presence.mode === mode}
            onClick={() => send({ type: "presence.mode", mode })}
            className="grid content-start gap-2 rounded-xl bg-card p-4 text-left ring-1 ring-foreground/5 transition hover:ring-primary aria-checked:ring-2 aria-checked:ring-primary"
          >
            <span className="flex items-center gap-2 font-semibold">
              <Icon className="size-5" />
              {label}
            </span>
            {mode === "friends" && <Badge variant="secondary">Default for new accounts</Badge>}
            <span className="text-sm">{text}</span>
            <small className="text-xs text-muted-foreground">{detail}</small>
          </button>
        ))}
      </div>
      <div className="mt-8 grid grid-cols-[200px_1fr] gap-6 border-t pt-6 text-sm">
        <div>
          <b>Friends are</b>
          <p className="text-muted-foreground">Who can read friends-only presence</p>
        </div>
        <p>
          Your follows{friends && ` · ${friends.length}`}
          <span className="block text-muted-foreground">
            Read from your NIP-02 follow list. Unfollowing someone rotates your circle key the next
            time you play, which re-sends it to everyone left.
          </span>
        </p>
        <div>
          <b>Per-game overrides</b>
          <p className="text-muted-foreground">Games without an override use the default</p>
        </div>
        <div className="grid gap-2">
          {listed.length ? (
            listed.map((g) => (
              <div key={g.coordinate} className="flex items-center gap-3">
                <Cover game={g} className="size-8 rounded-md text-sm" />
                <b className="flex-1 truncate">{g.name}</b>
                <ModeToggle coordinate={g.coordinate} />
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">
              Games you've played show here. You can also set one on a game's page.
            </p>
          )}
        </div>
      </div>
      <p className="mt-8 rounded-xl bg-muted p-4 text-sm">
        <b>What relays can still see:</b> an unnamed presence key posting when your sessions start
        and stop, and, once, the people your circle key was sent to.
      </p>
    </div>
  );
}
