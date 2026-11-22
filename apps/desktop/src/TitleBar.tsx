import { CaretRightIcon, KeyholeIcon, MinusIcon, SquareIcon, XIcon } from "@phosphor-icons/react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Launcher } from "./launcher.ts";

const VIEWS = { budget: "Monthly budget", settings: "Settings" };
const CONTROLS = [
  {
    label: "Minimize",
    Icon: MinusIcon,
    run: () => getCurrentWindow().minimize(),
    hover: "hover:bg-white/10",
  },
  {
    label: "Zoom",
    Icon: SquareIcon,
    run: () => getCurrentWindow().toggleMaximize(),
    hover: "hover:bg-white/10",
  },
  {
    label: "Close",
    Icon: XIcon,
    run: () => getCurrentWindow().close(),
    hover: "hover:bg-red-600 hover:text-white",
  },
];

export function TitleBar() {
  const { current, view, npub } = Launcher.useSelector((s) => s.context);
  const { send } = Launcher.useActorRef();
  const crumb =
    "rounded-md px-1.5 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/60";
  return (
    <header
      data-tauri-drag-region="deep"
      className="col-span-full flex h-10 items-center gap-3 border-b border-white/[0.06] bg-sidebar pl-4 select-none"
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
        className="flex min-w-0 flex-1 items-center gap-1 text-muted-foreground"
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
        <span title={npub} className="font-mono text-[11px] text-muted-foreground">
          {npub.slice(0, 12)}…{npub.slice(-4)}
        </span>
      )}
      <div className="flex self-stretch">
        {CONTROLS.map(({ label, Icon, run, hover }) => (
          <button
            key={label}
            aria-label={label}
            onClick={() => void run()}
            className={`grid w-11 place-items-center text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset ${hover}`}
          >
            <Icon className="size-3.5" />
          </button>
        ))}
      </div>
    </header>
  );
}
