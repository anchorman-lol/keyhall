import { depthOf, library, signInOf, sourceLabel, updatedAt } from "@keyhall/core/launcher";
import type { Game } from "@keyhall/core/listing";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@keyhall/ui/components/empty";
import { DepthBadge, SignInBadge, verifiers } from "./badges.tsx";
import { FriendsPlaying } from "./Friends.tsx";
import { formatDate, Launcher } from "./launcher.ts";

export function Cover({ game, className }: { game: Game; className: string }) {
  const art = game.banner ?? game.picture;
  return art ? (
    <img src={art} alt="" className={`bg-muted object-cover ${className}`} />
  ) : (
    <div className={`grid place-items-center bg-muted text-6xl text-muted-foreground ${className}`}>
      {game.name.slice(0, 1)}
    </div>
  );
}

export function Library() {
  const context = Launcher.useSelector((s) => s.context);
  const { send } = Launcher.useActorRef();
  const entries = library(context);
  if (!entries.length)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>
            {context.loading.length ? "Looking for games on relays…" : "No games in your sources"}
          </EmptyTitle>
          <EmptyDescription>
            Switch on a source, add a curator's list or show unvetted listings.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  return (
    <>
      <h1 className="mb-5 text-2xl font-semibold">All games</h1>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-5">
        {entries.map(({ game, from }) => {
          const signIn = signInOf(context, game);
          const depth = depthOf(context, game);
          return (
            <button
              key={game.coordinate}
              onClick={() => send({ type: "select", game })}
              className="group flex flex-col overflow-hidden rounded-xl bg-card text-left ring-1 ring-foreground/5 transition hover:ring-2 hover:ring-primary"
            >
              <Cover game={game} className="aspect-square w-full" />
              <div className="grid gap-1 p-3">
                <strong className="truncate">{game.name}</strong>
                <span className="text-xs text-muted-foreground">
                  Updated {formatDate(updatedAt(context, game))}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {from.map((id) => sourceLabel(context, id)).join(" · ")}
                </span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <SignInBadge verdict={signIn} by={verifiers(context, signIn)} />
                  <DepthBadge verdict={depth} by={verifiers(context, depth)} />
                </div>
                <FriendsPlaying coordinate={game.coordinate} />
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
