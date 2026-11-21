import { depthOf, observedKinds, updatedAt } from "@keyhall/core/launcher";
import type { Game } from "@keyhall/core/listing";
import { Badge } from "@keyhall/ui/components/badge";
import { Button } from "@keyhall/ui/components/button";
import { Card, CardContent } from "@keyhall/ui/components/card";
import { PlayIcon, SealCheckIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { DEPTH, SIGN_IN, SignInBadge } from "./badges.tsx";
import { formatDate, Launcher } from "./launcher.ts";
import { Cover } from "./Library.tsx";
import { SignerLog } from "./SignerLog.tsx";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

export function GamePage({ game }: { game: Game }) {
  const context = Launcher.useSelector((s) => s.context);
  const { send } = Launcher.useActorRef();
  const { depth, verified } = depthOf(context, game);
  const kinds = observedKinds(context, game);
  const calls = context.calls.filter((c) => c.coordinate === game.coordinate);
  return (
    <>
      <div className="mt-2 grid grid-cols-[220px_1fr] gap-7">
        <Cover game={game} className="aspect-square w-full rounded-xl" />
        <div className="self-center">
          <h1 className="text-3xl font-semibold">{game.name}</h1>
          <p className="mt-2 max-w-prose text-muted-foreground">{game.about}</p>
          <div className="mt-5 flex gap-2">
            <Button size="lg" onClick={() => send({ type: "play", game })}>
              <PlayIcon weight="fill" data-icon="inline-start" />
              Play
            </Button>
            <Button
              size="lg"
              variant="secondary"
              disabled={!context.windows[game.coordinate]}
              onClick={() => send({ type: "check", game })}
            >
              <SealCheckIcon data-icon="inline-start" />
              Test sign-in
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-[1fr_320px] gap-8">
        <section>
          <h2 className="mb-3 font-semibold">Signer calls</h2>
          {calls.length ? (
            <SignerLog calls={calls} />
          ) : (
            <p className="text-sm text-muted-foreground">
              None yet. Press Play, then Test sign-in.
            </p>
          )}
        </section>
        <Card size="sm">
          <CardContent>
            <dl className="grid gap-4 text-sm">
              <Fact label="Sign-in">
                <SignInBadge signIn={game.signIn} /> {SIGN_IN[game.signIn].text}
              </Fact>
              <Fact label="Nostr depth">
                {depth ? (
                  <>
                    <Badge variant="depth">{DEPTH[depth].label}</Badge>{" "}
                    {verified ? "Seen in the game window. " : "Declared by the listing. "}
                    {DEPTH[depth].text}
                  </>
                ) : (
                  "Not declared yet; play to find out."
                )}
                {kinds.length > 0 && (
                  <span className="block text-muted-foreground">
                    Kinds seen: {kinds.join(", ")}
                  </span>
                )}
              </Fact>
              <Fact label="Last updated">{formatDate(updatedAt(context, game))}</Fact>
              <Fact label="Plays at">{game.url}</Fact>
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
