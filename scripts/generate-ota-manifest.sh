#!/usr/bin/env bash
# Generates Apple OTA (Over-The-Air) installation manifest.plist and install.html
# Usage: ./scripts/generate-ota-manifest.sh <REPO> <TAG> <VERSION> <BUNDLE_ID> <APP_NAME> <OUTPUT_DIR>
set -euo pipefail

REPO="${1:-kichukic/AEROFIGHER}"
TAG="${2:-v1.0.5}"
VERSION="${3:-1.0.5}"
BUNDLE_ID="${4:-com.aerofighter.game}"
APP_NAME="${5:-AeroFighter}"
OUTPUT_DIR="${6:-release-assets}"

mkdir -p "$OUTPUT_DIR"

IPA_NAME="AeroFighter-${VERSION}.ipa"
IPA_URL="https://github.com/${REPO}/releases/download/${TAG}/${IPA_NAME}"
ICON_URL="https://raw.githubusercontent.com/${REPO}/master/assets/icon.png"
MANIFEST_RELEASE_URL="https://github.com/${REPO}/releases/download/${TAG}/manifest.plist"
MANIFEST_RAW_URL="https://raw.githubusercontent.com/${REPO}/master/${OUTPUT_DIR}/manifest.plist"

cat > "${OUTPUT_DIR}/manifest.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>items</key>
  <array>
    <dict>
      <key>assets</key>
      <array>
        <dict>
          <key>kind</key>
          <string>software-package</string>
          <key>url</key>
          <string>${IPA_URL}</string>
        </dict>
        <dict>
          <key>kind</key>
          <string>display-image</string>
          <key>needs-shine</key>
          <false/>
          <key>url</key>
          <string>${ICON_URL}</string>
        </dict>
        <dict>
          <key>kind</key>
          <string>full-size-image</string>
          <key>needs-shine</key>
          <false/>
          <key>url</key>
          <string>${ICON_URL}</string>
        </dict>
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key>
        <string>${BUNDLE_ID}</string>
        <key>bundle-version</key>
        <string>${VERSION}</string>
        <key>kind</key>
        <string>software</string>
        <key>title</key>
        <string>${APP_NAME}</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>
PLIST

# Encode URL for itms-services query param
ENCODED_MANIFEST_URL=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${MANIFEST_RELEASE_URL}', safe=''))")

cat > "${OUTPUT_DIR}/install.html" <<HTML
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Install ${APP_NAME} (${VERSION})</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #050a14;
      color: #ffffff;
      margin: 0;
      padding: 30px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .card {
      background: #0d1728;
      border: 1.5px solid rgba(0, 229, 255, 0.4);
      border-radius: 20px;
      padding: 30px 24px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(0, 229, 255, 0.15);
    }
    .icon {
      width: 96px;
      height: 96px;
      border-radius: 22px;
      margin-bottom: 16px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.4);
      border: 2px solid rgba(255, 255, 255, 0.15);
    }
    h1 {
      font-size: 24px;
      font-weight: 900;
      letter-spacing: 1.5px;
      margin: 0 0 6px 0;
      color: #00e5ff;
    }
    .badge {
      display: inline-block;
      background: rgba(255, 210, 63, 0.15);
      color: #ffd23f;
      border: 1px solid #ffd23f;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 800;
      margin-bottom: 20px;
    }
    .btn {
      display: block;
      background: #00e5ff;
      color: #050a14;
      font-size: 16px;
      font-weight: 900;
      text-decoration: none;
      padding: 16px 20px;
      border-radius: 14px;
      letter-spacing: 0.8px;
      box-shadow: 0 4px 16px rgba(0, 229, 255, 0.4);
      transition: transform 0.1s ease;
      margin-bottom: 16px;
    }
    .btn:active {
      transform: scale(0.97);
    }
    .btn-secondary {
      background: transparent;
      color: #00e5ff;
      border: 1.5px solid #00e5ff;
      box-shadow: none;
      padding: 12px 18px;
      font-size: 14px;
    }
    .note {
      font-size: 12px;
      color: #8fa0b5;
      line-height: 1.6;
      text-align: left;
      margin-top: 20px;
      background: rgba(0,0,0,0.25);
      padding: 14px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.08);
    }
    .note strong {
      color: #ffffff;
    }
  </style>
</head>
<body>
  <div class="card">
    <img src="${ICON_URL}" alt="App Icon" class="icon" onerror="this.style.display='none'">
    <h1>${APP_NAME}</h1>
    <div class="badge">iOS Ad Hoc · v${VERSION}</div>
    <a href="itms-services://?action=download-manifest&url=${ENCODED_MANIFEST_URL}" class="btn">
      📲 INSTALL ON IPHONE
    </a>
    <a href="${IPA_URL}" class="btn btn-secondary">
      ⬇️ DOWNLOAD .IPA DIRECTLY
    </a>
    <div class="note">
      <strong>Requirements for Ad Hoc Installation:</strong><br>
      • Open this page in <strong>Mobile Safari</strong> on your iPhone.<br>
      • Your iPhone UDID must be registered in the provisioning profile.<br>
      • After installation, go to: <strong>Settings &gt; General &gt; VPN &amp; Device Management</strong> and tap <strong>Trust</strong> on the developer profile.<br>
      • On iOS 16+, enable <strong>Developer Mode</strong> in <em>Settings &gt; Privacy &amp; Security &gt; Developer Mode</em> and restart.
    </div>
  </div>
</body>
</html>
HTML

echo "==> Generated OTA manifest:"
echo "    - ${OUTPUT_DIR}/manifest.plist"
echo "    - ${OUTPUT_DIR}/install.html"
