# What's new in v0.2.0

A big one — Cockpit Anchor gets a **desktop app**, **fixes the launch black screen automatically**, and lays the groundwork for **more sims**.

## Highlights
- 🖥️ **New control-panel app** — a proper installer (`CockpitAnchor-Setup.exe`) with a dark, telemetry-style UI. See your seat-lock status at a glance, choose which games it's active for, and install/uninstall the layer right from the app. It tucks into your system tray.
- ⚫ **Automatic black-screen fix** — Virtual Desktop sometimes launches Assetto Corsa to a black or frozen frame. Cockpit Anchor now clears it for you a second or two after you drop in (the same "pop out to the Virtual Desktop view and back" you'd do by hand). Expect a quick flip on launch — that's it working.
- 🔄 **In-app updates** — the app checks for new releases and can update itself.
- 🎮 **Multi-sim groundwork** — built to support more seated VR sims; for now **Assetto Corsa is the tested, supported one**, with others marked "coming soon" in the app.

> ⚠️ **Beta, and built by AI** — expect rough edges, back up your data, use at your own risk. See the [README](https://github.com/robogears/cockpit-anchor#readme).

---

# Install

**Easy way:** download **`CockpitAnchor-Setup.exe`** below and run it. *(Windows SmartScreen may warn it's from an unknown publisher — click **More info → Run anyway**; the app is unsigned.)* Then click **Install layer** in the app.

**Manual / layer-only:** download **`CockpitAnchor-v0.2.0.zip`**, extract it, and double-click **`Install.bat`**.

Then do the one-time VR setup in the [README](https://github.com/robogears/cockpit-anchor#readme), get in a car, and press **`Ctrl+Shift+S`** to calibrate. Your saved seat lives in `%LOCALAPPDATA%\CockpitAnchor\` and is kept across updates.

## Requirements
- Assetto Corsa (original) via Content Manager + Custom Shaders Patch, **OpenVR** rendering mode
- **OpenComposite** (routes AC's OpenVR to OpenXR)
- **Virtual Desktop** with the **VDXR** runtime; Meta Quest on a **Roomscale** boundary
- Virtual Desktop's **"Center to play space (Stage tracking)"** turned **ON**

---

**Full Changelog**: https://github.com/robogears/cockpit-anchor/compare/v0.1.2...v0.2.0
