# 🏎️ Cockpit Anchor **(BETA)**

**Your VR driving seat in the exact same spot every single time you play Assetto Corsa — no more fiddling to recenter.**

---

## The problem this fixes

If you play Assetto Corsa in VR, you've probably hit this annoying thing:

Every time you start, the in-game cockpit shows up in a slightly **different place**. The wheel is too far away, or you're sitting too high, or the whole car is rotated a bit from where your real wheel is. So *every single session* you have to **recenter** the view to line it up — and it's never quite the same twice.

Why? Because Assetto Corsa decides "where you're sitting" based on **wherever your head happens to be the moment the track loads**. Lean forward while it's loading and your whole cockpit shifts forward. It forgets your position the moment you close the game.

## What Cockpit Anchor does

It makes the game **remember your perfect seating position and put you there automatically, every time** — locked to your real chair and wheel.

> 🪑 Think of it like the **memory seat buttons in a nice car**. Set your position once, and it always comes back to exactly where you like it. No adjusting, no recentering, ever.

You set it up **one time** — sit how you normally drive, press one keyboard shortcut — and you're done. Reboot your PC, leave the headset off for a week, close and reopen the game: your cockpit is always right where it should be.

---

## What you need before you start

This tool is made for one specific (and very common) VR setup. You'll need **all** of these:

- ✅ A **Meta Quest** headset (Quest 2, 3, or Pro)
- ✅ **[Virtual Desktop](https://www.vrdesktop.net/)** — the paid app most people use to play PC VR wirelessly on a Quest
- ✅ **Assetto Corsa** — the original game (*not* Competizione), launched through **Content Manager**
- ✅ **Custom Shaders Patch (CSP)** installed — if you already do VR mods in AC, you almost certainly have this
- ✅ A **Windows PC**

New to some of these words? Don't worry — every setup step below explains what it is and *why* you're doing it.

---

## Setup — step by step

There are **four parts**. Do them in order. It looks like a lot the first time, but you only ever do it once, and each step is just a few clicks.

### Part 1 — Point Assetto Corsa at your headset the better way

Out of the box, Assetto Corsa sends VR through older software called **SteamVR**. For a Quest on Virtual Desktop there's a faster, smoother path — and Cockpit Anchor needs that path. Two small changes:

**1a. Switch the game to "OpenVR" mode**
- Open **Content Manager** → **Settings** → **Assetto Corsa** → **Video**.
- Set **Rendering Mode** to **OpenVR**. *(This just makes the game output VR in a standard way.)*

**1b. Install "OpenComposite"**
OpenComposite is a tiny free file that lets Assetto Corsa talk to your Quest directly, skipping the slow middle-man.
1. Download it from <https://gitlab.com/znixian/OpenOVR> (you want the ready-made `openvr_api.dll`).
2. Open your Assetto Corsa folder and go into `system\x64`. It's usually here:
   `C:\Program Files (x86)\Steam\steamapps\common\assettocorsa\system\x64`
3. In that folder, **rename** the file `openvr_api.dll` → `openvr_api_original.dll`. *(That's your backup — to undo everything, just rename it back.)*
4. **Copy in** the `openvr_api.dll` you downloaded from OpenComposite.

> 💡 **What you just did:** swapped one file so the game's VR picture goes straight to Virtual Desktop instead of through SteamVR. Fully reversible thanks to the backup.

### Part 2 — Tell Virtual Desktop to use the fast runtime

- On your **PC**, open the **Virtual Desktop Streamer** app (the little icon near your clock).
- Find the **OpenXR Runtime** setting and set it to **VirtualDesktopXR (VDXR)**.
- Make sure **SteamVR is closed** when you play.

### Part 3 — Set up your room boundary ⭐ (the important one)

Cockpit Anchor locks your seat to your **real room**, using your headset's boundary as the anchor point. So that boundary has to be the "room-scale" type.

- On your **Quest**, set your boundary (Guardian) to **Roomscale**, *not* "Stationary." Draw it so it includes your driving rig.
- Back in the **Virtual Desktop Streamer**, find **"Center to play space (Stage tracking)"** and turn it **OFF**.

> ⚠️ **Don't skip that last toggle.** If it's **ON**, the game can launch to a **black screen** until you manually switch to VR. Cockpit Anchor does the room anchoring itself, so this setting must be **OFF**.

### Part 4 — Install Cockpit Anchor

1. On the **[latest release](../../releases/latest)** page, download the **zip** (e.g. `CockpitAnchor-v0.1.1.zip`) and **extract it** somewhere you'll keep it. You'll get a folder containing the program, `install.ps1`, and `uninstall.ps1`.
2. Install it **as administrator** (it needs admin to register itself):
   - Click **Start**, type **PowerShell**, **right-click** "Windows PowerShell," and choose **Run as administrator**.
   - In the blue window, type this — with the **space** at the end — but **don't press Enter yet**:
     ```
     powershell -ExecutionPolicy Bypass -File 
     ```
   - Now **drag `install.ps1` from the extracted folder into the blue window** (this pastes its full path for you), then press **Enter**.
   - It prints "Installed Cockpit Anchor." Done.

---

## Set it up once (calibration)

Here's the payoff. You only do this **one time**.

1. Headset on, Virtual Desktop connected, launch Assetto Corsa from Content Manager.
2. Get into a car and onto a track.
3. **Sit the way you actually drive** — comfortable, hands where your real wheel is.
4. If the cockpit isn't lined up, do a normal recenter so it looks right.
5. Press **`Ctrl` + `Shift` + `S`** on your keyboard.
   - You'll hear **two quick rising beeps** 🔊 — that means your seat is saved.

**Done forever.** From now on the cockpit loads in that exact spot every time. You never recenter again.

---

## Everyday use

| What you want | Press |
|---|---|
| **Save / set your seat** — two rising beeps mean saved | `Ctrl` + `Shift` + `S` |
| **Unlock to move your seat** — one lower beep | `Ctrl` + `Shift` + `B` |

Most days you'll never touch these. The seat just stays put.

**To move your seat later:** press `Ctrl+Shift+B` (this frees things up so a recenter works again), get the cockpit where you want it, then press `Ctrl+Shift+S` to lock in the new spot.

---

## If something's not right

| Problem | What to do |
|---|---|
| Cockpit is in the wrong place after I redrew my Quest boundary | Your room reference moved — just re-calibrate: get in a car, press `Ctrl+Shift+S`. |
| I want to turn it off for a session | Press `Ctrl+Shift+B`, or remove it with `uninstall.ps1`. |
| Black screen when the game launches | Double-check **"Center to play space (Stage tracking)" is OFF** in Virtual Desktop (Part 3). |
| Doesn't seem to do anything | Open the log at `%LOCALAPPDATA%\CockpitAnchor\cockpit-anchor.log` — it should say the layer loaded for Assetto Corsa. |

## Uninstall

Run `uninstall.ps1` as administrator (same way you ran the installer). That removes Cockpit Anchor completely — your Assetto Corsa and Virtual Desktop settings are untouched.

---

## For the curious — how it actually works

*(Totally optional — you don't need this to use it.)*

Your headset tracks two different "origins":
- a **seated** one that resets to wherever your head is each time a game starts (this is what makes AC's cockpit wander), and
- a **room** one that's fixed to your physical floor and stays put across sessions and reboots.

Cockpit Anchor is a small piece of software that quietly sits between Assetto Corsa and your headset. When the game asks for that wandering *seated* origin, Cockpit Anchor hands it your saved *room* origin instead. The game can't tell the difference — it just always loads you in the same physical spot. And it only ever activates for Assetto Corsa, so all your other VR games are left completely alone.

---

## Credits & license

Built on [OpenXR](https://github.com/KhronosGroup/OpenXR-SDK), [OpenComposite](https://gitlab.com/znixian/OpenOVR), and [VirtualDesktopXR](https://github.com/mbucchia/VirtualDesktop-OpenXR).

MIT licensed — free to use, modify, and share. See [LICENSE](LICENSE).
