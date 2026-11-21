# Keyhall UI playground

Design variants drawn with the app's own theme and `@keyhall/ui` components, one page per round.

- `pnpm --filter @keyhall/playground dev` serves it on http://localhost:1430.
- `sh apps/playground/scripts/export.sh layout` builds it and writes `~/work/reports/keyhall-ui/layout.html` with its assets beside it. The export uses a classic script so it opens from `file://` in Firefox.
- `node apps/playground/scripts/check.mjs <page.html> <shots-dir>` checks an export in headless Chromium and Firefox (broken images, external requests, page errors, picks surviving a reload) and screenshots each variant. It needs `playwright-core` resolvable from the script's folder.

Cover art comes from the November scout of Nostr games; friends, play time, signatures and budget figures are illustrative.
