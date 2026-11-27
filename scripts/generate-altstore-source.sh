#!/usr/bin/env bash
# Generates an AltStore / SideStore source (altstore-source.json).
#
# Emits the AltStore 2.x format (apps[].versions[] + appPermissions) and keeps
# the legacy top-level version/downloadURL/size fields so older AltStore and
# SideStore builds still read it.
#
# appPermissions are read from the built .app (entitlements from its signature,
# NS*UsageDescription keys from Info.plist). AltStore 2.x refuses to install an
# app whose permissions are not declared by its source.
#
# Usage:
#   scripts/generate-altstore-source.sh --repo owner/name --tag v1.0.6 --version 1.0.6 \
#     --bundle-id com.aerofighter.game --app-name AeroFighter --size <bytes> \
#     [--app path/to/AeroFighter.app] [--previous altstore-source.json] [--out altstore-source.json]
set -euo pipefail

REPO="kichukic/AEROFIGHER"; TAG=""; VERSION=""; BUNDLE_ID="com.aerofighter.game"
APP_NAME="AeroFighter"; SIZE="0"; APP=""; PREVIOUS=""; OUT="altstore-source.json"

while [ $# -gt 0 ]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --tag) TAG="$2"; shift 2 ;;
    --version) VERSION="$2"; shift 2 ;;
    --bundle-id) BUNDLE_ID="$2"; shift 2 ;;
    --app-name) APP_NAME="$2"; shift 2 ;;
    --size) SIZE="$2"; shift 2 ;;
    --app) APP="$2"; shift 2 ;;
    --previous) PREVIOUS="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

[ -n "$VERSION" ] || VERSION=$(node -p "require('./app.json').expo.version")
[ -n "$TAG" ] || TAG="v${VERSION}"

ENT_XML=""
if [ -n "$APP" ] && [ -d "$APP" ] && command -v codesign >/dev/null 2>&1; then
  ENT_XML=$(codesign -d --entitlements - --xml "$APP" 2>/dev/null || true)
fi

export REPO TAG VERSION BUNDLE_ID APP_NAME SIZE APP PREVIOUS OUT ENT_XML

python3 -I - <<'PY'
import datetime, json, os, plistlib

env = os.environ
repo, tag, version = env["REPO"], env["TAG"], env["VERSION"]
bundle_id, app_name = env["BUNDLE_ID"], env["APP_NAME"]
size = int(env.get("SIZE") or 0)
app, previous, out = env.get("APP", ""), env.get("PREVIOUS", ""), env["OUT"]

now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
ipa_url = f"https://github.com/{repo}/releases/download/{tag}/{app_name}.ipa"
icon_url = f"https://raw.githubusercontent.com/{repo}/master/assets/icon.png"
owner = repo.split("/")[0]

min_os = "16.4"  # Expo SDK 58 minimum
privacy, entitlements = {}, []
if app and os.path.isdir(app):
    with open(os.path.join(app, "Info.plist"), "rb") as f:
        info = plistlib.load(f)
    min_os = info.get("MinimumOSVersion", min_os)
    privacy = {k: v for k, v in info.items() if k.startswith("NS") and k.endswith("UsageDescription")}
ent_xml = env.get("ENT_XML", "").strip()
if ent_xml:
    try:
        entitlements = sorted(plistlib.loads(ent_xml.encode()).keys())
    except Exception:
        entitlements = []

new_version = {
    "version": version,
    "date": now,
    "localizedDescription": f"{app_name} {version} — free sideload build.",
    "downloadURL": ipa_url,
    "size": size,
    "minOSVersion": min_os,
}

versions = []
if previous and os.path.isfile(previous):
    try:
        with open(previous) as f:
            old = json.load(f)
        for a in old.get("apps", []):
            if a.get("bundleIdentifier") == bundle_id:
                versions = [v for v in a.get("versions", []) if v.get("version") != version]
    except Exception:
        versions = []
versions = [new_version] + versions[:9]  # keep the 10 most recent

source = {
    "name": app_name,
    "identifier": f"{bundle_id}.source",
    "subtitle": "Arcade Air Combat Simulator",
    "description": "Fast-paced top-down aerial combat game with real-time multiplayer, homing missiles, and arcade killstreaks.",
    "iconURL": icon_url,
    "website": f"https://github.com/{repo}",
    "tintColor": "#00e5ff",
    "apps": [{
        "name": app_name,
        "bundleIdentifier": bundle_id,
        "developerName": owner,
        "subtitle": "Arcade air combat",
        "localizedDescription": "Fast-paced top-down aerial dogfights, breakable homing missiles, air-drop supply crates, and arcade killstreak perks.",
        "iconURL": icon_url,
        "tintColor": "#00e5ff",
        "category": "games",
        "screenshots": [icon_url],
        "versions": versions,
        "appPermissions": {"entitlements": entitlements, "privacy": privacy},
        # Legacy (AltStore 1.x / older SideStore) fields mirror the newest version.
        "version": version,
        "versionDate": now,
        "versionDescription": new_version["localizedDescription"],
        "downloadURL": ipa_url,
        "size": size,
    }],
    "news": [],
}

with open(out, "w") as f:
    json.dump(source, f, indent=2)
    f.write("\n")
print(f"==> Wrote {out}: {app_name} {version}, {len(entitlements)} entitlement(s), {len(privacy)} privacy key(s)")
PY
