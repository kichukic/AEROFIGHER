# iOS Automated Build & Ad Hoc Release Guide

This guide explains how to build, sign, and install **AeroFighter** on an iPhone using GitHub Actions macOS runners from an **Arch Linux** development environment without owning a Mac.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Apple Developer Account Setup](#2-apple-developer-account-setup)
3. [Registering Your iPhone UDID](#3-registering-your-iphone-udid)
4. [Creating an Apple Distribution Certificate on Linux](#4-creating-an-apple-distribution-certificate-on-linux)
5. [Exporting the Certificate as .p12](#5-exporting-the-certificate-as-p12)
6. [Creating an Ad Hoc Provisioning Profile](#6-creating-an-ad-hoc-provisioning-profile)
7. [Converting Files to Base64 on Arch Linux](#7-converting-files-to-base64-on-arch-linux)
8. [Adding GitHub Actions Secrets](#8-adding-github-actions-secrets)
9. [Running the iOS Build Workflow](#9-running-the-ios-build-workflow)
10. [Downloading the Generated IPA](#10-downloading-the-generated-ipa)
11. [Installing on iPhone via OTA & Sideloading](#11-installing-on-iphone-via-ota--sideloading)
12. [Common Build & Signing Errors and Solutions](#12-common-build--signing-errors-and-solutions)

---

## 1. Prerequisites

- An active **Apple Developer Account** (Individual or Organization) at [developer.apple.com](https://developer.apple.com).
- GitHub repository with GitHub Actions enabled: `https://github.com/kichukic/AEROFIGHER`.
- GitHub CLI installed on Arch Linux:
  ```bash
  sudo pacman -S github-cli openssl libimobiledevice
  ```
- Authenticate GitHub CLI:
  ```bash
  gh auth login
  ```

---

## 2. Apple Developer Account Setup

1. Sign in to [Apple Developer Member Center](https://developer.apple.com/account/).
2. Note your **Team ID**:
   - Navigate to the **Membership** tab (or check the top right corner under your name).
   - Your Team ID is a 10-character alphanumeric string (e.g. `A1B2C3D4E5`).
3. Create App ID:
   - Go to **Certificates, Identifiers & Profiles** &gt; **Identifiers** &gt; **+** (Add).
   - Select **App IDs** &gt; **App**.
   - Description: `AeroFighter`
   - Bundle ID: Select **Explicit** and enter:
     ```text
     com.aerofighter.game
     ```
   - Capabilities: Defaults (Game Center if needed, or none).
   - Click **Continue** &gt; **Register**.

---

## 3. Registering Your iPhone UDID

Ad Hoc distribution requires your physical iPhone's Unique Device Identifier (UDID) to be embedded in the provisioning profile.

### Method A: From Arch Linux via USB (Recommended)

1. Connect your iPhone to your Arch Linux machine with a USB cable.
2. Tap **Trust This Computer** on your iPhone screen and enter your passcode.
3. Run:
   ```bash
   idevice_id -l
   ```
   *Output will be your 40-character (or 25-character formatted) UDID, e.g.:*
   `00008030-001234567890ABCD` or `40a1b2c3d4e5f6...`

### Method B: In iPhone Browser

1. Open [get.udid.io](https://get.udid.io) in Safari on your iPhone.
2. Download the temporary enrollment profile, allow it in **Settings &gt; Profile Downloaded**, and view your UDID.

### Register UDID in Apple Developer Portal:
1. In the Developer Portal, go to **Devices** &gt; **+** (Register a Device).
2. Platform: **iOS, tvOS, watchOS**.
3. Device Name: e.g. `My iPhone 15`.
4. Device ID (UDID): Paste your UDID.
5. Click **Continue** &gt; **Register**.

---

## 4. Creating an Apple Distribution Certificate on Linux

Because Keychain Access is a macOS-only tool, you can generate your Certificate Signing Request (CSR) directly on **Arch Linux** with standard OpenSSL!

### Step 4.1: Generate Private Key and CSR

Run the following commands in your Linux terminal:

```bash
mkdir -p ~/apple-certs && cd ~/apple-certs

# 1. Generate 2048-bit RSA Private Key
openssl genrsa -out distribution.key 2048

# 2. Generate Certificate Signing Request (CSR)
# Replace your email and name
openssl req -new -key distribution.key \
  -out CertificateSigningRequest.certSigningRequest \
  -subj "/emailAddress=your_apple_email@example.com, CN=Apple Distribution: Your Name, C=US"
```

### Step 4.2: Request Certificate in Developer Portal

1. In Developer Portal, go to **Certificates** &gt; **+** (Create a New Certificate).
2. Under **Software**, select **Apple Distribution** (or iOS Distribution).
3. Click **Continue**.
4. Upload `CertificateSigningRequest.certSigningRequest` from `~/apple-certs/`.
5. Click **Generate** and download the resulting certificate file: `distribution.cer`.
6. Move `distribution.cer` into `~/apple-certs/`:
   ```bash
   mv ~/Downloads/distribution.cer ~/apple-certs/
   ```

---

## 5. Exporting the Certificate as .p12

Now combine the downloaded `.cer` and your Linux-generated `distribution.key` into a standard PKCS#12 (`.p12`) archive:

```bash
cd ~/apple-certs

# 1. Convert DER certificate to PEM format
openssl x509 -in distribution.cer -inform DER -out distribution.pem -outform PEM

# 2. Export combined private key + certificate into distribution.p12
# Set a strong password when prompted (this password becomes IOS_CERTIFICATE_PASSWORD)
openssl pkcs12 -export \
  -inkey distribution.key \
  -in distribution.pem \
  -out distribution.p12 \
  -name "Apple Distribution: AeroFighter"
```

Keep your password safe; you will need it for the GitHub Secret.

---

## 6. Creating an Ad Hoc Provisioning Profile

1. In Developer Portal, go to **Profiles** &gt; **+** (Generate a Profile).
2. Under **Distribution**, select **Ad Hoc**. Click **Continue**.
3. **App ID**: Select `com.aerofighter.game` (AeroFighter). Click **Continue**.
4. **Certificates**: Select the **Apple Distribution** certificate you created in Step 4. Click **Continue**.
5. **Devices**: Select your registered iPhone (UDID). Click **Continue**.
6. **Profile Name**: Enter:
   ```text
   AeroFighter AdHoc Profile
   ```
7. Click **Generate** and download: `AeroFighter_AdHoc_Profile.mobileprovision`.
8. Move to your certs directory:
   ```bash
   mv ~/Downloads/AeroFighter_AdHoc_Profile.mobileprovision ~/apple-certs/ad_hoc.mobileprovision
   ```

---

## 7. Converting Files to Base64 on Arch Linux

Convert the binary `.p12` and `.mobileprovision` files to single-line Base64 strings for GitHub Secrets:

```bash
cd ~/apple-certs

# Base64 encode the p12 certificate
base64 -w 0 distribution.p12 > p12_base64.txt

# Base64 encode the provisioning profile
base64 -w 0 ad_hoc.mobileprovision > profile_base64.txt
```

---

## 8. Adding GitHub Actions Secrets

You need to add 5 secrets to your GitHub repository:

| Secret Name | Value Description |
|---|---|
| `IOS_CERTIFICATE_BASE64` | Contents of `p12_base64.txt` |
| `IOS_CERTIFICATE_PASSWORD` | The password you entered when exporting `distribution.p12` |
| `IOS_PROVISIONING_PROFILE_BASE64` | Contents of `profile_base64.txt` |
| `IOS_KEYCHAIN_PASSWORD` | Any strong random string (e.g. `openssl rand -hex 16`) |
| `APPLE_TEAM_ID` | Your 10-character Apple Team ID (e.g. `A1B2C3D4E5`) |

### Option A: Set via GitHub CLI (Fastest)

Run directly from your project repository on Arch Linux:

```bash
cd ~/Documents/AEROFIGHER

# 1. Certificate Base64
gh secret set IOS_CERTIFICATE_BASE64 < ~/apple-certs/p12_base64.txt

# 2. Certificate Password
gh secret set IOS_CERTIFICATE_PASSWORD --body "YOUR_P12_PASSWORD"

# 3. Provisioning Profile Base64
gh secret set IOS_PROVISIONING_PROFILE_BASE64 < ~/apple-certs/profile_base64.txt

# 4. Keychain Password (ephemeral macOS keychain)
gh secret set IOS_KEYCHAIN_PASSWORD --body "$(openssl rand -hex 16)"

# 5. Apple Team ID
gh secret set APPLE_TEAM_ID --body "YOUR_10_DIGIT_TEAM_ID"
```

### Option B: Set via GitHub Web UI

1. Open your repository: `https://github.com/kichukic/AEROFIGHER/settings/secrets/actions`
2. Click **New repository secret**.
3. Add all 5 secrets listed in the table above.

---

## 9. Running the iOS Build Workflow

### Triggering via Git Release Tag

Pushing a version tag triggers the pipeline automatically:

```bash
cd ~/Documents/AEROFIGHER
git tag v1.0.5
git push origin v1.0.5
```

### Triggering Manually via GitHub CLI

You can also trigger a manual build on demand:

```bash
gh workflow run ios-release.yml -f release_tag="v1.0.5"
```

### Monitoring the Build

Watch the progress live in your terminal:

```bash
gh run watch
```

Or view it in your browser: `https://github.com/kichukic/AEROFIGHER/actions`.

---

## 10. Downloading the Generated IPA

Once the workflow finishes successfully:

1. **GitHub Releases**:
   - Go to `https://github.com/kichukic/AEROFIGHER/releases/tag/v1.0.5`.
   - Download `AeroFighter-1.0.5.ipa` or `AeroFighter.ipa`.
2. **GitHub Actions Artifacts**:
   - In the workflow run summary, download the `ios-build-1.0.5` artifact bundle (contains `.ipa`, `manifest.plist`, `install.html`, `RELEASE_NOTES.md`).

---

## 11. Installing on iPhone via OTA & Sideloading

### Method 1: Over-The-Air (OTA) Install via Safari

1. On your iPhone, open **Safari** (OTA installation only works inside Apple Safari).
2. Download or open `install.html` attached to the GitHub Release.
3. Tap **📲 INSTALL ON IPHONE**.
4. Safari will display:
   > *"github.com wants to install 'AeroFighter'"*
5. Tap **Install**. The game icon will appear on your Home Screen and begin installing.

> **Important iOS Security Note**:
> 1. After installation, go to **Settings &gt; General &gt; VPN &amp; Device Management**.
> 2. Under *Enterprise App* or *Developer App*, tap your developer account and select **Trust**.
> 3. **On iOS 16, 17, and 18**: You must also enable Developer Mode:
>    - Go to **Settings &gt; Privacy &amp; Security &gt; Developer Mode**.
>    - Toggle **Developer Mode** ON and restart your iPhone.

---

### Method 2: Sideloading via Sideloadly / AltStore / TrollStore

If you prefer installing directly over USB or Wi-Fi without Safari:

1. Download `AeroFighter-1.0.5.ipa` from the release.
2. Open **Sideloadly** or **AltStore**.
3. Drag and drop `AeroFighter-1.0.5.ipa`.
4. Since the IPA is already pre-signed with your registered UDID Ad Hoc profile, installation takes just seconds and never expires as long as your developer subscription is active!

---

## 12. Common Build & Signing Errors and Solutions

### Error 1: `No profile matching 'UUID' found`
- **Cause**: The profile UUID in `ExportOptions.plist` doesn't match the installed profile, or bundle identifier mismatch.
- **Solution**: The workflow extracts the UUID dynamically using `security cms -D -i profile.mobileprovision | plutil -extract UUID raw -` so this error is prevented automatically. Ensure your `app.json` `ios.bundleIdentifier` matches your App ID in Apple Developer Portal (`com.aerofighter.game`).

### Error 2: `Provisioning profile doesn't include signing certificate`
- **Cause**: The `.mobileprovision` was created before the certificate was generated, or selected a different certificate in the portal.
- **Solution**: In Apple Developer Portal, edit your Ad Hoc profile, ensure the checkbox next to your **Apple Distribution** certificate is ticked, click **Save**, download the updated profile, re-encode to Base64, and update `IOS_PROVISIONING_PROFILE_BASE64`.

### Error 3: `Device identifier not included in provisioning profile`
- **Cause**: The iPhone attempting to install the app was not registered or selected in the profile.
- **Solution**: Register the iPhone's UDID under **Devices**, regenerate the Ad Hoc profile, download, and update `IOS_PROVISIONING_PROFILE_BASE64`.

### Error 4: `Unable to install "AeroFighter" - The app could not be verified`
- **Cause**: Developer Certificate not trusted on the iPhone, or Developer Mode is disabled.
- **Solution**:
  1. On your iPhone: **Settings &gt; General &gt; VPN &amp; Device Management &gt; Trust [Your Name]**.
  2. If running iOS 16+: **Settings &gt; Privacy &amp; Security &gt; Developer Mode &gt; Turn On** and restart.

### Error 5: Safari OTA `Cannot connect to github.com`
- **Cause**: iOS requires HTTPS and a direct MIME-type `text/xml` response. GitHub release asset links redirect (302) to AWS S3.
- **Solution**: In `install.html`, we provide both the `itms-services://` OTA protocol and the direct `.ipa` download link. If Apple Safari times out on S3 redirects, download the `.ipa` and install via Sideloadly/AltStore or host `manifest.plist` on GitHub Pages (`raw.githubusercontent.com`).

---

## Summary of Files Configured

- **Workflow**: [`.github/workflows/ios-release.yml`](file:///home/hijack/Documents/AEROFIGHER/.github/workflows/ios-release.yml)
- **OTA Generator**: [`scripts/generate-ota-manifest.sh`](file:///home/hijack/Documents/AEROFIGHER/scripts/generate-ota-manifest.sh)
- **App Configuration**: [`app.json`](file:///home/hijack/Documents/AEROFIGHER/app.json) (Configured `ios.bundleIdentifier: "com.aerofighter.game"` & `scheme: "aerofighter"`)
- **Documentation**: [`IOS_BUILD_GUIDE.md`](file:///home/hijack/Documents/AEROFIGHER/IOS_BUILD_GUIDE.md)
