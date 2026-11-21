import type { Claim, Verdict } from "@keyhall/core/labels";
import {
  curatorName,
  depthOf,
  isCurator,
  observedKinds,
  signInOf,
  updatedAt,
  type LauncherContext,
} from "@keyhall/core/launcher";
import type { Game } from "@keyhall/core/listing";
import { Button } from "@keyhall/ui/components/button";
import { Card, CardContent } from "@keyhall/ui/components/card";
import { PlayIcon, SealCheckIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { DEPTH, DepthBadge, SIGN_IN, SignInBadge, verifiers } from "./badges.tsx";
import { LabelDialog } from "./LabelDialog.tsx";
import { formatDate, Launcher } from "./launcher.ts";
import { FriendsPlaying } from "./Friends.tsx";
import { Cover } from "./Library.tsx";
import { ModeToggle } from "./PresenceSettings.tsx";
import { SignerLog } from "./SignerLog.tsx";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

function Checks<T extends string>({
  verdict,
  label,
  context,
}: {
  verdict: Verdict<T>;
  label: (claim: Claim<T>) => string;
  context: LauncherContext;
}) {
  const by = verifiers(context, verdict);
  const said = (c: Claim<T>) =>
    c.from === "window"
      ? label(c)
      : `${c.from === "listing" ? "The listing" : curatorName(context, c.from)} says ${label(c)}.`;
  return (
    <>
      {by && <span className="block text-emerald-300">Verified by {by}.</span>}
      {verdict.conflicts.map((c) => (
        <span key={c.from} className="block text-amber-300">
          {said(c)}
        </span>
      ))}
    </>
  );
}

const seenSignIn = ({ value }: Claim<string>) =>
  value === "signer"
    ? "The game window saw it sign in through Keyhall."
    : "The game window saw a field asking for a private key.";

export function GamePage({ game }: { game: Game }) {
  const context = Launcher.useSelector((s) => s.context);
  const { send } = Launcher.useActorRef();
  const signIn = signInOf(context, game);
  const depth = depthOf(context, game);
  const kinds = observedKinds(context, game);
  const calls = context.calls.filter((c) => c.coordinate === game.coordinate);
  return (
    <>
      <div className="mt-2 grid grid-cols-[220px_1fr] gap-7">
        <Cover game={game} className="aspect-square w-full rounded-xl" />
        <div className="self-center">
          <h1 className="text-3xl font-semibold">{game.name}</h1>
          <p className="mt-2 max-w-prose text-muted-foreground">{game.about}</p>
          <div className="mt-3">
            <FriendsPlaying coordinate={game.coordinate} />
          </div>
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
            {isCurator(context) && <LabelDialog game={game} depth={depth.value} />}
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
                <SignInBadge verdict={signIn} by={verifiers(context, signIn)} />{" "}
                {SIGN_IN[signIn.value!].text}
                <Checks
                  verdict={signIn}
                  context={context}
                  label={(c) => (c.from === "window" ? seenSignIn(c) : SIGN_IN[c.value].label)}
                />
              </Fact>
              <Fact label="Nostr depth">
                {depth.value ? (
                  <>
                    <DepthBadge verdict={depth} by={verifiers(context, depth)} />{" "}
                    {depth.seen
                      ? "Seen in the game window. "
                      : depth.verifiedBy.length
                        ? ""
                        : "Declared by the listing. "}
                    {DEPTH[depth.value].text}
                  </>
                ) : (
                  "Not declared yet; play to find out."
                )}
                <Checks verdict={depth} context={context} label={(c) => DEPTH[c.value].label} />
                {kinds.length > 0 && (
                  <span className="block text-muted-foreground">
                    Kinds seen: {kinds.join(", ")}
                  </span>
                )}
              </Fact>
              <Fact label="Your presence">
                <ModeToggle coordinate={game.coordinate} />
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
