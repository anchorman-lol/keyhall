import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// Firefox refuses module scripts from file://, and the export is opened as a local file.
const classicScript: Plugin = {
  name: "classic-script",
  apply: "build",
  transformIndexHtml: (html) =>
    html
      .replace(
        /<script type="module" crossorigin src="([^"]+)"><\/script>/,
        '<script defer src="$1"></script>',
      )
      .replaceAll(" crossorigin", ""),
};

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss(), classicScript],
  base: command === "build" ? "./" : "/",
  server: { port: 1430 },
  build: { modulePreload: false },
}));
