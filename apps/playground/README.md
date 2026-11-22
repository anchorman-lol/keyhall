# Keyhall UI playground

A layout builder for the Keyhall window, drawn with the app's own theme and `@keyhall/ui` components. You pick an option for each region and set a few states, and the 1440 × 900 window recomposes. The regions are navigation, main area, filter bar, game detail and its sections, bottom edge, friends, running game and density. The states are which page is showing, a running game, a signing request, filters applied and the open game. The regions live in `src/builder/` as React components meant to move into `apps/desktop`.

- `pnpm --filter @keyhall/playground dev` serves it on http://localhost:1430.
- `sh apps/playground/scripts/export.sh builder` builds it and writes `~/work/reports/keyhall-ui/builder.html` with its assets beside it. The export uses a classic script so it opens from `file://` in Firefox.
- `node apps/playground/scripts/check.mjs <page.html> <shots-dir>` runs a set of combinations, plus a few states a URL can't hold (the open hover rail, the open menus, a search with no match), in headless Chromium and Firefox. It checks that the regions tile the window and that visible text doesn't overlap or overflow; text covered by a sheet or a menu doesn't count. It also checks for broken images, external requests and page errors, and screenshots each case. It needs `playwright-core` resolvable from the script's folder.

The choice is kept in the URL hash and localStorage. "Copy my layout" copies a readable spec with your notes.

Cover art comes from the November scout of Nostr games; friends, play time, signatures and budget figures are illustrative.
