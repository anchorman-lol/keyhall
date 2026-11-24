import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { Launcher } from "./launcher.ts";
import { Overlay, Toasts, type Item } from "./Overlay.tsx";
import "./app.css";

const HOSTS = { overlay: Overlay, toasts: Toasts };
const panel = (window as { panel?: { host: keyof typeof HOSTS; items: Item[] } }).panel;
const Host = panel && HOSTS[panel.host];

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {Host ? (
      <Host items={panel.items} />
    ) : (
      <Launcher.Provider>
        <App />
      </Launcher.Provider>
    )}
  </StrictMode>,
);
