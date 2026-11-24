import { monthKey, monthName, playTime } from "@keyhall/core/budget";
import type { Claim, Verdict } from "@keyhall/core/labels";
import {
  curatorName,
  depthOf,
  isCurator,
  library,
  monthSplit,
  observedKinds,
  playing,
  running,
  signInOf,
  sourceLabel,
  updatedAt,
  type LauncherContext,
} from "@keyhall/core/launcher";
import type { Game } from "@keyhall/core/listing";
import { Button } from "@keyhall/ui/components/button";
import { Card, CardContent } from "@keyhall/ui/components/card";
import {
  AppWindowIcon,
  ArrowLeftIcon,
  PencilSimpleIcon,
  PlayIcon,
  SealCheckIcon,
  StopIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { DEPTH, DepthBadge, SIGN_IN, SignInBadge, verifiers } from "./badges.tsx";
import { CustomDialog } from "./CustomDialog.tsx";
import { KeyDialog } from "./KeyDialog.tsx";
import { LabelDialog } from "./LabelDialog.tsx";
import { formatDate, Launcher, minutes, useNow } from "./launcher.ts";
import { FriendsPlaying } from "./Friends.tsx";
import { Cover, GameIcon, Live } from "./Library.tsx";
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

function Block({ title, end, children }: { title: string; end?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <h2 className="mb-2.5 flex items-baseline justify-between gap-3 text-[13px] font-semibold">
        {title}
        {end && <span className="text-[12px] font-normal text-muted-foreground">{end}</span>}
      </h2>
      {children}
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[20px] font-semibold tracking-[-0.015em] tabular-nums">
        {value}
      </div>
      <div className="truncate text-[12px] text-muted-foreground">{note}</div>
    </div>
  );
}

export function GamePage({ game }: { game: Game }) {
  const context = Launcher.useSelector((s) => s.context);
  const { send } = Launcher.useActorRef();
  const now = useNow();
  const signIn = signInOf(context, game);
  const depth = depthOf(context, game);
  const kinds = observedKinds(context, game);
  const calls = context.calls.filter((c) => c.coordinate === game.coordinate);
  const friends = playing(context, now).filter((p) => p.status.coordinate === game.coordinate);
  const from = library(context).find((e) => e.game.coordinate === game.coordinate)?.from ?? [];
  const run = running(context).find((r) => r.game.coordinate === game.coordinate);
  const month = monthKey(new Date(now * 1000));
  const seconds = playTime(context.sessions, month)[game.coordinate] ?? 0;
  const share = monthSplit(context, month).shares.find((s) => s.coordinate === game.coordinate);
  const entry = context.custom.find((c) => `custom:${c.id}` === game.coordinate);
  const app = game.custom === "app";
  return (
    <main className="relative h-full min-h-0 overflow-y-auto">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => send({ type: "select" })}
        className="absolute top-3 left-4 z-10 rounded-lg bg-black/45 text-white backdrop-blur-sm hover:bg-black/60"
      >
        <ArrowLeftIcon data-icon="inline-start" /> Library
      </Button>
      <div className="relative h-[400px]">
        <Cover game={game} className="absolute inset-0 size-full text-8xl" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-background/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-[1040px] items-end gap-5 px-10 pb-8">
          <GameIcon
            game={game}
            className="size-24 rounded-2xl text-4xl shadow-xl ring-1 ring-white/15"
          />
          <div className="min-w-0">
            <p className="truncate text-[12px] text-foreground/85">
              {from.map((id) => sourceLabel(context, id)).join(" · ")}
            </p>
            <h1 className="mt-1 text-[44px] leading-[1.02] font-semibold tracking-[-0.03em] text-balance">
              {game.name}
            </h1>
            {game.about && (
              <p className="mt-3 line-clamp-3 max-w-[58ch] text-[14px] leading-relaxed text-foreground/85">
                {game.about}
              </p>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {run ? (
                <>
                  <Button size="lg" onClick={() => send({ type: "play", game })}>
                    <AppWindowIcon data-icon="inline-start" /> Show {app ? "app" : "window"}
                  </Button>
                  {!app && (
                    <>
                      <Button
                        size="lg"
                        variant="secondary"
                        onClick={() => send({ type: "check", game })}
                      >
                        <SealCheckIcon data-icon="inline-start" /> Test sign-in
                      </Button>
                      <Button
                        size="lg"
                        variant="secondary"
                        onClick={() => send({ type: "quit", game })}
                      >
                        <StopIcon weight="fill" data-icon="inline-start" /> Quit
                      </Button>
                    </>
                  )}
                  {run.since && (
                    <span className="ml-1 flex items-center gap-1.5 text-[12px] text-online tabular-nums">
                      <Live /> {minutes(now - run.since)}
                    </span>
                  )}
                </>
              ) : !context.npub ? (
                <KeyDialog />
              ) : (
                <Button size="lg" className="px-5" onClick={() => send({ type: "play", game })}>
                  <PlayIcon weight="fill" data-icon="inline-start" /> Play
                </Button>
              )}
              {isCurator(context) && !entry && <LabelDialog game={game} depth={depth.value} />}
              {entry && (
                <>
                  <CustomDialog entry={entry} trigger={<Button size="lg" variant="secondary" />}>
                    <PencilSimpleIcon data-icon="inline-start" /> Edit
                  </CustomDialog>
                  {!run && (
                    <Button
                      size="lg"
                      variant="ghost"
                      onClick={() => {
                        send({ type: "custom.remove", id: entry.id });
                        send({ type: "select" });
                      }}
                    >
                      <TrashIcon data-icon="inline-start" /> Remove
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-[1040px] grid-cols-[minmax(0,1fr)_340px] gap-x-10 px-10 pt-4 pb-12">
        <div className="grid content-start gap-8">
          <Block title="Play and budget">
            <div className="grid grid-cols-2 divide-x divide-white/[0.07] rounded-xl bg-white/[0.025] ring-1 ring-white/[0.07]">
              <Stat
                label="Your play"
                value={seconds ? minutes(seconds) : "None yet"}
                note={seconds ? `in ${monthName(month)}` : "Not played this month"}
              />
              <Stat
                label="From your budget"
                value={`${(share?.sats ?? 0).toLocaleString("en")} sats`}
                note={
                  share?.sats
                    ? `${Math.round(share.percent * 100)}% of ${monthName(month)} so far`
                    : context.budget.sats
                      ? "Play it 15 minutes to give it a share"
                      : "Set a monthly budget to support games"
                }
              />
            </div>
          </Block>
          <Block title="Friends" end={friends.length ? `${friends.length} playing now` : undefined}>
            {friends.length ? (
              <FriendsPlaying coordinate={game.coordinate} />
            ) : (
              <p className="text-[12px] text-muted-foreground">No friends are playing it now.</p>
            )}
          </Block>
          {!app && (
            <Block title="Signatures" end={calls.length ? "since Keyhall started" : undefined}>
              {calls.length ? (
                <SignerLog calls={calls.slice(-8).reverse()} />
              ) : (
                <p className="text-[12px] text-muted-foreground">
                  Keyhall hasn't signed anything for it yet. Press Play, then Test sign-in.
                </p>
              )}
            </Block>
          )}
        </div>
        <Card size="sm" className="self-start">
          <CardContent className="grid gap-6">
            {!app && (
              <Block title="Sign-in trust">
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
                </dl>
              </Block>
            )}
            <Block title={entry ? "Added by you" : "Listing"}>
              <dl className="grid gap-4 text-sm">
                <Fact label="Your presence">
                  <ModeToggle coordinate={game.coordinate} />
                </Fact>
                <Fact label={entry ? "Added" : "Last updated"}>
                  {formatDate(updatedAt(context, game))}
                </Fact>
                <Fact label="Plays at">{game.url}</Fact>
              </dl>
            </Block>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
