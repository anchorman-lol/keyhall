import { playing } from "@keyhall/core/launcher";
import { friendName, type Friend } from "@keyhall/core/presence";
import { Launcher } from "./launcher.ts";

function Avatar({ friend, className = "size-7" }: { friend: Friend; className?: string }) {
  return friend.picture ? (
    <img
      src={friend.picture}
      alt=""
      className={`shrink-0 rounded-full object-cover ${className}`}
    />
  ) : (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold uppercase ${className}`}
    >
      {friendName(friend).slice(0, 1)}
    </span>
  );
}

export function FriendsPanel() {
  const context = Launcher.useSelector((s) => s.context);
  const { friends } = context;
  const active = playing(context);
  const idle = (friends ?? []).filter((f) => !active.some((p) => p.friend === f));
  const row = (friend: Friend, status?: string) => (
    <li key={friend.pubkey} className="flex min-w-0 items-center gap-2 px-2 py-1">
      <Avatar friend={friend} />
      <span className="grid min-w-0 text-sm leading-tight">
        <span className="truncate font-medium">{friendName(friend)}</span>
        {status && <span className="truncate text-xs text-primary">{status}</span>}
      </span>
    </li>
  );
  if (!friends)
    return <p className="px-2 text-sm text-muted-foreground">Your follows show here.</p>;
  if (!friends.length)
    return <p className="px-2 text-sm text-muted-foreground">You don't follow anyone yet.</p>;
  return (
    <ul className="max-h-72 overflow-y-auto">
      {active.map(({ friend, status }) => row(friend, status.content))}
      {idle.map((friend) => row(friend))}
    </ul>
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
