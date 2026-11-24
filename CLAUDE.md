# Keyhall

A desktop (macOS-first) launcher and library for Nostr games. Each web game opens in its own Tauri window with an injected `window.nostr`; the key lives in the macOS keychain and never leaves the Rust process. The README describes the user-facing behaviour and the listing/label tag formats; read it before changing anything event-shaped.

## Layout

- `apps/desktop`: Tauri 2 app. `src/` is the React launcher UI (one page per file: `Library`, `GamePage`, `BudgetPage`, `Friends`, `Sources`, `SignRequest`, …). `src/launcher.ts` wires the core machine to Tauri: every `invoke`, `listen` and `localStorage` call is passed in there as a dependency.
- `apps/desktop/src-tauri`: Rust host. `lib.rs` holds all commands and window management, `signer.rs` event signing and kind scoping, `meter.rs` play-time sessions, `wallet.rs` NWC (NIP-47) crypto, `lnurl.rs` LNURL-pay requests for zaps, `dm.rs` NIP-17 DM wrapping and unwrapping.
- `packages/core`: all app logic as plain TS, exported raw (`@keyhall/core/<file>`, no build step). `launcher.ts` is the XState machine (key setup, library, game windows, sign approvals, friends, presence, budget); `relays.ts` is the only app module that talks to relays (nostr-tools `SimplePool`), routing each read or write to the relays enabled for that use in `relaySettings.ts` (user-configurable, `DEFAULT_RELAYS` with `wss://relay.anchorman.lol` first); `scripts/picks.ts`, the maintainer's publish script, queries them itself.
- `games/` is the games catalog (one folder per game, validated by `core/catalog.ts`) and `picks.yaml` the Keyhall picks list built from it; see CONTRIBUTING.md.
- `packages/ui`: shadcn components (Base UI, Phosphor icons) and the Tailwind 4 theme. Add components with the shadcn CLI here, not in the app.
- Shared dependency versions live in the `catalog:` of `pnpm-workspace.yaml`.

## Architecture

- **Windows.** `main` is the launcher. `open_game` creates a window labelled `game-<hash of url>` (reopening focuses it), only for https URLs, injects `shimScript()` from `core/shim.ts` as the initialization script, and adds a runtime capability scoped to that window and the game's origin that allows only the shim commands (`GAME_PERMISSIONS` in `lib.rs`). Game windows keep the native title bar.
- **Signer bridge (NIP-07).** The shim implements `getPublicKey` and `signEvent` by invoking `nostr_get_public_key` / `nostr_sign_event`. The first sign of each event kind per window emits `sign-request` to `main` and waits on a oneshot until the launcher calls `answer_sign_request`; game windows can't answer it. The shim also reports the kinds a game publishes and subscribes to (`nostr_observe`, which drives the verified depth badge) and key-shaped input fields (`nostr_key_field`, attributes only, never values). There is no NIP-46 bunker yet; it is a README next step for native games, and `nip46` exists only as a listing `auth` value.
- **Launcher-side signing** is scoped in `signer.rs`: `sign_event` signs only kinds 0 (profile), 13 and 30315 (presence), `sign_label` only 1985. Widening either is a security decision, not a refactor. `dm_wrap` seals and gift-wraps only kind 14 DMs built in Rust. Game windows can never sign kinds 0, 13, 14 or 1059 (`signer::game_may_sign`), even with the player's approval.
- **Library and sources.** Listings are NIP-89 kind 31990 events. Sources are Keyhall picks (kind 30267 `d=games-default` under `PICKS_PUBKEY` in `core/curation.ts`, published from `picks.yaml` by `pnpm picks:publish`), curator lists (npub → all their lists tagged `t=games`, or an naddr) and unvetted listings (every 31990 tagged `t=game(s)`). The library is the union of enabled sources (`core/sources.ts`). Curator NIP-32 labels (kind 1985, `L=game.auth` / `L=game.depth`) override listing tags (`core/labels.ts`).
- **Presence.** Friends are the NIP-02 follow list. Statuses are NIP-38 kind 30315 `d=game`; friends-only mode uses a circle key gift-wrapped (NIP-59) to each follow and rotated on unfollow (`core/presence.ts`). The circle key is in local storage for now.
- **Budget.** Rust meters play time per game window and checkpoints `playtime.json` in the app data dir every 30 s. `core/budget.ts` splits the month; `core/zap.ts` pays anonymous zaps over NWC. The NWC URI is in the keychain and only Rust signs and decrypts NIP-47 messages; the webview just relays them.
- **Updates.** `tauri-plugin-updater` checks `releases/latest/download/latest.json` against the public key in `tauri.conf.json`, only in builds compiled with `KEYHALL_UPDATES` set (CI releases), so dev and local builds never replace themselves. `release.yml` stamps the version from the date (`YYYY.MDD.N`), signs the `.app.tar.gz` with the `TAURI_SIGNING_PRIVATE_KEY` repo secret and uploads `latest.json`. The launcher's restart (`restart_to_update`) is refused while a game window is open.
- **Persistence.** Keychain (service `lol.anchorman.keyhall`, accounts `nsec` and `nwc`) for secrets; `localStorage` for sources, observed kinds, presence and budget settings, and whether the friends column is shown.

## Commands

```sh
pnpm install
pnpm dev          # tauri dev (Vite on :1420, strict port)
pnpm test         # vitest via turbo (only packages/core has tests)
pnpm check-types  # tsc (TypeScript 7) via turbo
pnpm lint         # oxlint --deny-warnings
pnpm fmt          # oxfmt; fmt:check to verify
pnpm build        # tauri build → Keyhall.app
pnpm gate         # lint, fmt:check, check-types, test, cargo test, build
```

Rust tests alone: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`.

## House rules

- **Gate locally.** The only GitHub workflow is `release.yml`, which builds the app and publishes a date-tagged release on every push to main; nothing gates PRs. The gate is `pnpm gate`, run once per final head through `reeve heavy`, and PR bodies quote its result.
- **Lint and format** with oxlint and oxfmt only (no ESLint, Prettier or Biome).
- **TDD in `packages/core`.** Write the failing vitest first. Keep relay, Tauri and storage access injected so the machine is testable; `signer.testing.ts` gives a real nostr-tools signer for tests.
- **UI verification.** Screenshots may run the Vite app in headless Chromium with Tauri IPC mocked and a fake relay. Anything touching relays, sources or the library must also be run once against real relays before the PR. Screenshots for PRs go under `docs/ui/`; scratch output goes to `~/work/reports/<branch>/`, not the repo.
- **Local macOS signing.** Ad-hoc builds change their code signature on every rebuild, so macOS forgets keychain "Always Allow" and prompts again. `scripts/local-signing-identity.sh` creates a self-signed "Keyhall Local Dev" code-signing identity once, and `pnpm build` sets `APPLE_SIGNING_IDENTITY` to it so the designated requirement stays stable across rebuilds. Developer ID signing, notarization and the data-protection keychain come before shipping builds.
- Conventional commits, squash merges.

## Gotchas

- **A new Tauri command needs three edits:** the `commands` list in `src-tauri/build.rs`, `generate_handler!` in `lib.rs`, and an `allow-<command>` permission in `capabilities/main.json` (launcher) or `GAME_PERMISSIONS` (game windows). Missing the permission fails at runtime with `not allowed by ACL`.
- Commands that touch the keychain go through `keychain_task`, because a keychain read can block on a macOS password prompt.
- Game-facing commands must resolve the game with `Launcher::game(&window)` so non-game windows are rejected.
- The CSP in `tauri.conf.json` limits `connect-src` to IPC, `wss:` and `https://api.github.com`. Requests to other https hosts go through Rust, like the LNURL-pay fetches in `core/zap.ts` (`lnurl_fetch`, which takes only well-formed LNURL-pay URLs). Mocked-IPC Playwright runs don't apply this CSP, so they won't catch a CSP block.
- `dist/`, `src-tauri/gen/` and `permissions/autogenerated/` are generated and ignored.
