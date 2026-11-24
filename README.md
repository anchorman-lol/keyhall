# Keyhall

A launcher and library for Nostr games. Every game you play opens in its own window under one key, and the key never enters a game.

Early work in progress: this is v0, desktop (macOS) first.

![The library: Keyhall picks as a cover grid with sign-in badges, and the friends column showing who is playing what](docs/ui/readme-library.webp)

|                                                                                                                                   |                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| ![A game page while the game runs: play time, budget share, friends in the game and sign-in trust](docs/ui/readme-game-page.webp) | ![The blocking prompt when a game first asks to sign an event kind](docs/ui/readme-sign-request.webp) |
| ![The monthly budget split by play time, ready to pay over Nostr Wallet Connect](docs/ui/readme-budget.webp)                      | ![Settings: presence visibility and relays](docs/ui/readme-settings.webp)                             |

## Download

Every push to `main` publishes a [release](https://github.com/anchorman-lol/keyhall/releases/latest) with a `.dmg` for Apple Silicon Macs. Builds aren't signed with a Developer ID or notarized yet, so macOS says the app is damaged or from an unidentified developer: right-click Keyhall.app and choose Open, or run `xattr -dr com.apple.quarantine /Applications/Keyhall.app`.

Once installed, Keyhall updates itself: it checks the latest release on launch and every four hours, installs a newer one in the background (signed with the project's update key, which the app verifies) and offers a restart in the title bar, never while a game window is open. Each release's app version is its date, `2026.1123.0` for the first release of 23 November 2026. Every update replaces the app, so until releases are signed with a Developer ID macOS asks for keychain access again after one.

## What v0 does

- Lists games as a cover grid from the sources you switch on in the Sources menu, with search, sort (name, recently updated, most played this month) and filters (signs through Keyhall, friends playing, updated in the last two weeks, Nostr depth). Each game shows its square icon, the listing's `picture`, beside its `banner` cover. “Keyhall picks”, the official list (NIP-51 app curation set, kind 30267, `d=games-default` under the project's key), is on by default; its games are folders in [`games/`](games) and the list is [`picks.yaml`](picks.yaml). Add a curator by npub (all their lists tagged `t=games`) or one list by naddr. “Unvetted listings”, off by default, adds every NIP-89 handler event (kind 31990) tagged `t=game` or `t=games`. Each game shows which sources list it, and your sources are kept in local storage.
- Shows a sign-in badge from the listing's `auth` tags (worst case wins), a Nostr depth badge (`multiplayer`, `identity` or `none`) and when the game was last updated.
- Reads NIP-32 labels (kind 1985) from the curators of your enabled sources. A curator's label wins over the listing's tags and the badge gets a “verified by” seal; where the listing, curators and the game window disagree, the game page says who says what.
- Opens each web game in its own window with an injected `window.nostr` (`getPublicKey`, `signEvent`). Rust answers both. The first time a game asks to sign an event kind, the launcher window comes to the front and blocks everything else until you allow or deny it; game windows can't answer that prompt. The running game sits at the bottom of the navigation rail with its play time, Show and Quit.
- Warns in the launcher when a game window shows an input that looks like it wants a key (an `nsec` or 64-hex placeholder, or a name, id or label such as “private key”). The check reads only those attributes, never what's typed.
- If your key curates one of your sources, “Label this game” signs a label with it and publishes only when you confirm.
- Keeps your key in the macOS keychain. Create one or import an nsec; it stays in the Rust process. Sign out (Settings) deletes it.
- Edit profile, in the menu under your name at the bottom of the rail, edits your name, picture, about and lightning address (`lud16`, where zaps reach you). It starts from your latest kind 0 on your relays, keeps every field and tag it doesn't show, and publishes a new kind 0 to your presence relays. Only the launcher signs kind 0: games can't, even if you'd allow it.
- Friends are your NIP-02 follow list (read only). The friends column on the right shows what they're playing, with each game's icon, and game cards show which friends are in that game.
- Messages: double-click a friend (or use the chat button) to open your NIP-17 DMs with them in a tabbed chat panel that stays open while you browse, with unread counts on friends, so any NIP-17 client with your key shows the same messages. Rust seals and gift-wraps each message (kinds 14, 13 and 1059), one copy to the friend's DM relays (kind 10050) and one to yours, falling back to your presence relays; games can't sign these kinds.
- Presence: while a game window is open, Keyhall publishes a NIP-38 status (`30315`, `d=game`, “Playing Nochess”, expiring after 3 hours) when the window opens and clears it when it closes. Set Public, Friends only (the default) or Hidden for all games, and override it per game.
- Meters play time: every minute a game window is open counts, idle included. Rust checkpoints the sessions to the app's data folder every 30 seconds, so they survive restarts. Nothing about play time is published.
- Monthly budget: set an amount and connect a wallet over Nostr Wallet Connect (NIP-47). Its connection string goes into the keychain, and only Rust signs and decrypts the wallet messages. After a month ends, the Monthly budget page shows its split and pays it only once you confirm, as anonymous zaps (a throwaway key signs each zap request) to each game's lightning address. Games under 15 minutes don't count, games without an address and shares under 100 sats go to the others, and 1% stays back for fees.

### Friends-only presence

Keyhall makes a circle key and sends its secret once to each follow as a NIP-59 gift wrap whose rumor is a kind `30078` event with `d=keyhall/presence`. Each status is then one `30315` event signed by the circle key, with its content and `a` tag NIP-44-encrypted to the circle. Unfollowing someone rotates the key the next time you play and re-sends it to everyone left. Keyhall reads friends' public statuses and, for each circle key a follow sent you, their encrypted ones.

### Listing tags

```json
["auth", "nip07"]        // repeatable: nip07, nip46, nip55, session, guest, nsec, none
["depth", "multiplayer"] // or identity, none
["a", "30617:<pubkey>:<repo>", "<relay>", "repo"]
["zap", "<pubkey>", "<relay>", "<weight>"] // NIP-57 zap split; without it, "lud16" in the content
```

Curator labels point at the listing with an `a` tag:

```json
["L", "game.auth"],  ["l", "nip07", "game.auth"]   // one l per sign-in method
["L", "game.depth"], ["l", "identity", "game.depth"]
["a", "31990:<pubkey>:<d>"]
```

The depth badge starts as the listing declares it, or as the first enabled curator labels it. Once you've played, the game window's record of which kinds the game publishes and subscribes to decides it, shown with a ✓. "Last updated" is the newest of the listing's `created_at`, the repo's last push (its NIP-34 state event, or GitHub) and its latest GitHub release.

### Isolation

Each game window gets a capability added at runtime, scoped to that window and the game's https origin, which allows only the three shim commands. Launcher commands are allowed for the `main` window only, so a game calling one gets `not allowed by ACL`.

## Develop

A pnpm workspace:

- `apps/desktop`: the Tauri 2 app, a React UI and the Rust host (`src-tauri`: keychain, signer, game windows, play-time meter, NWC wallet, NIP-17 DMs).
- `packages/core`: listing and curator-list parsing (`curation.ts`), the games catalog and the picks events (`catalog.ts`, published by `scripts/picks.ts` to the default relays), curator labels and badge verdicts (`labels.ts`), source settings and their union (`sources.ts`), relay settings and per-use routing (`relaySettings.ts`), badges, depth classification, the `window.nostr` shim, relay queries, presence, the budget split, zaps and the launcher's XState machine (key setup, library, game windows, signing approvals, friends, presence, budget payments).
- `packages/ui`: shadcn components (Base UI, Phosphor icons) and the Tailwind theme.

```sh
pnpm install
pnpm dev                 # tauri dev
pnpm test                # vitest
pnpm check-types
pnpm lint && pnpm fmt:check
pnpm gate                # all of the above, cargo test and pnpm build (Keyhall.app)
pnpm picks:publish       # dry run of the picks listings and list; --publish sends what changed
```

`pnpm picks:publish` signs a kind 31990 listing for each game folder without a `listing` (images from GitHub Pages) and the `games-default` list, all with the project key from the macOS keychain (service `lol.anchorman.keyhall.project`, account `picks`). It prints the signed events, how each differs from what's on the relays, and developer listings it found for games Keyhall still lists itself. `--publish` asks before sending. `--unsigned <id>` prints a game's listing unsigned, for a developer to sign with their own key.

Unsigned builds change their code signature on every rebuild, so macOS asks for keychain access again for a key a previous build stored. To keep "Always Allow" across rebuilds, run `scripts/local-signing-identity.sh` once: it creates a self-signed "Keyhall Local Dev" code-signing certificate in your login keychain, and `pnpm build` signs with it whenever it exists. It's for local builds only.

## Next steps

- Sync sources as encrypted NIP-78 app data.
- A private friends list (NIP-51 follow set) as an alternative to all follows, and keeping the circle key in the keychain instead of local storage.
- Monthly budget: rolling small shares over to the next month, excluding games, credit-me-publicly zaps and syncing play time between devices.
- NIP-42 AUTH, so DMs also load from relays that serve kind 1059 only to its recipient.
- `nip44` in the shim, per-kind scopes from the listing's `k` tags, guest keys per game.
- Native games on desktop through a built-in NIP-46 bunker, Windows and Linux key stores, and mobile.
- Switching or removing the stored key.
- Developer ID signing, notarization and the data-protection keychain before shipping builds.
