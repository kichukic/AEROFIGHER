# Free iOS Build & Sideloading Guide (AltStore / SideStore)

AeroFighter's iOS build costs nothing. You don't need an Apple Developer Program membership, a Mac, Ad Hoc distribution or `itms-services` over-the-air installs.

- **Build:** GitHub Actions `macos-26` runner (Xcode 26.4+, the minimum for Expo SDK 58). This is free for public repos; private repos use macOS minutes from the free allowance.
- **Signing:** done with *your* free Apple ID / Personal Team, by AltStore, SideStore or Sideloadly on your own device.
- **Distribution:** GitHub Releases plus an AltStore/SideStore source (`altstore-source.json`).
- **Android:** unchanged. `build-apk.sh` and `scripts/publish.sh` work as before and attach the APK to the same `v<version>` release.

---

## 1. What the workflow produces

Workflow file: [`.github/workflows/ios-release.yml`](.github/workflows/ios-release.yml)

| Asset | Signed with | Use it for |
|---|---|---|
| `AeroFighter.ipa`, `AeroFighter-<ver>.ipa` | Ad-hoc pseudo-signature (`codesign -s -`), no certificate | **AltStore / SideStore / Sideloadly.** They re-sign it with your free Apple ID at install time. This is the main path. |
| `AeroFighter-<ver>-dev-signed.ipa` *(optional)* | Free Personal Team "Apple Development" certificate + 7-day profile | Installs directly, without re-signing, on the devices listed in the profile, until the profile expires. Built only when the optional secrets in §5 are set. |
| `altstore-source.json` | n/a | AltStore 2.x / SideStore source. It also keeps the legacy fields for older AltStore versions, and is committed back to `master`. |

### Pipeline steps

1. `expo prebuild --platform ios --clean`. `ios/` is generated each run and never committed.
2. `pod install` (cached).
3. `xcodebuild` Release for `generic/platform=iOS` with signing turned off.
4. `scripts/ios-sign-app.sh` ad-hoc signs the bundle from the inside out and embeds the entitlements from the prebuild, then the app is zipped into `Payload/` and saved as the `.ipa`.
5. *(Optional)* The same bundle is re-signed with your Personal Team identity and profile.
6. `scripts/generate-altstore-source.sh` writes the source. It reads the entitlements and `NS*UsageDescription` keys from the built app into `appPermissions`; AltStore 2.x refuses apps whose permissions the source doesn't declare.
7. The workflow creates the GitHub Release, or adds the iOS files to an existing release so the APK stays.
8. It commits `altstore-source.json` to `master`.

---

## 2. Triggering a build (from Linux)

```bash
# A) Tag push (the version comes from the tag)
git tag v1.0.6 && git push origin v1.0.6

# B) On demand
gh workflow run ios-release.yml -f release_tag=v1.0.6
gh run watch
```

The Android publish works with either order:

- `scripts/publish.sh` creates `v<version>`, and its tag triggers the iOS workflow, which then adds the IPA.
- If the iOS workflow ran first, `publish.sh` uploads the APK to the existing release.

After the workflow commits `altstore-source.json` to master, run `git pull` before your next local commit.

---

## 3. Installing with AltStore / SideStore (recommended)

**One-time setup (manual, needs a computer):**
- **AltStore:** install AltServer on a computer, plug in the iPhone, and install AltStore with your Apple ID. On Linux, use the community AltServer-Linux.
- **SideStore:** do the one-time pairing-file setup described at sidestore.io. After that, SideStore refreshes apps on-device with no computer.

**Install AeroFighter:**
1. In AltStore/SideStore, go to **Sources → +** and add:
   `https://raw.githubusercontent.com/kichukic/AEROFIGHER/master/altstore-source.json`
2. Open AeroFighter and tap **Install**. You can also download `AeroFighter.ipa` from Releases and open it via **My Apps → +**.
3. AltStore/SideStore signs the app with your free Apple ID and installs it. Updates show up automatically when a new release changes the source.

**Sideloadly** (Windows/macOS): drag in `AeroFighter.ipa`, enter your Apple ID, and click Start.

---

## 4. Manual Apple steps that can't be automated

Apple provides no API for free accounts, so these steps stay manual:

| # | Step | Why it can't be automated | How often |
|---|---|---|---|
| 1 | **Sign in with your Apple ID (and 2FA) in AltStore, SideStore or Sideloadly** | Apple only issues free-team certificates and profiles to an interactive Apple ID login with 2FA. App Store Connect API keys are only for paid accounts, so CI can't log in for you. | Once; again if the session expires |
| 2 | **Install AltStore/SideStore itself** (AltServer, or SideStore pairing) | Needs a USB/Wi-Fi trusted connection to the device | Once |
| 3 | **Turn on Developer Mode** (iOS 16+): Settings → Privacy & Security → Developer Mode → On → Restart → Turn On | Device security setting | Once per device |
| 4 | **Trust the developer profile** if prompted: Settings → General → VPN & Device Management → your Apple ID → Trust | Device security setting | Once per Apple ID |
| 5 | **7-day refresh** | Free signatures expire after 7 days. AltStore (with AltServer on the same Wi-Fi) or SideStore (on-device) refreshes automatically; you only need to open the app every few days. | Automatic, weekly |

Limits on free Apple IDs, set by Apple: at most **3** sideloaded apps at once (AltStore/SideStore counts as one), **10 App IDs per 7 days**, and no push notifications, iCloud, or other restricted entitlements. AeroFighter currently needs none of those.

---

## 5. Optional: Personal Team development-signed IPA from CI

This step is optional. AltStore and SideStore discard any existing signature and re-sign anyway, so `-dev-signed.ipa` only matters if you want an IPA you can install directly (for example with `ideviceinstaller` on Linux) without a sideloading tool.

**Limits to know first:**
- Free provisioning profiles are valid for **7 days** and only work on the device UDIDs registered in them.
- Getting the certificate and profile out of Apple needs **Xcode signed in with your Apple ID, i.e. access to a Mac** (borrowed, or a cloud Mac). A GitHub runner can't do this, because Xcode's Apple ID login is interactive and uses 2FA.
- You have to repeat steps 3–4 below every 7 days and update the secret.
- Without these secrets, the workflow skips this step and still publishes the AltStore IPA. If the profile has expired, it skips the dev-signed IPA with a warning instead of failing.

**Manual steps (on a Mac with Xcode):**
1. Xcode → Settings → Accounts → **+** → sign in with your free Apple ID. A "Personal Team" appears.
2. Create any iOS App project with bundle ID `com.aerofighter.game`. If Apple says the ID is taken, use a unique one; the workflow rewrites `CFBundleIdentifier` to match the profile. Choose your Personal Team, plug in your iPhone, and build once. Xcode creates the cert and the "iOS Team Provisioning Profile".
3. Export the certificate: Keychain Access → *Apple Development: you@…* → Export → `.p12` with a password.
4. Find the profile: `~/Library/Developer/Xcode/UserData/Provisioning Profiles/*.mobileprovision`. Pick the newest one for that bundle ID.
5. Add the repository secrets (from any machine):
   ```bash
   base64 < cert.p12 | tr -d "\n" | gh secret set IOS_DEV_P12_BASE64
   gh secret set IOS_DEV_P12_PASSWORD   # paste the password
   base64 < profile.mobileprovision | tr -d "\n" | gh secret set IOS_DEV_PROFILE_BASE64
   ```
6. Re-run the workflow. CI imports the cert into a temporary keychain, signs with the profile's own entitlements, verifies the result, and deletes the keychain.

Never commit `.p12` or `.mobileprovision` files. `.gitignore` already blocks them.

---

## 6. Troubleshooting

- **"Xcode … is older than 26.4":** GitHub changed the `macos-26` image. Check the installed Xcodes in the runner-images readme and bump `runs-on`.
- **AltStore: "app requires permissions not declared by source":** the source was generated from a different build. Re-run the workflow so `appPermissions` is regenerated from the current IPA.
- **"Maximum number of apps" / App ID limit:** a free-account limit. Remove another sideloaded app or wait for the 7-day window.
- **App crashes on launch after 7 days:** the signature expired. Refresh it in AltStore/SideStore.
- **TrollStore** (only on supported iOS versions): the ad-hoc `AeroFighter.ipa` installs with permanent signing.
