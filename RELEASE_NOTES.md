# What's new in v0.1.2

First public release of **Cockpit Anchor** — your Assetto Corsa VR cockpit loads in the same physical seat every time, with no manual recentering.

## Highlights
- **Set-and-forget seat anchor** — calibrate once with `Ctrl+Shift+S`, and the cockpit loads in the exact same real-world spot every session, across launches and reboots.
- **One-click install** — download the zip, extract, double-click `Install.bat`. No command line, no typing paths.
- **Update-safe** — installing a newer version cleanly replaces the old one, and your saved seat is kept.
- **Only touches Assetto Corsa** — the layer stays completely inert in every other OpenXR app on your PC.

> ⚠️ **Beta, and built by AI** — expect rough edges, back up your data, use at your own risk. See the README for details.

---

# Install

1. Download **`CockpitAnchor-v0.1.2.zip`** below and **extract** it.
2. Double-click **`Install.bat`** and click **Yes** (it needs admin to register itself).
3. Do the one-time VR setup in the [README](https://github.com/robogears/cockpit-anchor#readme), then get in a car and press **`Ctrl+Shift+S`** to calibrate.

Your saved seat lives in `%LOCALAPPDATA%\CockpitAnchor\` (kept across updates).

## Requirements

- Assetto Corsa (original) via Content Manager + Custom Shaders Patch, **OpenVR** rendering mode
- **OpenComposite** (routes AC's OpenVR to OpenXR)
- **Virtual Desktop** with the **VDXR** runtime; Meta Quest on a **Roomscale** boundary
- Virtual Desktop's **"Center to play space (Stage tracking)"** turned **OFF**

---

**Full Changelog**: https://github.com/robogears/cockpit-anchor/compare/v0.1.1...v0.1.2
