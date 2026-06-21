# What's new in v0.2.5

**Fixes the in-app updater.** Previously, **Click to restart** could close the app without
reinstalling or relaunching. The update helper now runs as a detached process that survives the
quit, waits for the old app to fully exit, installs silently, verifies the new build, and relaunches
it — logging each step to `%TEMP%\cockpitanchor-update.log` for diagnosis.

Releases now ship **only** `CockpitAnchor-Setup.exe` (the layer-only zip is retired).

> ℹ️ **Bootstrapping note:** the updater that runs during an update is the one baked into the
> version you're updating *from*. If you're on v0.2.3/v0.2.4, install this build manually once
> (download & run `CockpitAnchor-Setup.exe`); from v0.2.5 onward the in-app updater works.

> ⚠️ **Beta, and built by AI** — see the [README](https://github.com/robogears/cockpit-anchor#readme).

---

# Install

Download **`CockpitAnchor-Setup.exe`** and run it *(SmartScreen → More info → Run anyway)*, then
**Install layer** in the app.

## Requirements
- Assetto Corsa (original) via Content Manager + Custom Shaders Patch, **OpenVR** rendering mode
- **OpenComposite**; **Virtual Desktop** with **VDXR**; Meta Quest on a **Roomscale** boundary; **Stage tracking ON**

---

**Full Changelog**: https://github.com/robogears/cockpit-anchor/compare/v0.2.4...v0.2.5
