# Keyhall UI playground

A layout builder for the Keyhall window, drawn with the app's own theme and `@keyhall/ui` components. Pick an option for each region (sidebar, main area, inspector, bottom edge, friends, running game, density) and a few states, and the 1440 × 900 window recomposes. The regions live in `src/builder/` as React components meant to move into `apps/desktop`.

- `pnpm --filter @keyhall/playground dev` serves it on http://localhost:1430.
- `sh apps/playground/scripts/export.sh builder` builds it and writes `~/work/reports/keyhall-ui/builder.html` with its assets beside it. The export uses a classic script so it opens from `file://` in Firefox.
- `node apps/playground/scripts/check.mjs <page.html> <shots-dir>` runs a set of combinations in headless Chromium and Firefox. It checks that the regions tile the window, that no text overlaps or overflows, and that there are no broken images, external requests or page errors. It also screenshots each combination. It needs `playwright-core` resolvable from the script's folder.

The choice is kept in the URL hash and localStorage. "Copy my layout" copies a readable spec with your notes.

Cover art comes from the November scout of Nostr games; friends, play time, signatures and budget figures are illustrative.
