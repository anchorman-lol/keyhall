import type { panels } from "@keyhall/core/launcher";
import { friendName } from "@keyhall/core/presence";
import { combo } from "@keyhall/core/shim";
import { Button } from "@keyhall/ui/components/button";
import { ChatCircleIcon, XIcon } from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { Avatar } from "./Friends.tsx";
import { Launcher, minutes, useNow } from "./launcher.ts";

const close = () => void invoke("close_panel");

export function Overlay({ game, since, hotkey, friends }: ReturnType<typeof panels.overlay>) {
  const now = useNow();
  useEffect(() => {
    document.body.style.background = "transparent";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || combo(e) === hotkey) close();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [hotkey]);
  return (
    <div
      onClick={(e) => e.target === e.currentTarget && close()}
      className="grid h-screen place-items-center bg-black/65 text-[13px]"
    >
      <div className="grid w-[420px] gap-5 rounded-2xl bg-background p-6 shadow-2xl ring-1 ring-foreground/10">
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold">{game}</h1>
            <p className="text-muted-foreground">
              {since ? `Playing for ${minutes(now - since)}` : "Playing"}
            </p>
          </div>
          <Button size="icon-sm" variant="ghost" aria-label="Back to the game" onClick={close}>
            <XIcon />
          </Button>
        </header>
        <section className="grid gap-2">
          <h2 className="text-xs font-medium text-muted-foreground uppercase">Friends playing</h2>
          {friends.length ? (
            friends.map(({ friend, status }) => (
              <div key={friend.pubkey} className="flex items-center gap-3">
                <Avatar friend={friend} />
                <span className="truncate font-medium">{friendName(friend)}</span>
                <span className="ml-auto truncate text-ingame">{status.content}</span>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">None of your friends are playing right now.</p>
          )}
        </section>
        <Button variant="secondary" disabled>
          <ChatCircleIcon /> Messages · soon
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {hotkey} or Esc goes back to the game
        </p>
      </div>
    </div>
  );
}

export function OverlayHotkey() {
  const hotkey = Launcher.useSelector((s) => s.context.hotkey);
  const { send } = Launcher.useActorRef();
  const [recording, setRecording] = useState(false);
  return (
    <section>
      <h2 className="text-xl font-semibold">In-game overlay</h2>
      <p className="mt-2 text-muted-foreground">
        Press this in a game window to open Keyhall over the game. Games opened after a change use
        the new key.
      </p>
      <Button
        className="mt-4"
        variant="secondary"
        onClick={() => setRecording(true)}
        onBlur={() => setRecording(false)}
        onKeyDown={(e) => {
          if (!recording || ["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
          e.preventDefault();
          setRecording(false);
          if (e.key !== "Escape") send({ type: "hotkey.set", hotkey: combo(e.nativeEvent) });
        }}
      >
        {recording ? "Press a key…" : hotkey}
      </Button>
    </section>
  );
}
