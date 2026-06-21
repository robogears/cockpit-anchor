# What's new in v0.2.2

## Highlights
- ⌨️ **The black-screen auto-fix now follows your Virtual Desktop keybind.** The fix works by sending VD's **"Toggle VR Mode"** hotkey for you (it was hardcoded to `Shift+Win+D`). Now the app reads VD's `BindingSettings.json` and, if you've **remapped** "Toggle VR Mode" to something else, the auto-bounce uses *your* combo instead. If you're on the default binding (most people), nothing changes — it stays `Shift+Win+D`.

> ⚠️ **Beta, and built by AI** — expect rough edges, back up your data, use at your own risk. See the [README](https://github.com/robogears/cockpit-anchor#readme).

---

# Install

Download **`CockpitAnchor-Setup.exe`** below and run it. *(Windows SmartScreen → **More info → Run anyway**; the app is unsigned.)* Then click **Install layer** in the app.

Manual / layer-only: **`CockpitAnchor-v0.2.2.zip`** → extract → `Install.bat`.

Already on v0.2.x? The app can update itself — hit **Check for updates**.

## Requirements
- Assetto Corsa (original) via Content Manager + Custom Shaders Patch, **OpenVR** rendering mode
- **OpenComposite** (routes AC's OpenVR to OpenXR)
- **Virtual Desktop** with the **VDXR** runtime; Meta Quest on a **Roomscale** boundary
- Virtual Desktop's **"Center to play space (Stage tracking)"** turned **ON**

---

**Full Changelog**: https://github.com/robogears/cockpit-anchor/compare/v0.2.1...v0.2.2
