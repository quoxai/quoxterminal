# QuoxTerminal — Apple Distribution Plan

## Status: Planning
## Author: Adam / Claude
## Date: 2026-03-02

---

## TL;DR

| Channel | Effort | Timeline | Result |
|---------|--------|----------|--------|
| **Developer ID + Notarization** | 1-2 hours setup | Same day (if individual account) | No "damaged" warning, no `xattr` hack |
| **TestFlight** | Skip | N/A | Same sandbox problems as App Store |
| **Mac App Store** | Major rework | Weeks | Local terminal won't work in sandbox |

**Recommendation:** Do Phase 1 (Developer ID signing + notarization) now. It's the only thing needed to make downloads "just work". App Store is a future consideration and would require a cut-down SSH-only edition.

---

## Phase 1: Developer ID Signing + Notarization (DO THIS)

This eliminates the "damaged" Gatekeeper error. Users download the `.dmg`, drag to Applications, and open — no Terminal commands needed.

### Prerequisites

You already have an Apple Developer account (NodeVPN). Check if it's enrolled as:
- **Individual** — ready to go, create certificates immediately
- **Organization (Quox Ltd)** — needs a DUNS number (see Phase 3)

If your existing NodeVPN account is individual, you can create Developer ID certificates today.

### Step 1: Create Developer ID Application Certificate

On your Mac:

1. Open **Keychain Access** > Certificate Assistant > Request a Certificate from a Certificate Authority
2. Save the `.certSigningRequest` file
3. Go to https://developer.apple.com/account/resources/certificates/list
4. Click **+** > select **Developer ID Application**
5. Upload your CSR, download the `.cer`
6. Double-click to install in your login keychain
7. Verify:
   ```bash
   security find-identity -v -p codesigning
   # Should show: "Developer ID Application: Your Name (TEAMID)"
   ```

### Step 2: Export Certificate for CI

In Keychain Access:

1. Find your "Developer ID Application" certificate
2. Right-click > Export > save as `.p12` with a strong password
3. Base64 encode it:
   ```bash
   base64 -i QuoxTerminal.p12 | tr -d '\n' | pbcopy
   ```
4. **Delete the .p12 file after storing in GitHub Secrets**

### Step 3: Create App-Specific Password

1. Go to https://appleid.apple.com > Sign-In and Security > App-Specific Passwords
2. Generate one, label it "QuoxTerminal CI"
3. Copy the password (format: `xxxx-xxxx-xxxx-xxxx`)

### Step 4: Set GitHub Secrets

Go to https://github.com/quoxai/quoxterminal/settings/secrets/actions and add:

| Secret | Value |
|--------|-------|
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` from Step 2 |
| `APPLE_CERTIFICATE_PASSWORD` | Password you set during `.p12` export |
| `APPLE_SIGNING_IDENTITY` | `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_TEAM_ID` | Your 10-char Team ID (from developer.apple.com > Membership) |
| `APPLE_ID` | Your Apple ID email |
| `APPLE_PASSWORD` | App-specific password from Step 3 |

### Step 5: Create Entitlements File

File: `quox-terminal/src-tauri/Entitlements.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
</dict>
</plist>
```

These are required because Tauri's WebView (WKWebView) needs JIT compilation. Without them the app crashes after notarization.

PTY/SSH child processes work fine with hardened runtime — no extra entitlements needed.

### Step 6: Update tauri.conf.json

Add to the `bundle` section:

```json
"macOS": {
  "signingIdentity": null,
  "entitlements": "./Entitlements.plist",
  "minimumSystemVersion": "11.0"
}
```

(`signingIdentity: null` means it reads from the `APPLE_SIGNING_IDENTITY` env var, which is set in CI.)

### Step 7: Update release.yml

The workflow needs a certificate import step before the Tauri build. The full updated workflow is in the appendix below.

Key changes:
- Certificate import step creates a temporary keychain and imports the `.p12`
- All `APPLE_*` env vars passed to `tauri-action`
- Tauri automatically signs, notarizes, and staples the `.dmg`
- Remove the `xattr -cr` instructions from release notes (no longer needed!)

### Step 8: Tag and Release

```bash
git tag v0.2.1
git push origin v0.2.1
```

The build will take ~8-10 minutes (notarization adds ~3-5 min). The resulting `.dmg` will open without any Gatekeeper warnings.

---

## Phase 2: DUNS Number (if enrolling Quox Ltd as organization)

If you want the certificate to say "Quox Ltd" instead of your personal name, you need to enroll the Apple Developer Program as an organization. This requires a DUNS number.

### Do You Need This?

- **Personal name is fine for now** — "Developer ID Application: Adam Cowles (TEAMID)" works perfectly for signing. Users never see this unless they inspect the certificate.
- **Organization enrollment** — shows "Quox Ltd" in the certificate. More professional but takes 2-4 weeks.

### If You Want Organization Enrollment

1. **Check if Quox Ltd already has a DUNS number:**
   - Go to https://developer.apple.com/enroll/duns-lookup/ during enrollment
   - Search for "Quox Ltd" with your UK address

2. **If not found, request one (free):**
   - Submit business details through Apple's DUNS lookup tool
   - Dun & Bradstreet assigns the number in ~5 business days
   - Must match your **exact legal entity name** on Companies House

3. **Wait for propagation** — after DUNS is assigned, it takes up to 2 weeks to appear in Apple's systems

4. **Enroll as organization** at https://developer.apple.com/programs/enroll/
   - Apple may call/email to verify (1-3 business days)

**Total timeline: 2-4 weeks**

### Can You Use Your NodeVPN Account?

If your NodeVPN developer account is already enrolled (individual or org), you can create Developer ID certificates under that account immediately. The certificate will show the name on that account. You can always add Quox Ltd as a separate enrollment later.

---

## Phase 3: Mac App Store (Future — Major Caveats)

### The Problem

The App Store **requires App Sandbox**. This breaks QuoxTerminal's core feature:

| Feature | Works in Sandbox? | Why |
|---------|-------------------|-----|
| Local PTY (shell) | **No** | Shell can't set `tty pgrp`, filesystem restricted to container |
| SSH client | Yes | Network entitlement covers outbound connections |
| AI chat | Yes | HTTPS to api.anthropic.com works fine |
| Fleet dashboard | Yes | WebSocket connections work with network entitlement |
| File operations | Partial | Only user-selected files (via open/save dialog) |

No major terminal app ships local PTY on the App Store — iTerm2, Warp, Alacritty, Kitty all distribute directly. Only SSH-only clients (Prompt 3, Core Shell) are on the store.

### If We Still Want App Store Presence

Create a **separate "QuoxTerminal Lite"** build:
- SSH client + fleet dashboard + AI chat (all sandbox-compatible)
- Remove local PTY feature
- Separate `tauri.appstore.conf.json` with sandbox entitlements
- Separate CI job that builds for App Store submission
- Different app identifier (e.g., `com.quox.terminal-lite`)

### App Store Requirements

| Item | Details |
|------|---------|
| **Apple Distribution certificate** | Different from Developer ID |
| **Mac Installer Distribution certificate** | Signs the `.pkg` for upload |
| **Provisioning profile** | Mac App Store type |
| **App Sandbox entitlement** | Required, breaks local PTY |
| **App Store Connect listing** | Screenshots, description, privacy policy |
| **App Review** | 1-5 business days |

### Recommendation

**Don't pursue App Store now.** The effort is high and the product would be significantly reduced. Revisit only if:
- Users specifically request App Store availability
- You want the marketing visibility of being in the store
- You build the SSH-only "Lite" edition anyway

---

## Skip: TestFlight

TestFlight uses the **same App Store pipeline** — same sandbox, same certificates, same restrictions. It offers no advantage over sharing signed `.dmg` files via GitHub Releases.

For beta testing, use GitHub Release drafts instead:
```bash
# Create a draft release (not visible to public)
gh release create v0.2.1-beta --draft --title "v0.2.1 Beta"
```

---

## Appendix: Full release.yml with Signing

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: write

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-latest
            target: aarch64-apple-darwin
            label: macOS (Apple Silicon)
          - platform: macos-latest
            target: x86_64-apple-darwin
            label: macOS (Intel)
          - platform: ubuntu-22.04
            target: x86_64-unknown-linux-gnu
            label: Linux (x64)

    name: Build — ${{ matrix.label }}
    runs-on: ${{ matrix.platform }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: quox-terminal/src-tauri -> target

      - name: Install Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: quox-terminal/package-lock.json

      - name: Install Linux dependencies
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev build-essential curl wget file \
            libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

      - name: Import Apple signing certificate
        if: runner.os == 'macOS'
        env:
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
        run: |
          CERT_PATH=$RUNNER_TEMP/certificate.p12
          KEYCHAIN_PATH=$RUNNER_TEMP/build.keychain-db
          KEYCHAIN_PASSWORD=$(openssl rand -base64 24)

          echo "$APPLE_CERTIFICATE" | base64 --decode > "$CERT_PATH"

          security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
          security default-keychain -s "$KEYCHAIN_PATH"
          security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
          security import "$CERT_PATH" \
            -P "$APPLE_CERTIFICATE_PASSWORD" \
            -A -t cert -f pkcs12 -k "$KEYCHAIN_PATH"
          security set-key-partition-list \
            -S apple-tool:,apple: \
            -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
          security list-keychains -d user -s "$KEYCHAIN_PATH"

      - name: Install frontend dependencies
        working-directory: quox-terminal
        run: npm ci

      - name: Build with Tauri
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
        with:
          projectPath: quox-terminal
          tauriScript: npx tauri
          tagName: ${{ github.ref_name }}
          releaseName: QuoxTerminal ${{ github.ref_name }}
          releaseBody: |
            See the [full changelog](https://github.com/${{ github.repository }}/commits/${{ github.ref_name }}) for details.

            ## Install

            | Platform | File |
            |----------|------|
            | macOS (Apple Silicon) | `.dmg` (aarch64) |
            | macOS (Intel) | `.dmg` (x64) |
            | Linux (Debian/Ubuntu) | `.deb` package |
            | Linux (universal) | `.AppImage` |
          releaseDraft: false
          prerelease: false
          args: --target ${{ matrix.target }}
```

---

## Checklist

### Phase 1 — Developer ID (do now)

- [ ] Confirm Apple Developer account type (individual vs org)
- [ ] Create Developer ID Application certificate
- [ ] Export `.p12` and base64 encode
- [ ] Create app-specific password
- [ ] Set 6 GitHub Secrets (`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_TEAM_ID`, `APPLE_ID`, `APPLE_PASSWORD`)
- [ ] Create `Entitlements.plist` (3 entitlements for WebView JIT)
- [ ] Update `tauri.conf.json` with `macOS` bundle section
- [ ] Update `release.yml` with certificate import + signing env vars
- [ ] Tag `v0.2.1` and verify the signed `.dmg` opens without warnings
- [ ] Remove `xattr -cr` instructions from release notes and website

### Phase 2 — DUNS / Org (optional, 2-4 weeks)

- [ ] Check if Quox Ltd has a DUNS number
- [ ] Request DUNS if needed (5 business days)
- [ ] Wait for DUNS propagation (up to 2 weeks)
- [ ] Enroll Quox Ltd in Apple Developer Program
- [ ] Re-create certificates under org account
- [ ] Update GitHub Secrets with new certificate

### Phase 3 — App Store (future, if needed)

- [ ] Decide on "Lite" edition scope (SSH + fleet + AI, no local PTY)
- [ ] Create Apple Distribution + Mac Installer Distribution certificates
- [ ] Create provisioning profile
- [ ] Create `Entitlements.appstore.plist` with sandbox
- [ ] Create `tauri.appstore.conf.json`
- [ ] Set up App Store Connect listing
- [ ] Submit for review
