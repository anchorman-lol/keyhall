import { CaretRightIcon, KeyholeIcon } from "@phosphor-icons/react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import { Launcher } from "./launcher.ts";

const VIEWS = { budget: "Monthly budget", settings: "Settings" };

function useFullscreenAttribute() {
  useEffect(() => {
    const window = getCurrentWindow();
    const update = () =>
      window
        .isFullscreen()
        .then((full) => document.documentElement.toggleAttribute("data-fullscreen", full));
    void update();
    const off = window.onResized(update);
    return () => void off.then((f) => f());
  }, []);
}

export function TitleBar() {
  useFullscreenAttribute();
  const { current, view, npub } = Launcher.useSelector((s) => s.context);
  const { send } = Launcher.useActorRef();
  const crumb =
    "rounded-md px-1.5 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/60";
  return (
    <header
      data-tauri-drag-region="deep"
      className="col-span-full flex h-10 items-center gap-3 border-b border-white/[0.06] bg-sidebar pr-4 pl-[84px] select-none in-data-fullscreen:pl-4"
    >
      <button
        aria-label="Keyhall, go to Library"
        onClick={() => send({ type: "select" })}
        className={`flex items-center gap-2 text-[13px] font-bold ${crumb}`}
      >
        <KeyholeIcon weight="fill" className="size-[18px] text-primary" />
        Keyhall
      </button>
      <span className="h-4 w-px bg-white/10" />
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 items-center gap-1 text-muted-foreground"
      >
        {view ? (
          <span className="px-1.5 text-foreground">{VIEWS[view]}</span>
        ) : current ? (
          <>
            <button
              onClick={() => send({ type: "select" })}
              className={`hover:text-foreground ${crumb}`}
            >
              Library
            </button>
            <CaretRightIcon className="size-3 shrink-0" />
            <span className="truncate px-1.5 text-foreground">{current.name}</span>
          </>
        ) : (
          <span className="px-1.5 text-foreground">Library</span>
        )}
      </nav>
      {npub && (
        <span title={npub} className="ml-auto font-mono text-[11px] text-muted-foreground">
          {npub.slice(0, 12)}…{npub.slice(-4)}
        </span>
      )}
    </header>
  );
}
