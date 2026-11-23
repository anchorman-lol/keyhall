import { NO_FILTERS } from "@keyhall/core/filters";
import { findGame, type ShimCall } from "@keyhall/core/launcher";
import { useEffect, useRef, useState } from "react";
import { BudgetPage } from "./BudgetPage.tsx";
import { FriendsColumn } from "./Friends.tsx";
import { GamePage } from "./GamePage.tsx";
import { SignOut } from "./KeyDialog.tsx";
import { KeyWarning } from "./KeyWarning.tsx";
import { Launcher } from "./launcher.ts";
import { Library } from "./Library.tsx";
import { Nav } from "./Nav.tsx";
import { PresenceSettings } from "./PresenceSettings.tsx";
import { RelaySettings } from "./Relays.tsx";
import { SignerLog } from "./SignerLog.tsx";
import { SignRequest } from "./SignRequest.tsx";
import { TitleBar } from "./TitleBar.tsx";

function Settings() {
  const context = Launcher.useSelector((s) => s.context);
  const name = (c: ShimCall) => findGame(context, c.coordinate)?.name ?? "";
  const relays = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (context.view === "relays") relays.current?.scrollIntoView();
  }, [context.view]);
  return (
    <div className="h-full overflow-y-auto px-8 pt-6 pb-10">
      <PresenceSettings />
      <div ref={relays} className="mt-10 border-t pt-8">
        <RelaySettings />
      </div>
      <h2 className="mt-10 mb-3 font-semibold">Signer activity</h2>
      {context.calls.length ? (
        <SignerLog calls={context.calls.slice(-20).reverse()} name={name} />
      ) : (
        <p className="text-sm text-muted-foreground">Nothing signed since Keyhall started.</p>
      )}
      <SignOut />
    </div>
  );
}

export function App() {
  const { current, view, friendsOpen } = Launcher.useSelector((s) => s.context);
  const [filters, setFilters] = useState(NO_FILTERS);
  return (
    <div
      className={`grid h-screen grid-rows-[auto_minmax(0,1fr)] text-[13px] ${friendsOpen ? "grid-cols-[72px_minmax(0,1fr)_264px]" : "grid-cols-[72px_minmax(0,1fr)]"}`}
    >
      <TitleBar />
      <Nav />
      <div className="min-h-0 min-w-0">
        {view === "budget" ? (
          <div className="h-full overflow-y-auto px-8 pt-6 pb-10">
            <BudgetPage />
          </div>
        ) : view === "settings" || view === "relays" ? (
          <Settings />
        ) : current ? (
          <GamePage game={current} />
        ) : (
          <Library filters={filters} setFilters={setFilters} />
        )}
      </div>
      {friendsOpen && <FriendsColumn />}
      <SignRequest />
      <KeyWarning />
    </div>
  );
}
