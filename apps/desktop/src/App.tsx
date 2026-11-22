import { NO_FILTERS } from "@keyhall/core/filters";
import { findGame, type ShimCall } from "@keyhall/core/launcher";
import { useState } from "react";
import { BudgetPage } from "./BudgetPage.tsx";
import { FriendsColumn } from "./Friends.tsx";
import { GamePage } from "./GamePage.tsx";
import { KeyWarning } from "./KeyWarning.tsx";
import { Launcher } from "./launcher.ts";
import { Library } from "./Library.tsx";
import { Nav } from "./Nav.tsx";
import { PresenceSettings } from "./PresenceSettings.tsx";
import { SignerLog } from "./SignerLog.tsx";
import { SignRequest } from "./SignRequest.tsx";

function Settings() {
  const context = Launcher.useSelector((s) => s.context);
  const name = (c: ShimCall) => findGame(context, c.coordinate)?.name ?? "";
  return (
    <div className="h-full overflow-y-auto px-8 pt-6 pb-10">
      <PresenceSettings />
      <h2 className="mt-10 mb-3 font-semibold">Signer activity</h2>
      {context.calls.length ? (
        <SignerLog calls={context.calls.slice(-20).reverse()} name={name} />
      ) : (
        <p className="text-sm text-muted-foreground">Nothing signed since Keyhall started.</p>
      )}
    </div>
  );
}

export function App() {
  const { current, view } = Launcher.useSelector((s) => s.context);
  const [filters, setFilters] = useState(NO_FILTERS);
  return (
    <div className="grid h-screen grid-cols-[72px_minmax(0,1fr)_264px] text-[13px]">
      <Nav />
      <div className="relative min-h-0 min-w-0">
        {(view || current) && (
          <div data-tauri-drag-region className="absolute inset-x-0 top-0 z-10 mr-3 h-[52px]" />
        )}
        {view === "budget" ? (
          <div className="h-full overflow-y-auto px-8 pt-6 pb-10">
            <BudgetPage />
          </div>
        ) : view === "settings" ? (
          <Settings />
        ) : current ? (
          <GamePage game={current} />
        ) : (
          <Library filters={filters} setFilters={setFilters} />
        )}
      </div>
      <FriendsColumn />
      <SignRequest />
      <KeyWarning />
    </div>
  );
}
