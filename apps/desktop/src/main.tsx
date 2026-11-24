import { StrictMode, type FC } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { Launcher } from "./launcher.ts";
import { Notice } from "./Notice.tsx";
import { Overlay } from "./Overlay.tsx";
import "./app.css";

const PANELS = { notice: Notice, overlay: Overlay } as Record<string, FC<object>>;
const panel = (window as { panel?: { kind: string; props: object } }).panel;
const Panel = panel && PANELS[panel.kind];

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {Panel ? (
      <Panel {...panel.props} />
    ) : (
      <Launcher.Provider>
        <App />
      </Launcher.Provider>
    )}
  </StrictMode>,
);
