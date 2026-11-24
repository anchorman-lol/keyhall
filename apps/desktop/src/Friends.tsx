import { findGame, playing } from "@keyhall/core/launcher";
import { friendName, type Friend } from "@keyhall/core/presence";
import { Popover, PopoverContent, PopoverTrigger } from "@keyhall/ui/components/popover";
import { CaretRightIcon, ChatCircleIcon, CheckIcon, EyeIcon } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import { DmDialog } from "./DmDialog.tsx";
import { Launcher } from "./launcher.ts";
import { GameIcon } from "./Library.tsx";
import { MODES } from "./PresenceSettings.tsx";

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

function MessageButton({ friend, onClick }: { friend: Friend; onClick(): void }) {
  return (
    <button
      aria-label={`Message ${friendName(friend)}`}
      onClick={onClick}
      className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-white/[0.06] hover:text-foreground focus-visible:opacity-100"
    >
      <ChatCircleIcon className="size-4" />
    </button>
  );
}

export function FriendsColumn() {
  const context = Launcher.useSelector((s) => s.context);
  const { send } = Launcher.useActorRef();
  const { friends, presence } = context;
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState<Friend>();
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
                    <div key={friend.pubkey} className="group flex items-center pr-1">
                      <button
                        disabled={!game}
                        onClick={() => game && send({ type: "select", game })}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left enabled:hover:bg-white/[0.04]"
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
                      <MessageButton friend={friend} onClick={() => setChat(friend)} />
                    </div>
                  );
                })}
              </section>
            )}
            <section>
              <h3 className={heading}>Follows</h3>
              {idle.map((friend) => (
                <div key={friend.pubkey} className="group flex h-9 items-center gap-3 pr-1 pl-2">
                  <Avatar friend={friend} className="size-6" />
                  <span className="flex-1 truncate text-[13px] text-foreground/80">
                    {friendName(friend)}
                  </span>
                  <MessageButton friend={friend} onClick={() => setChat(friend)} />
                </div>
              ))}
            </section>
          </>
        )}
      </div>
      <DmDialog friend={chat} onClose={() => setChat(undefined)} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="flex shrink-0 items-center gap-2 border-t border-white/[0.06] px-5 py-3 text-left text-[12px] text-muted-foreground hover:text-foreground data-popup-open:text-foreground">
          <EyeIcon className="size-4" />
          <span className="flex-1">Your presence</span>
          <span className="text-foreground/90">
            {MODES.find((m) => m.mode === presence.mode)!.label}
          </span>
        </PopoverTrigger>
        <PopoverContent side="top" align="end" className="w-64 gap-0 rounded-xl p-1.5">
          <div
            role="radiogroup"
            aria-label="Your presence"
            className="mb-1 border-b border-white/[0.06] pb-1"
          >
            {MODES.map(({ mode, icon: Icon, label, text }) => (
              <button
                key={mode}
                role="radio"
                aria-checked={presence.mode === mode}
                onClick={() => send({ type: "presence.mode", mode })}
                className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-white/[0.05]"
              >
                <Icon className="mt-0.5 size-4 shrink-0" />
                <span className="grid min-w-0 flex-1 gap-0.5 leading-tight">
                  <span className="text-[13px]">{label}</span>
                  <span className="text-[11px] text-muted-foreground">{text}</span>
                </span>
                {presence.mode === mode && (
                  <CheckIcon weight="bold" className="mt-0.5 size-3.5 text-primary" />
                )}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setOpen(false);
              send({ type: "view", view: "settings" });
            }}
            className="flex h-9 w-full items-center gap-1 rounded-lg px-2 text-left text-[12px] text-muted-foreground hover:text-foreground"
          >
            <span className="flex-1">Presence settings</span>
            <CaretRightIcon className="size-3.5" />
          </button>
        </PopoverContent>
      </Popover>
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
