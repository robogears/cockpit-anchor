# Cockpit Anchor

Make Assetto Corsa's VR cockpit load in the **same physical seat every time** — no manual recenter, ever.

Cockpit Anchor is a small **OpenXR API layer** that runs inside Assetto Corsa and pins its seated origin to a fixed point in your room (the OpenXR `STAGE` frame, tied to your headset's guardian). You calibrate once; every launch after that drops you into the exact same spot, correctly aligned to your real wheel.

Built for **Meta Quest + Virtual Desktop (VDXR) + OpenComposite** — the common wireless PCVR path for AC.

## Why

Native AC VR anchors to a *seated* origin that re-zeros to wherever your head is at launch, so the cockpit lands in a different place every session and you recenter constantly. Cockpit Anchor swaps that origin for a room-fixed one, so it just stays put.

## Requirements

- Assetto Corsa (original) via **Content Manager** + **Custom Shaders Patch**, **OpenVR** rendering mode
- **OpenComposite** (translates AC's OpenVR to OpenXR) — <https://gitlab.com/znixian/OpenOVR>
- **Virtual Desktop** with the **VDXR** runtime; Meta Quest on a **Roomscale** boundary
- Virtual Desktop's **"Center to play space (Stage tracking)"** turned **OFF**
- Windows, plus a one-time admin step to register the layer

## Install

1. Download `CockpitAnchorLayer.dll`, `install.ps1`, `uninstall.ps1` from the [latest release](../../releases/latest) into a folder you'll keep.
2. Run the installer **as administrator**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File install.ps1
   ```
   It registers the layer and generates its manifest automatically (relocatable — works from any folder).
3. Follow [docs/setup-guide.md](docs/setup-guide.md) for the one-time VR setup.

## Use

| Hotkey | Action |
|---|---|
| **Ctrl + Shift + S** | Save / calibrate the seat — two ascending beeps = saved |
| **Ctrl + Shift + B** | Bypass (free recenter to reposition); a save re-locks |

**First time:** get in a car, sit in your real driving position, recenter so the cockpit lines up, press **Ctrl+Shift+S**. It now persists across launches and reboots.

**Move the seat later:** **Ctrl+Shift+B** → recenter to reposition → **Ctrl+Shift+S** to save.

## How it works

The layer intercepts `xrCreateReferenceSpace`. When AC asks for its seated `LOCAL` space and an anchor is saved, it returns a room-fixed `STAGE` space whose origin is your saved pose. The pose is captured and re-applied in the *same* `STAGE` frame, so there's no coordinate/handedness conversion — it reproduces exactly what looked right at calibration. The layer activates **only for Assetto Corsa** and stays completely inert in every other OpenXR app.

## Known limitations

- One anchor shared across all cars (per-car *seat feel* is handled by AC/CSP's own seat adjustment).
- Redrawing your Quest guardian moves the room frame — re-calibrate (Ctrl+Shift+S) once.
- Windows + Assetto Corsa only.

## Build from source

Needs Visual Studio (MSVC, C++) and the OpenXR SDK headers:

```powershell
git clone --depth 1 https://github.com/KhronosGroup/OpenXR-SDK deps/OpenXR-SDK
powershell -ExecutionPolicy Bypass -File api-layer/build.ps1
```

Releases are built by GitHub Actions — see [`.github/workflows/build.yml`](.github/workflows/build.yml).

## Uninstall

Run `uninstall.ps1` as administrator.

## Credits

- [OpenXR SDK](https://github.com/KhronosGroup/OpenXR-SDK) — Khronos Group
- [OpenComposite](https://gitlab.com/znixian/OpenOVR)
- [VirtualDesktopXR (VDXR)](https://github.com/mbucchia/VirtualDesktop-OpenXR)

## License

MIT — see [LICENSE](LICENSE).
