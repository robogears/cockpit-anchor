# What's new in v0.2.8

**Makes the layer registration durable, so the anchoring + auto-fix can't silently stop working.**

- The OpenXR layer manifest is now written to a **stable location** (`%LOCALAPPDATA%\CockpitAnchor`)
  that survives app updates, instead of inside the app folder (which every in-app update replaces).
  It points at the app's bundled DLL, so the layer still **auto-upgrades** with each update.
- The control panel now **honestly detects** the layer: it only shows "active" when the registered
  manifest and its DLL actually exist. If a registration ever goes stale, you'll see **Layer OFFLINE →
  Install layer** instead of a false "active."

*Background:* a stale registration — e.g. from the old layer-only zip run straight out of a temporary
folder — could point at files Windows later deleted, leaving the layer unable to load. This release
prevents that and makes it visible if it ever happens.

> ⚠️ **Beta, and built by AI** — see the [README](https://github.com/robogears/cockpit-anchor#readme).

---

# Install

Download **`CockpitAnchor-Setup.exe`** and run it *(SmartScreen → More info → Run anyway)*, then
**Install layer** in the app. Already installed? Use **Check for updates → Get the update → Click to restart**.

## Requirements
- Assetto Corsa (original) via Content Manager + Custom Shaders Patch, **OpenVR** rendering mode
- **OpenComposite**; **Virtual Desktop** with **VDXR**; Meta Quest on a **Roomscale** boundary; **Stage tracking ON**

---

**Full Changelog**: https://github.com/robogears/cockpit-anchor/compare/v0.2.7...v0.2.8
