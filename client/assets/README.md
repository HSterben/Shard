# App icons

- **icon.png** – Used for the system tray (recommended: 32×32 or 64×64). The app will run without it (fallback icon).
- **icon.ico** – Optional: for the Windows EXE and installer. To use it, add to `forge.config.js` under `packagerConfig`: `icon: path.join(__dirname, 'assets', 'icon')`. Use a multi-size .ico (e.g. 256×256, 48×48, 32×32, 16×16).
