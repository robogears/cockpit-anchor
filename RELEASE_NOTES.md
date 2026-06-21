# What's new in v0.2.7

**Window buttons now behave like a proper tray app:**

- **Minimize (–)** → drops to the **system tray** (out of the taskbar). Click the tray icon to bring it back.
- **Exit (✕)** → **quits the control panel entirely.**

This is safe because the anchoring + auto-fix run in the OpenXR **layer**, which is installed
system-wide and loads inside Assetto Corsa whether or not the control panel is open. So you can quit
the app and everything still works — reopen it only when you want to change settings or check status.

> ⚠️ **Beta, and built by AI** — see the [README](https://github.com/robogears/cockpit-anchor#readme).

---

# Install

Download **`CockpitAnchor-Setup.exe`** and run it *(SmartScreen → More info → Run anyway)*, then
**Install layer** in the app. Already installed? Use **Check for updates → Get the update → Click to restart**.

## Requirements
- Assetto Corsa (original) via Content Manager + Custom Shaders Patch, **OpenVR** rendering mode
- **OpenComposite**; **Virtual Desktop** with **VDXR**; Meta Quest on a **Roomscale** boundary; **Stage tracking ON**

---

**Full Changelog**: https://github.com/robogears/cockpit-anchor/compare/v0.2.6...v0.2.7
