import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { Launcher } from "./launcher.ts";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Launcher.Provider>
      <App />
    </Launcher.Provider>
  </StrictMode>,
);
