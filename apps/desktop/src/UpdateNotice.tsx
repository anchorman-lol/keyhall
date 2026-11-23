import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { Launcher } from "./launcher.ts";

export function UpdateNotice() {
  const { update, windows } = Launcher.useSelector((s) => s.context);
  const { send } = Launcher.useActorRef();
  if (!update) return null;
  const playing = Object.keys(windows).length > 0;
  return (
    <button
      disabled={playing}
      title={
        playing
          ? `Keyhall ${update} installs when you restart. Close your games first.`
          : `Restart to run Keyhall ${update}`
      }
      onClick={() => send({ type: "update.restart" })}
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground outline-none hover:bg-white/[0.04] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
    >
      <ArrowClockwiseIcon className="size-3.5 text-primary" />
      {playing ? "Update ready, restart after playing" : "Update ready, restart to install"}
    </button>
  );
}
