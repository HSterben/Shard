# Distributing Shard

Shard is cross-platform: it runs on **Windows**, **macOS**, and **Linux**. Build from the `client` folder.

## Build by platform

- **Windows:** `npm run make:win`
- **macOS:** `npm run make:mac` (must run on a Mac to produce darwin builds)
- **All platforms:** `npm run make` (each maker runs only on its platform; e.g. Squirrel only on Windows)

**Output (Windows):**

- `out/Shard Setup 1.0.0.exe` – Installer (Squirrel). Give this to users to install.
- `out/make/zip/win32/x64/Shard-win32-x64-1.0.0.zip` – Portable zip. Users unzip and run `Shard.exe`.

**Output (macOS):**

- `out/make/zip/darwin/arm64/Shard-darwin-arm64-1.0.0.zip` (Apple Silicon)
- `out/make/zip/darwin/x64/Shard-darwin-x64-1.0.0.zip` (Intel). Users unzip and run `Shard.app`.

**Output (Linux):**

- `out/make/deb/...` and `out/make/rpm/...` when building on Linux.

Installers and zips are under `out/` and `out/make/`.

## Before you distribute

1. **Backend** – Your Convex backend and OpenRouter key are used by the app. Keep the Convex URL and ensure the backend stays deployed and the OpenRouter key has enough quota.
2. **Auth & billing** – You already use Convex auth and Stripe for subscriptions; the EXE talks to your Convex site. No change needed for monetization.
3. **Version** – Bump `version` in `package.json` for each release.
4. **Icon (optional)** – Add `assets/icon.png` for the tray and `assets/icon.ico` for the EXE (see `assets/README.md`). To ship the tray icon with the EXE, add `path.join(__dirname, 'assets')` to `packagerConfig.extraResource` in `forge.config.js` and in `main.js` use `app.isPackaged ? path.join(process.resourcesPath, 'assets', 'icon.png') : path.join(__dirname, '../assets/icon.png')` for the tray icon path.

## Code signing (recommended for distribution)

Unsigned Windows EXEs may trigger SmartScreen. To sign the installer and EXE:

1. Get a code signing certificate (e.g. from DigiCert, Sectigo). You’ll get a `.pfx` file and password.
2. In `forge.config.js`, under the Squirrel maker config, add:

   ```js
   certificateFile: './path/to/your-certificate.pfx',
   certificatePassword: process.env.CERT_PASSWORD,
   ```

3. Set `CERT_PASSWORD` when running `npm run make:win` (don’t commit the password).

## Monetization

- Subscriptions are handled in your app via Stripe and Convex; the EXE is just the client.
- You can sell the installer/zip (e.g. Gumroad, Paddle) or give the EXE for free and keep monetization via in-app subscription only.
