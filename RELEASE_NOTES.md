# What's new in v0.2.9

**Multi-game support + a shared seat across games, plus real game icons.**

- **One seat for every game (default).** Calibrate once and every enabled game loads the same physical
  seat — no more setting an anchor per game. The layer now activates for any game you've enabled, not
  just Assetto Corsa.
- **New toggle — "Shared seat across games."** On by default. Turn it **off** to keep a separate seat
  per game instead.
- **Game icons.** The control panel now finds each game's `.exe` (Steam library / common locations) and
  shows its real icon next to the name.
- The **auto-fix bounce stays Assetto-Corsa-only** — it's the game with the launch black screen; other
  games (e.g. iRacing, native OpenXR) get anchoring without the unnecessary VR flip.

> ⚠️ **Beta, and built by AI** — see the [README](https://github.com/robogears/cockpit-anchor#readme).

---

# Install

Download **`CockpitAnchor-Setup.exe`** and run it *(SmartScreen → More info → Run anyway)*, then
**Install layer** in the app. Already installed? Use **Check for updates → Get the update → Click to restart**.

## Requirements
- A seated VR sim through **VDXR** (Assetto Corsa via OpenComposite is the tested one; others via native OpenXR)
- **Virtual Desktop**; Meta Quest on a **Roomscale** boundary; **Stage tracking ON**

---

**Full Changelog**: https://github.com/robogears/cockpit-anchor/compare/v0.2.8...v0.2.9
