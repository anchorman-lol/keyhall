import { Button } from "@keyhall/ui/components/button";
import { Switch } from "@keyhall/ui/components/switch";
import { cn } from "@keyhall/ui/lib/utils";
import { UserPlusIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { FRIENDS, game, ME } from "../data.ts";
import { Avatar, Cover } from "../kit.tsx";
import { useWin } from "./state.tsx";

const playing = FRIENDS.filter((f) => f.status === "ingame");
const online = FRIENDS.filter((f) => f.status === "online");
const offline = FRIENDS.filter((f) => f.status === "offline");

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="flex h-7 items-center px-2 text-[12px] font-medium text-muted-foreground">
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-px">{children}</div>
    </section>
  );
}

export function FriendsColumn() {
  const { compact, set, presence, setPresence, running } = useWin();
  return (
    <aside className="flex h-full min-h-0 min-w-0 flex-col border-l border-white/[0.06] bg-sidebar [--ring-bg:var(--sidebar)]">
      <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-white/[0.06] pr-3 pl-5">
        <span className="text-[13px] font-semibold">Friends</span>
        <span className="text-[12px] text-muted-foreground">
          {playing.length + online.length} online
        </span>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Add a friend"
          className="ml-auto text-muted-foreground"
        >
          <UserPlusIcon />
        </Button>
      </header>
      <div
        data-scroll
        className={cn(
          "no-scrollbar grid min-h-0 flex-1 grid-cols-1 content-start overflow-y-auto px-2.5",
          compact ? "gap-3 pt-2" : "gap-5 pt-3",
        )}
      >
        <Group title="Playing">
          {playing.map((f) => {
            const g = game(f.game!);
            return (
              <div
                key={f.handle}
                role="button"
                tabIndex={0}
                onClick={() => set({ selected: g.id })}
                className={cn(
                  "group/friend flex cursor-default items-center gap-3 rounded-lg px-2 hover:bg-white/[0.04]",
                  compact ? "py-1.5" : "py-2",
                )}
              >
                <Avatar person={f} dot />
                <div className="min-w-0 flex-1 leading-snug">
                  <div className="truncate text-[13px] font-medium">{f.name}</div>
                  <div className="truncate text-[12px] text-ingame">{g.name}</div>
                  {!compact && (
                    <div className="truncate text-[12px] text-muted-foreground">{f.line}</div>
                  )}
                </div>
                <Cover game={g} className="h-8 w-12 shrink-0 rounded-md ring-1 ring-white/[0.08]" />
              </div>
            );
          })}
        </Group>
        <Group title="Online">
          {online.map((f) => (
            <div
              key={f.handle}
              className={cn(
                "flex items-center gap-3 rounded-lg px-2 hover:bg-white/[0.04]",
                compact ? "h-8" : "h-9",
              )}
            >
              <Avatar person={f} dot size="sm" />
              <span className="min-w-0 flex-1 truncate text-[13px]">{f.name}</span>
              <span className="text-[11px] text-muted-foreground">In Keyhall</span>
            </div>
          ))}
        </Group>
        <Group title="Offline">
          {offline.map((f) => (
            <div
              key={f.handle}
              className={cn(
                "flex items-center gap-3 rounded-lg px-2 text-muted-foreground",
                compact ? "h-8" : "h-9",
              )}
            >
              <Avatar person={f} size="sm" className="opacity-55" />
              <span className="min-w-0 flex-1 truncate text-[13px]">{f.name}</span>
              <span className="text-[11px]">{f.game ? "2 h ago" : "3 days ago"}</span>
            </div>
          ))}
        </Group>
      </div>
      <footer className="flex shrink-0 items-center gap-3 border-t border-white/[0.06] px-4 py-3">
        <Avatar
          person={{ ...ME, status: running && presence ? "ingame" : "online" }}
          size="sm"
          dot
        />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[12px] font-medium">
            {presence
              ? running
                ? `Friends see ${running.name}`
                : "Friends see you online"
              : "Hidden from friends"}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {presence ? "Shared with 7 friends" : "Nothing is shared"}
          </div>
        </div>
        <Switch
          size="sm"
          checked={presence}
          onCheckedChange={setPresence}
          aria-label="Share what you play"
        />
      </footer>
    </aside>
  );
}
