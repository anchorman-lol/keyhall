import { READS, WRITES, type Relay, type Use } from "@keyhall/core/relaySettings";
import { Button } from "@keyhall/ui/components/button";
import { Input } from "@keyhall/ui/components/input";
import { Switch } from "@keyhall/ui/components/switch";
import { cn } from "@keyhall/ui/lib/utils";
import { PlusIcon, XIcon } from "@phosphor-icons/react";
import { Launcher } from "./launcher.ts";

const USES: Record<Use, [string, string]> = {
  listings: ["Game listings", "Unvetted listings, games in lists, repo updates"],
  lists: ["Picks & curator lists", "Lists and curators' sign-in labels"],
  social: ["Friends & presence", "Follows, profiles and friends' status"],
  presence: ["Presence & profile", "Your profile, playing status and circle keys"],
  labels: ["Curator labels", "Sign-in labels you publish"],
  zaps: ["Zap receipts", "Where wallets post receipts for your zaps"],
};

const STATUS = {
  connected: ["bg-online", "Connected"],
  failed: ["bg-destructive", "Unreachable"],
  checking: ["animate-pulse bg-muted-foreground", "Connecting…"],
} as const;

function Status({ relay }: { relay: Relay }) {
  const status = Launcher.useSelector((s) => s.context.relayStatus[relay.url]);
  const [color, label] = relay.enabled && status ? STATUS[status] : ["bg-muted", "Off"];
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className={cn("size-1.5 rounded-full", color)} />
      {label}
    </span>
  );
}

function Uses({ relay, title, uses }: { relay: Relay; title: string; uses: readonly Use[] }) {
  const { send } = Launcher.useActorRef();
  const on: readonly Use[] = [...relay.read, ...relay.write];
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{title}</span>
      <div className="flex flex-wrap gap-1.5">
        {uses.map((use) => (
          <button
            key={use}
            title={USES[use][1]}
            aria-pressed={on.includes(use)}
            disabled={!relay.enabled}
            onClick={() => send({ type: "relay.use", url: relay.url, use, on: !on.includes(use) })}
            className="h-7 rounded-full px-3 text-xs text-muted-foreground ring-1 ring-white/10 hover:text-foreground disabled:opacity-50 aria-pressed:bg-primary/[0.12] aria-pressed:text-primary aria-pressed:ring-primary/30"
          >
            {USES[use][0]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function RelaySettings() {
  const { relays, relayError } = Launcher.useSelector((s) => s.context);
  const { send } = Launcher.useActorRef();
  return (
    <section id="relays" className="max-w-3xl">
      <h1 className="text-2xl font-semibold">Relays</h1>
      <p className="mt-2 text-muted-foreground">
        Keyhall reads games, lists and friends from these relays and publishes to them. Pick what
        each one is used for. Changing them loads your library again.
      </p>
      <ul className="mt-6 grid gap-3">
        {relays.map((relay) => (
          <li
            key={relay.url}
            className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/5"
          >
            <div className="flex items-center gap-3">
              <Switch
                checked={relay.enabled}
                onCheckedChange={() => send({ type: "relay.toggle", url: relay.url })}
                aria-label={relay.url}
              />
              <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{relay.url}</span>
              <Status relay={relay} />
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={`Remove ${relay.url}`}
                onClick={() => send({ type: "relay.remove", url: relay.url })}
              >
                <XIcon />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4 pl-12">
              <Uses relay={relay} title="Reads" uses={READS} />
              <Uses relay={relay} title="Publishes" uses={WRITES} />
            </div>
          </li>
        ))}
      </ul>
      {!relays.length && (
        <p className="mt-4 text-sm text-muted-foreground">No relays. Add one to load games.</p>
      )}
      <form
        className="mt-4 flex max-w-md gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem("relay") as HTMLInputElement;
          send({ type: "relay.add", input: input.value });
          input.value = "";
        }}
      >
        <Input
          name="relay"
          placeholder="wss://relay.example.com"
          aria-label="Relay address"
          aria-invalid={!!relayError}
          className="h-8 text-xs"
        />
        <Button type="submit" size="sm" variant="secondary">
          <PlusIcon data-icon="inline-start" />
          Add relay
        </Button>
      </form>
      {relayError && <p className="mt-1.5 text-xs text-destructive">{relayError}</p>}
    </section>
  );
}

export function RelayToggles() {
  const { relays } = Launcher.useSelector((s) => s.context);
  const { send } = Launcher.useActorRef();
  return (
    <>
      <ul className="grid gap-1 py-1.5">
        {relays.map((relay) => (
          <li key={relay.url} className="flex items-center gap-2 px-3 py-1 text-sm">
            <Switch
              size="sm"
              checked={relay.enabled}
              onCheckedChange={() => send({ type: "relay.toggle", url: relay.url })}
              aria-label={relay.url}
            />
            <span className="min-w-0 flex-1 truncate">{relay.url.replace("wss://", "")}</span>
            <Status relay={relay} />
          </li>
        ))}
      </ul>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start"
        onClick={() => send({ type: "view", view: "relays" })}
      >
        Relay settings…
      </Button>
    </>
  );
}
