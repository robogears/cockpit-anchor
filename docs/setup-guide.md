# Setup Guide

One-time setup to anchor your Assetto Corsa VR cockpit on Meta Quest + Virtual Desktop.

## 1. VR pipeline (OpenComposite → VDXR)

Cockpit Anchor needs AC running on OpenXR via OpenComposite, streamed through Virtual Desktop's VDXR runtime (not SteamVR).

1. In **Content Manager → Settings → Assetto Corsa → Video**, set **Rendering Mode = OpenVR**.
2. Install **OpenComposite** into AC: in `assettocorsa\system\x64`, rename the existing `openvr_api.dll` to `openvr_api_original.dll` (backup) and drop in OpenComposite's `openvr_api.dll`. Source: <https://gitlab.com/znixian/OpenOVR>.
3. In the **Virtual Desktop Streamer** (PC app), set **OpenXR Runtime = VirtualDesktopXR (VDXR)**.
4. Make sure **SteamVR is not running**.

## 2. Headset / Virtual Desktop settings

1. Set your **Quest boundary to Roomscale** (not Stationary), drawn to include your rig.
2. In the Virtual Desktop Streamer, **turn OFF "Center to play space (Stage tracking)."**
   - *Why:* with it on, Virtual Desktop's VR handoff can fail on launch and the headset stays black until you manually switch to VR. Cockpit Anchor manages the `STAGE` re-basing itself, so this setting must be **off**.
3. Connect to your PC over Virtual Desktop wirelessly (VDXR doesn't work over Link/AirLink).

## 3. Install the layer

Run `install.ps1` **as administrator** (see the [README](../README.md)).

## 4. Calibrate (once)

1. Launch AC from Content Manager, get into a car.
2. Sit in your real driving position; recenter so the cockpit lines up with your wheel.
3. Press **Ctrl + Shift + S** — two ascending beeps mean it's saved.

Done. Every launch from now on loads the cockpit in the same physical spot, no recenter.

## Re-positioning later

**Ctrl + Shift + B** (frees recenter) → recenter to reposition → **Ctrl + Shift + S** (saves + re-locks).

## Troubleshooting

- **Cockpit in the wrong place after a guardian redraw:** re-calibrate with Ctrl+Shift+S. Redrawing the boundary moves your room's reference frame.
- **Turn the effect off temporarily:** Ctrl+Shift+B, or set the environment variable `XR_APILAYER_COCKPITANCHOR_DISABLE=1`.
- **Logs:** `%LOCALAPPDATA%\CockpitAnchor\cockpit-anchor.log`.
- **Remove completely:** run `uninstall.ps1` as administrator.
