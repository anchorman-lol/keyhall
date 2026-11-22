import { findGame, playing } from "@keyhall/core/launcher";
import { friendName, type Friend } from "@keyhall/core/presence";
import { EyeIcon } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import { Launcher } from "./launcher.ts";
import { GameIcon } from "./Library.tsx";

export function Avatar({
  friend,
  className = "size-7",
  fallback = friendName(friend).slice(0, 1),
}: {
  friend: Friend;
  className?: string;
  fallback?: ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  return friend.picture && !broken ? (
    <img
      src={friend.picture}
      alt=""
      onError={() => setBroken(true)}
      className={`shrink-0 rounded-full object-cover ${className}`}
    />
  ) : (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold uppercase ${className}`}
    >
      {fallback}
    </span>
  );
}

const MODE = { public: "Public", friends: "Friends only", hidden: "Hidden" };

export function FriendsColumn() {
  const context = Launcher.useSelector((s) => s.context);
  const { send } = Launcher.useActorRef();
  const { friends, presence } = context;
  const active = playing(context);
  const idle = (friends ?? []).filter((f) => !active.some((p) => p.friend === f));
  const heading = "flex h-7 items-center px-2 text-[12px] font-medium text-muted-foreground";
  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-white/[0.06] bg-sidebar">
      <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-white/[0.06] px-5">
        <span className="text-[13px] font-semibold">Friends</span>
        {active.length > 0 && (
          <span className="text-[12px] text-muted-foreground">{active.length} playing</span>
        )}
      </header>
      <div className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto px-2.5 pt-3 pb-3">
        {!friends ? (
          <p className="px-2 text-[13px] text-muted-foreground">Your follows show here.</p>
        ) : !friends.length ? (
          <p className="px-2 text-[13px] text-muted-foreground">You don't follow anyone yet.</p>
        ) : (
          <>
            {active.length > 0 && (
              <section>
                <h3 className={heading}>Playing</h3>
                {active.map(({ friend, status }) => {
                  const game = status.coordinate && findGame(context, status.coordinate);
                  return (
                    <button
                      key={friend.pubkey}
                      disabled={!game}
                      onClick={() => game && send({ type: "select", game })}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left enabled:hover:bg-white/[0.04]"
                    >
                      <Avatar friend={friend} className="size-8" />
                      <span className="grid min-w-0 flex-1 gap-0.5 leading-snug">
                        <span className="truncate text-[13px] font-medium">
                          {friendName(friend)}
                        </span>
                        <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-ingame">
                          {game && (
                            <GameIcon game={game} className="size-4 rounded-[4px] text-[9px]" />
                          )}
                          <span className="truncate">{game ? game.name : status.content}</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </section>
            )}
            <section>
              <h3 className={heading}>Follows</h3>
              {idle.map((friend) => (
                <div key={friend.pubkey} className="flex h-9 items-center gap-3 px-2">
                  <Avatar friend={friend} className="size-6" />
                  <span className="truncate text-[13px] text-foreground/80">
                    {friendName(friend)}
                  </span>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
      <button
        onClick={() => send({ type: "view", view: "settings" })}
        className="flex shrink-0 items-center gap-2 border-t border-white/[0.06] px-5 py-3 text-left text-[12px] text-muted-foreground hover:text-foreground"
      >
        <EyeIcon className="size-4" />
        <span className="flex-1">Your presence</span>
        <span className="text-foreground/90">{MODE[presence.mode]}</span>
      </button>
    </aside>
  );
}

export function FriendsPlaying({ coordinate }: { coordinate: string }) {
  const here = playing(Launcher.useSelector((s) => s.context)).filter(
    (p) => p.status.coordinate === coordinate,
  );
  if (!here.length) return null;
  return (
    <span className="flex items-center gap-1.5 text-xs text-primary">
      <span className="flex -space-x-1.5">
        {here.slice(0, 3).map(({ friend }) => (
          <Avatar key={friend.pubkey} friend={friend} className="size-5 ring-2 ring-card" />
        ))}
      </span>
      <span className="truncate">
        {friendName(here[0]!.friend)}
        {here.length > 1 && ` +${here.length - 1}`} playing
      </span>
    </span>
  );
}
