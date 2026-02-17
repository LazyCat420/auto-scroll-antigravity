# Antigravity Automator

Auto-scroll and auto-approve script for the Antigravity chat interface.

## Versions

| File | Version | Description |
|------|---------|-------------|
| `autoscroll.js` | V13 | Precision scroll + popup-safe |
| `autoscroll_V14.js` | V14 | **Recommended** — Stuck-scroll recovery + force-all-containers |

## V14 Features (Latest)

- **Stuck-scroll recovery** — Detects "Step Requires Input" text and force-scrolls ALL scrollable containers to reveal hidden Run buttons.
- **Heartbeat scanner** — Polls every 3s as a safety net to catch missed buttons.
- **Enhanced streaming detection** — Watches `characterData` mutations for better accuracy.
- All V13 features: popup-safe, user scroll-up pauses, excluded-zone button filtering.

## Usage

1. Copy the code from `autoscroll_V14.js` (or `autoscroll.js` for V13)
2. Open the developer console (F12)
3. Paste the code into the console and press Enter
4. The script will automatically start working

## Console Indicators

- `🔍 STUCK DETECTED` — "Step Requires Input" found, forcing all scrollers down
- `🔄 Force-scrolling N containers` — scrolling all nested scrollable elements
- `✅ Stuck state resolved` — button was clicked, normal operation resumed
- `⚡ TRIGGER` — a button was auto-clicked
