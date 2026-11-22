#!/bin/sh
# Signs with "Keyhall Local Dev" when it exists, so the keychain keeps trusting rebuilds.
set -eu

if [ -z "${APPLE_SIGNING_IDENTITY:-}" ] && security find-identity -v -p codesigning 2>/dev/null | grep -q '"Keyhall Local Dev"'; then
  export APPLE_SIGNING_IDENTITY="Keyhall Local Dev"
fi

exec pnpm --filter @keyhall/desktop tauri build "$@"
