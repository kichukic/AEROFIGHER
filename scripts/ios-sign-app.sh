#!/usr/bin/env bash
# Signs an iOS .app bundle inside-out (dylibs, frameworks, app extensions, then
# the app itself). macOS only (uses /usr/bin/codesign). Used by the iOS
# GitHub Actions workflow.
#
# Usage: scripts/ios-sign-app.sh <path/to/App.app> <identity> <entitlements.plist> [keychain]
#   identity "-"  -> ad-hoc pseudo-signature (no certificate; for AltStore/SideStore,
#                    which re-sign with the user's free Apple ID on install)
#   identity name -> e.g. "Apple Development: you@example.com (ABCDE12345)"
set -euo pipefail

APP="${1:?app path required}"
IDENTITY="${2:?identity required (use - for ad-hoc)}"
ENT="${3:?entitlements plist required}"
KEYCHAIN="${4:-}"

[ -d "$APP" ] || { echo "No such app bundle: $APP" >&2; exit 1; }

ARGS=(--force --sign "$IDENTITY" --timestamp=none --generate-entitlement-der)
[ -n "$KEYCHAIN" ] && ARGS+=(--keychain "$KEYCHAIN")

sign() { /usr/bin/codesign "${ARGS[@]}" "$@"; }

# Drop any stale signatures first.
find "$APP" -name _CodeSignature -type d -prune -exec rm -rf {} +

# 1. Loose dylibs anywhere in the bundle.
while IFS= read -r -d '' lib; do sign "$lib"; done \
  < <(find "$APP" -type f -name '*.dylib' -print0)

# 2. Frameworks (deepest first so nested frameworks are signed before parents).
# (portable to BSD tools on macOS: sort by path length, longest first)
while IFS= read -r fw; do [ -n "$fw" ] && sign "$fw"; done \
  < <(find "$APP" -type d -name '*.framework' | awk '{ print length($0) " " $0 }' | sort -rn | cut -d' ' -f2-)

# 3. App extensions (none today; signed without extra entitlements).
if [ -d "$APP/PlugIns" ]; then
  while IFS= read -r -d '' appex; do sign "$appex"; done \
    < <(find "$APP/PlugIns" -maxdepth 1 -name '*.appex' -print0)
fi

# 4. The app itself, with entitlements.
sign --entitlements "$ENT" "$APP"

echo "==> Signed $(basename "$APP") with identity: $IDENTITY"
/usr/bin/codesign -d --entitlements - --xml "$APP" 2>/dev/null | head -c 2000 || true
echo
