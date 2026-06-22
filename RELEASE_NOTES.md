# What's new in v0.2.10

**Fixes the game icons not showing.** They were resolving correctly but the control panel's
content-security-policy was blocking the `data:` image they're delivered as, so you'd see a
broken-image placeholder. Now Assetto Corsa, iRacing, and any located game show their real icon
next to the name.

No other changes from v0.2.9.

> ⚠️ **Beta, and built by AI** — see the [README](https://github.com/robogears/cockpit-anchor#readme).

---

# Install

Download **`CockpitAnchor-Setup.exe`** and run it *(SmartScreen → More info → Run anyway)*, then
**Install layer** in the app. Already installed? Use **Check for updates → Get the update → Click to restart**.

## Requirements
- A seated VR sim through **VDXR** (Assetto Corsa via OpenComposite is the tested one; others via native OpenXR)
- **Virtual Desktop**; Meta Quest on a **Roomscale** boundary; **Stage tracking ON**

---

**Full Changelog**: https://github.com/robogears/cockpit-anchor/compare/v0.2.9...v0.2.10
