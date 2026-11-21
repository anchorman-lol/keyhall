import { depthOf, updatedAt } from "@keyhall/core/launcher";
import type { Game } from "@keyhall/core/listing";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@keyhall/ui/components/empty";
import { DepthBadge, SignInBadge } from "./badges.tsx";
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
  const { games } = context;
  if (!games?.length)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{games ? "No games found" : "Looking for games on relays…"}</EmptyTitle>
          <EmptyDescription>Games are NIP-89 listings tagged “game” or “games”.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  return (
    <>
      <h1 className="mb-5 text-2xl font-semibold">All games</h1>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-5">
        {games.map((game) => {
          const { depth, verified } = depthOf(context, game);
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
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <SignInBadge signIn={game.signIn} />
                  <DepthBadge depth={depth} verified={verified} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
