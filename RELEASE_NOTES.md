# What's new in v0.1.1

## Persistent VR cockpit anchoring
- First public release. Assetto Corsa's VR cockpit now loads in the **same physical seat every session** — no manual recenter.
- **One-time calibration**: sit in your driving position, press `Ctrl+Shift+S`. The seat is anchored to your room (OpenXR `STAGE`) and persists across launches and reboots.
- Recenter becomes a no-op while anchored; press `Ctrl+Shift+B` to free it up and reposition, then `Ctrl+Shift+S` to re-lock.
- Audible beeps confirm save / bypass through your headset audio.

## Safety & install
- The layer activates **only for Assetto Corsa** and stays completely inert in every other OpenXR app on your machine.
- **Relocatable installer**: run `install.ps1` (as admin) from any folder; it registers the layer and generates its manifest automatically.

---

# Install

- **Windows (Quest + Virtual Desktop)**: download the **zip** below, extract it, then run `install.ps1` as administrator:
  ```powershell
  powershell -ExecutionPolicy Bypass -File install.ps1
  ```
  Then follow the one-time VR setup in the README / `docs/setup-guide.md`.
- Config and the saved anchor live in `%LOCALAPPDATA%\CockpitAnchor\`.

## Requirements

- Assetto Corsa (original) via Content Manager + Custom Shaders Patch, **OpenVR** rendering mode
- **OpenComposite** (routes AC's OpenVR to OpenXR)
- **Virtual Desktop** with the **VDXR** runtime; Meta Quest on a **Roomscale** boundary
- Virtual Desktop's **"Center to play space (Stage tracking)"** turned **OFF**

---

**Full Changelog**: https://github.com/robogears/cockpit-anchor/commits/v0.1.1
