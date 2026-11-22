# Contributing

## Add your game

Keyhall's catalog is the [`games/`](games) folder, one folder per game. Open a pull request that adds yours. Being in the catalog doesn't put a game in Keyhall picks: the maintainer adds games to [`picks.yaml`](picks.yaml) after playing them.

### If you publish your own listing (preferred)

Publish a NIP-89 handler event (kind 31990) for your game under your own key, with your game's name, description, `picture` and `banner` in its content, a `web` tag with its URL and a `t` tag `games` (see "Listing tags" in the [README](README.md)). Then add `games/<id>/README.md` that points at it and holds nothing a listing already says:

```markdown
---
listing: 31990:<your hex pubkey>:<d tag>
signIn: [nip07, session] # optional: nip07, nip46, nip55, nsec, session, guest, none
note: Anything Keyhall should know. # optional
---

# Your game

Your game publishes its own listing: [its NIP-89 listing](https://njump.me/<naddr>).
```

Don't add a name, description or images next to a `listing`: the test suite rejects them, so your listing stays the one place to update.

### If you don't

Keyhall publishes a listing for your game under the project key, from `games/<id>/README.md`:

```markdown
---
name: Your Game
url: https://your.game/
tags: [arcade, multiplayer] # lowercase, become t tags next to "games"
signIn: [nip07, guest] # how players sign in: nip07, nip46, nip55, nsec, session, guest, none
repo: https://github.com/you/your-game # optional
developer: npub1… # optional, zaps from Keyhall players go to this key
kinds: [1, 30762] # optional, the event kinds your game publishes
---

<img src="icon.png" width="96" align="right" alt="Your Game icon">

# Your Game

What the game is and how to play it, in a few sentences. This becomes the listing's description.

![Your Game](banner.png)
```

Next to it go `icon.png`, square between 128 and 1024 px, and `banner.png`, a cover between 800 and 2400 px wide with an aspect ratio between 1.3 and 2.1, both PNG and under 1 MB together. `pnpm test` checks the folder.

Once you publish a listing of your own, open a pull request that replaces the folder's metadata and images with `listing`: Keyhall's copy would otherwise go stale. `pnpm picks:publish` reports any developer listing it finds for a game Keyhall still lists itself.
