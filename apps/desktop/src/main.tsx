import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { Launcher } from "./launcher.ts";
import { Notice } from "./Notice.tsx";
import "./app.css";

const notice = (window as { notice?: Notice }).notice;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {notice ? (
      <Notice {...notice} />
    ) : (
      <Launcher.Provider>
        <App />
      </Launcher.Provider>
    )}
  </StrictMode>,
);
