import { Button } from "@keyhall/ui/components/button";
import { GearIcon, KeyholeIcon, WalletIcon } from "@phosphor-icons/react";
import { BudgetPage } from "./BudgetPage.tsx";
import { FriendsPanel } from "./Friends.tsx";
import { PresenceSettings } from "./PresenceSettings.tsx";
import { GamePage } from "./GamePage.tsx";
import { KeyDialog } from "./KeyDialog.tsx";
import { KeyWarning } from "./KeyWarning.tsx";
import { findGame, library, playing, type ShimCall } from "@keyhall/core/launcher";
import { Launcher } from "./launcher.ts";
import { Library } from "./Library.tsx";
import { SignerLog } from "./SignerLog.tsx";
import { Sources } from "./Sources.tsx";
import { SignRequest } from "./SignRequest.tsx";

const heading =
  "mx-2 mt-7 mb-2 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase";

export function App() {
  const context = Launcher.useSelector((s) => s.context);
  const { current, view, npub, calls } = context;
  const active = playing(context).length;
  const { send } = Launcher.useActorRef();
  const gameName = (c: ShimCall) => findGame(context, c.coordinate)?.name ?? "";
  return (
    <div className="grid h-screen grid-cols-[230px_1fr]">
      <aside className="overflow-y-auto border-r bg-sidebar px-3 py-5">
        <div className="flex items-center gap-2 px-2 pb-4 text-base font-bold">
          <KeyholeIcon weight="fill" className="size-6 text-primary" />
          Keyhall
        </div>
        <Button
          variant={current || view ? "ghost" : "secondary"}
          className="w-full justify-between"
          onClick={() => send({ type: "select" })}
        >
          All games
          <span className="text-muted-foreground">{library(context).length}</span>
        </Button>
        <Button
          variant={view === "budget" ? "secondary" : "ghost"}
          className="w-full justify-start"
          onClick={() => send({ type: "view", view: "budget" })}
        >
          <WalletIcon data-icon="inline-start" />
          Monthly budget
        </Button>
        <h2 className={`${heading} flex justify-between`}>
          Friends {active > 0 && <span className="text-primary">{active} playing</span>}
        </h2>
        <FriendsPanel />
        <h2 className={heading}>Sources</h2>
        <Sources />
        <h2 className={heading}>Signer activity</h2>
        <SignerLog calls={calls.slice(-6).reverse()} name={gameName} />
        <Button
          variant={view === "settings" ? "secondary" : "ghost"}
          className="mt-6 w-full justify-start"
          onClick={() => send({ type: "view", view: "settings" })}
        >
          <GearIcon data-icon="inline-start" />
          Presence settings
        </Button>
      </aside>
      <main className="overflow-y-auto">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-7 py-3 text-sm text-muted-foreground">
          <span>
            {view === "budget"
              ? "Monthly budget"
              : view === "settings"
                ? "Settings / Presence"
                : `Library${current ? ` / ${current.name}` : ""}`}
          </span>
          {npub ? (
            <span className="font-mono text-foreground">
              {npub.slice(0, 10)}…{npub.slice(-4)}
            </span>
          ) : (
            <KeyDialog />
          )}
        </header>
        <section className="px-7 pt-5 pb-10">
          {view === "budget" ? (
            <BudgetPage />
          ) : view === "settings" ? (
            <PresenceSettings />
          ) : current ? (
            <GamePage game={current} />
          ) : (
            <Library />
          )}
        </section>
      </main>
      <SignRequest />
      <KeyWarning />
    </div>
  );
}
