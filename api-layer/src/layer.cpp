// Cockpit Anchor — OpenXR API layer for persistent seated VR cockpit anchoring (Assetto Corsa).
//
// Milestone 5 (this file): CALIBRATION CAPTURE + RE-BASE.
//   * Creates our own STAGE reference space (the room-fixed frame).
//   * Watches xrLocateViews to learn which space AC renders against and to get a valid display time.
//   * Hotkey Ctrl+Shift+S: capture the seated origin's pose in STAGE -> seat anchor (saved to
//     %LOCALAPPDATA%\CockpitAnchor\seat-anchor.json), beep on success, and re-lock (bypass off).
//   * RE-BASE: when AC creates its seated LOCAL space and an anchor exists, we instead hand it a
//     STAGE space pinned to the saved anchor. AC's seated origin becomes a fixed room point ->
//     the cockpit loads in the same physical place every session, no recenter. Captured and applied
//     in the SAME (STAGE) frame, so there is no handedness/sign conversion.
//   * Hotkey Ctrl+Shift+B: BYPASS on — frees AC's recenter so you can reposition; saving (S) re-locks.
//   * Throttled logging of the render-space pose in STAGE so we can watch the result.

#define XR_NO_PROTOTYPES
#include <openxr/openxr.h>
#include <openxr/openxr_loader_negotiation.h>

#include <windows.h>
#include <cstdio>
#include <cstdarg>
#include <cstring>
#include <string>
#include <mutex>
#include <atomic>
#include <fstream>
#include <vector>
#include <cmath>
#include <mmsystem.h>

#pragma comment(lib, "user32.lib")   // GetAsyncKeyState
#pragma comment(lib, "winmm.lib")    // waveOut* (audio feedback)

// ------------------------------------------------------------------ logging
static std::mutex   g_logMutex;
static std::wstring g_dir;
static bool         g_dirInit = false;

static std::wstring DataDir() {
    if (!g_dirInit) {
        wchar_t buf[MAX_PATH];
        DWORD n = GetEnvironmentVariableW(L"LOCALAPPDATA", buf, MAX_PATH);
        g_dir = (n > 0 && n < MAX_PATH) ? std::wstring(buf) : std::wstring(L".");
        g_dir += L"\\CockpitAnchor";
        CreateDirectoryW(g_dir.c_str(), nullptr);
        g_dirInit = true;
    }
    return g_dir;
}

static void Log(const char* fmt, ...) {
    std::lock_guard<std::mutex> lock(g_logMutex);
    std::ofstream f(DataDir() + L"\\cockpit-anchor.log", std::ios::app);
    if (!f) return;
    SYSTEMTIME st; GetLocalTime(&st);
    char ts[48];
    std::snprintf(ts, sizeof(ts), "%04d-%02d-%02d %02d:%02d:%02d.%03d ",
        st.wYear, st.wMonth, st.wDay, st.wHour, st.wMinute, st.wSecond, st.wMilliseconds);
    char msg[1024];
    va_list ap; va_start(ap, fmt);
    std::vsnprintf(msg, sizeof(msg), fmt, ap);
    va_end(ap);
    f << ts << msg << "\n";
}

// ------------------------------------------------------------- anchor (disk)
static XrPosef IdentityPose() { XrPosef p{}; p.orientation.w = 1.0f; return p; }

static std::string g_hostStem;   // host exe stem, lowercase, no extension (e.g. "acs", "iracingsim64dx11")

// Shared-anchor mode: when ON (the default) every enabled game uses ONE anchor (seat-anchor.json), so
// you calibrate once and all games load the same physical seat. When OFF, each game gets its own
// seat-anchor-<stem>.json. The control-panel app writes anchor-mode.txt ("shared" / "unique").
// (A single STAGE-frame anchor is the same physical seat in every game because all games share VDXR's
// one room-fixed play-space origin — so "shared" is meaningful, not a hack.)
static bool SharedAnchorMode() {
    std::ifstream f((DataDir() + L"\\anchor-mode.txt").c_str());
    if (!f) return true;                                  // default: shared
    std::string s; std::getline(f, s);
    size_t a = s.find_first_not_of(" \t\r\n");
    if (a == std::string::npos) return true;              // blank -> shared
    size_t b = s.find_last_not_of(" \t\r\n");
    std::string t;
    for (size_t i = a; i <= b; ++i) { char c = s[i]; t += (c >= 'A' && c <= 'Z') ? (char)(c + 32) : c; }
    return t != "unique";                                 // only the exact "unique" token the app writes flips it
}

// The anchor file for THIS launch: the shared seat-anchor.json (shared mode) or a per-game file.
static std::wstring AnchorPath() {
    if (SharedAnchorMode() || g_hostStem.empty())
        return DataDir() + L"\\seat-anchor.json";        // shared: one seat for every game
    std::wstring stem(g_hostStem.begin(), g_hostStem.end());
    return DataDir() + L"\\seat-anchor-" + stem + L".json";
}

static void SaveAnchor(const XrPosef& p) {
    FILE* f = _wfopen(AnchorPath().c_str(), L"w");
    if (!f) { Log("[calib] could not open seat-anchor.json for write"); return; }
    std::fprintf(f,
        "{\"px\":%.6f,\"py\":%.6f,\"pz\":%.6f,\"qx\":%.6f,\"qy\":%.6f,\"qz\":%.6f,\"qw\":%.6f}\n",
        p.position.x, p.position.y, p.position.z,
        p.orientation.x, p.orientation.y, p.orientation.z, p.orientation.w);
    std::fclose(f);
}

static bool LoadAnchor(XrPosef& out) {
    FILE* f = _wfopen(AnchorPath().c_str(), L"r");
    if (!f) return false;
    float px,py,pz,qx,qy,qz,qw;
    int n = std::fscanf(f,
        "{\"px\":%f,\"py\":%f,\"pz\":%f,\"qx\":%f,\"qy\":%f,\"qz\":%f,\"qw\":%f}",
        &px,&py,&pz,&qx,&qy,&qz,&qw);
    std::fclose(f);
    if (n != 7) return false;
    out.position = {px,py,pz};
    out.orientation = {qx,qy,qz,qw};
    return true;
}

// --------------------------------------------------- next-in-chain pointers
static PFN_xrGetInstanceProcAddr  g_nextGIPA                 = nullptr;
static PFN_xrCreateReferenceSpace g_nextCreateReferenceSpace = nullptr;
static PFN_xrCreateSession        g_nextCreateSession        = nullptr;
static PFN_xrDestroyInstance      g_nextDestroyInstance      = nullptr;
static PFN_xrLocateViews          g_nextLocateViews          = nullptr;
static PFN_xrLocateSpace          g_nextLocateSpace          = nullptr;
static PFN_xrPollEvent            g_nextPollEvent            = nullptr;
static PFN_xrBeginSession         g_nextBeginSession         = nullptr;
static PFN_xrWaitFrame            g_nextWaitFrame            = nullptr;
static PFN_xrEndFrame             g_nextEndFrame             = nullptr;
static PFN_xrEndSession           g_nextEndSession           = nullptr;
static PFN_xrDestroySession       g_nextDestroySession       = nullptr;

// ------------------------------------------------------------------- state
static XrSession g_session    = XR_NULL_HANDLE;
static XrSpace   g_stageSpace = XR_NULL_HANDLE;   // our room-fixed reference
static XrSpace   g_renderSpace = XR_NULL_HANDLE;  // the seated space AC renders against
static XrTime    g_displayTime = 0;

// Session-churn ground truth: with OpenComposite's old behaviour we see 3 xrCreateSession at launch
// (temp-graphics -> real-graphics -> inputs-restart). The deferInputProfileQuery fix should drop that
// to 2. Counters + lifecycle logging let us PROVE the churn shrank and pinpoint which teardown (if any)
// precedes a black frame, without needing to see the headset.
static int g_createCount  = 0;   // xrCreateSession calls so far this instance
static int g_destroyCount = 0;   // xrDestroySession calls so far this instance

// ---- AUTO VR-BOUNCE: programmatic Virtual Desktop dashboard-bounce (Assetto Corsa launch black screen)
// The launch black screen is purely VD-side: on a bad launch AC submits perfect frames (layerCount=1,
// correct poses) but VD's compositor never starts scan-out. The ONE thing that reliably clears it is the
// manual VD bounce — toggling out to the Virtual Desktop environment and back. The user confirmed that
// pressing VD's "Toggle VR Mode" hotkey (Shift+Win+D) TWICE clears it. So once the final session has been
// FOCUSED and settled, we reproduce that automatically: SendInput Shift+Win+D, dwell, Shift+Win+D again.
// (A blank-frame layerCount=0 "nudge" was tried first and did NOT work — blank frames don't trigger VD's
// visibility switch; only the real hotkey does.) Fires ONCE per session generation. It runs on EVERY
// launch — the app looks healthy whether or not VD will go black, so we can't distinguish good from bad;
// the cost is a brief VR→VD→VR flip each load. All tunable; rebuild to change. Disable: BOUNCE_ENABLED=false.
static const bool     BOUNCE_ENABLED  = true;   // master switch
static const unsigned BOUNCE_DELAY_MS = 1500;   // wait this long after the final session reaches FOCUSED
static const unsigned BOUNCE_GAP_MS   = 1200;   // dwell in the VD environment between the two key presses
static std::atomic<int>                g_bounceArmGen{0};   // g_createCount snapshot at FOCUSED (0 = disarmed)
static std::atomic<unsigned long long> g_bounceArmTick{0};  // GetTickCount64() at that FOCUSED
static int                             g_lastBouncedGen = 0; // hotkey-thread only: last generation we bounced
// The chord we send defaults to Shift+Win+D (VD's stock "Toggle VR Mode"), but can be overridden by
// %LOCALAPPDATA%\CockpitAnchor\bounce-key.txt (decimal Windows VK codes, modifiers first then the main
// key). The control-panel app writes that file when it detects a remapped "Toggle VR Mode" in Virtual
// Desktop's BindingSettings.json, so the auto-bounce still works if the user changed the keybind.
static std::vector<WORD>               g_bounceKeys = { VK_LSHIFT, VK_LWIN, 'D' };

static XrPosef           g_anchor = IdentityPose();
static bool              g_anchorValid = false;
static std::atomic<bool> g_enabled{true};        // re-base on/off (Ctrl+Shift+B)
static bool              g_active = false;       // host is an enabled game? gates the anchoring hooks
static bool              g_isAC = false;         // host is Assetto Corsa specifically? gates the auto-bounce
static std::atomic<bool> g_calibrateReq{false};
static std::atomic<int>  g_saveResult{0};        // render thread -> hotkey thread: 1 ok, 2 fail
static std::atomic<bool> g_hotkeyStarted{false};
static unsigned long long g_lastDriftLogMs = 0;

static const char* RefSpaceName(XrReferenceSpaceType t) {
    switch (t) {
        case XR_REFERENCE_SPACE_TYPE_VIEW:  return "VIEW";
        case XR_REFERENCE_SPACE_TYPE_LOCAL: return "LOCAL (seated)";
        case XR_REFERENCE_SPACE_TYPE_STAGE: return "STAGE (room)";
        default:                            return "OTHER";
    }
}

// ------------------------------------------------------------- audio beep
// Plays a short tone through the DEFAULT audio device, so it reaches the Quest
// over Virtual Desktop (a plain Beep() could hit the motherboard speaker instead).
// Called only from the hotkey thread, where blocking for the tone duration is fine.
static void PlayTone(int freq, int ms) {
    const int sr = 44100;
    const int n  = sr * ms / 1000;
    if (n <= 0) return;
    std::vector<short> buf(n);
    const double w    = 2.0 * 3.14159265358979323846 * freq / sr;
    const int    ramp = sr / 200;                       // ~5 ms attack/release, avoids clicks
    for (int i = 0; i < n; ++i) {
        double env = 1.0;
        if (i < ramp)          env = (double)i / ramp;
        else if (i > n - ramp) env = (double)(n - i) / ramp;
        buf[i] = (short)(env * 9000.0 * std::sin(w * i));
    }
    WAVEFORMATEX wfx{};
    wfx.wFormatTag = WAVE_FORMAT_PCM; wfx.nChannels = 1; wfx.nSamplesPerSec = sr;
    wfx.wBitsPerSample = 16; wfx.nBlockAlign = 2; wfx.nAvgBytesPerSec = sr * 2;
    HWAVEOUT hwo = nullptr;
    if (waveOutOpen(&hwo, WAVE_MAPPER, &wfx, 0, 0, CALLBACK_NULL) != MMSYSERR_NOERROR) return;
    WAVEHDR hdr{};
    hdr.lpData = (LPSTR)buf.data();
    hdr.dwBufferLength = (DWORD)(buf.size() * sizeof(short));
    waveOutPrepareHeader(hwo, &hdr, sizeof(hdr));
    waveOutWrite(hwo, &hdr, sizeof(hdr));
    while (!(hdr.dwFlags & WHDR_DONE)) Sleep(3);
    waveOutUnprepareHeader(hwo, &hdr, sizeof(hdr));
    waveOutClose(hwo);
}
static void BeepSaved()   { PlayTone(660, 90); PlayTone(988, 130); }   // two ascending = saved
static void BeepFailed()  { PlayTone(300, 280); }                      // low buzz = failed
static void BeepEnabled() { PlayTone(880, 110); }                      // anchor on
static void BeepBypass()  { PlayTone(440, 130); }                      // anchor off

// Reads a custom bounce chord from %LOCALAPPDATA%\CockpitAnchor\bounce-key.txt if present (the app writes
// it when VD's "Toggle VR Mode" is remapped). Format: decimal VK codes, comma/space-separated, modifiers
// first then the main key (e.g. "162,91,68"). Absent/invalid -> keep the Shift+Win+D default.
static void LoadBounceKeys() {
    std::ifstream f((DataDir() + L"\\bounce-key.txt").c_str());
    if (!f) return;
    std::string line; std::getline(f, line); line.push_back(',');
    std::vector<WORD> ks; std::string cur;
    for (char ch : line) {
        if (ch >= '0' && ch <= '9') cur += ch;
        else if (!cur.empty()) { int v = std::atoi(cur.c_str()); if (v > 0 && v < 256) ks.push_back((WORD)v); cur.clear(); }
    }
    if (ks.size() >= 2 && ks.size() <= 6) {
        g_bounceKeys = ks;
        Log("[bounce] using custom VD Toggle-VR-Mode chord from bounce-key.txt (%d keys)", (int)ks.size());
    }
}

// Sends VD's "Toggle VR Mode" hotkey as one chord (g_bounceKeys; default Shift+Win+D, or the user's
// remapped combo): flips between the VR game and the VD environment. Two of these reproduce the bounce.
static void SendToggleVrMode() {
    const std::vector<WORD>& k = g_bounceKeys;
    const int n = (int)k.size();
    std::vector<INPUT> in(n * 2);
    for (int i = 0; i < n; ++i) {                       // press, in order (modifiers first)
        in[i] = INPUT{}; in[i].type = INPUT_KEYBOARD; in[i].ki.wVk = k[i];
    }
    for (int i = 0; i < n; ++i) {                       // release, in reverse
        INPUT& u = in[n + i]; u = INPUT{}; u.type = INPUT_KEYBOARD; u.ki.wVk = k[n - 1 - i]; u.ki.dwFlags = KEYEVENTF_KEYUP;
    }
    SendInput((UINT)(n * 2), in.data(), sizeof(INPUT));
}

// ----------------------------------------------------------- hotkey thread
static DWORD WINAPI HotkeyThread(LPVOID) {
    bool prevCal = false, prevTog = false;
    for (;;) {
        bool ctrlShift = (GetAsyncKeyState(VK_CONTROL) & 0x8000) && (GetAsyncKeyState(VK_SHIFT) & 0x8000);
        bool cal = ctrlShift && (GetAsyncKeyState('S') & 0x8000);   // Ctrl+Shift+S = save / calibrate
        bool tog = ctrlShift && (GetAsyncKeyState('B') & 0x8000);   // Ctrl+Shift+B = bypass toggle
        if (cal && !prevCal) { g_calibrateReq = true; Log("[hotkey] Ctrl+Shift+S -> calibrate requested"); }
        if (tog && !prevTog) {
            g_enabled.store(false);    // bypass ON: hand recenter back to AC so you can reposition
            Log("[hotkey] Ctrl+Shift+B -> BYPASS ON (recenter to reposition; Ctrl+Shift+S saves & re-locks)");
            BeepBypass();
        }
        int res = g_saveResult.exchange(0);
        if (res == 1) BeepSaved();
        else if (res == 2) BeepFailed();
        prevCal = cal; prevTog = tog;

        // Auto VR-bounce: once the final session has been FOCUSED for BOUNCE_DELAY_MS, press the VD
        // "Toggle VR Mode" hotkey twice (out to the VD environment, then back) to clear the black screen.
        if (BOUNCE_ENABLED) {
            int armGen = g_bounceArmGen.load();
            if (armGen != 0 && armGen != g_lastBouncedGen
                && GetTickCount64() - g_bounceArmTick.load() >= BOUNCE_DELAY_MS) {
                g_lastBouncedGen = armGen;
                Log("[bounce] auto VR-bounce (gen=%d): Shift+Win+D x2 to clear the VD launch black screen", armGen);
                SendToggleVrMode();
                Sleep(BOUNCE_GAP_MS);
                SendToggleVrMode();
                Log("[bounce] auto VR-bounce done (gen=%d)", armGen);
            }
        }
        Sleep(40);
    }
}

static void EnsureHotkeyThread() {
    bool expected = false;
    if (g_hotkeyStarted.compare_exchange_strong(expected, true)) {
        CreateThread(nullptr, 0, HotkeyThread, nullptr, 0, nullptr);
        Log("[hotkey] thread started (Ctrl+Shift+S = save/calibrate, Ctrl+Shift+B = bypass)");
    }
}

// ------------------------------------------------------- capture / drift log
static void DoCalibrate(XrSpace renderSpace, XrTime t) {
    if (g_stageSpace == XR_NULL_HANDLE || renderSpace == XR_NULL_HANDLE || !g_nextLocateSpace) {
        Log("[calib] FAILED — stage/render space not ready"); g_saveResult.store(2); return;
    }
    XrSpaceLocation loc{XR_TYPE_SPACE_LOCATION};
    XrResult r = g_nextLocateSpace(renderSpace, g_stageSpace, t, &loc);
    const XrSpaceLocationFlags want = XR_SPACE_LOCATION_POSITION_VALID_BIT | XR_SPACE_LOCATION_ORIENTATION_VALID_BIT;
    if (XR_SUCCEEDED(r) && (loc.locationFlags & want) == want) {
        g_anchor = loc.pose; g_anchorValid = true;
        SaveAnchor(g_anchor);
        g_enabled.store(true);              // saving re-locks the anchor (bypass off)
        g_saveResult.store(1);
        const XrPosef& p = g_anchor;
        Log("[CALIBRATED] seat anchor saved + re-base RE-ENABLED (seated origin in STAGE): pos=(% .4f,% .4f,% .4f) quat=(% .4f,% .4f,% .4f,% .4f)",
            p.position.x, p.position.y, p.position.z,
            p.orientation.x, p.orientation.y, p.orientation.z, p.orientation.w);
    } else {
        Log("[calib] xrLocateSpace failed r=%d flags=0x%llx", (int)r, (unsigned long long)loc.locationFlags);
        g_saveResult.store(2);
    }
}

static void MaybeLogDrift(XrSpace renderSpace, XrTime t) {
    if (g_stageSpace == XR_NULL_HANDLE || renderSpace == XR_NULL_HANDLE || !g_nextLocateSpace) return;
    unsigned long long now = GetTickCount64();
    if (now - g_lastDriftLogMs < 2000) return;          // ~once every 2 s
    g_lastDriftLogMs = now;
    XrSpaceLocation loc{XR_TYPE_SPACE_LOCATION};
    if (XR_SUCCEEDED(g_nextLocateSpace(renderSpace, g_stageSpace, t, &loc))) {
        const XrPosef& p = loc.pose;
        Log("[drift] seated origin in STAGE: pos=(% .4f,% .4f,% .4f) quat=(% .4f,% .4f,% .4f,% .4f)%s",
            p.position.x, p.position.y, p.position.z,
            p.orientation.x, p.orientation.y, p.orientation.z, p.orientation.w,
            g_anchorValid ? "" : "  (no anchor yet)");
    }
}

// ------------------------------------------------------- wrapped functions
static XRAPI_ATTR XrResult XRAPI_CALL Layer_xrCreateReferenceSpace(
        XrSession session, const XrReferenceSpaceCreateInfo* ci, XrSpace* space) {
    // RE-BASE: AC's seated LOCAL space -> a STAGE space pinned to the saved anchor.
    if (ci && ci->referenceSpaceType == XR_REFERENCE_SPACE_TYPE_LOCAL && g_anchorValid && g_enabled.load()) {
        XrReferenceSpaceCreateInfo r = *ci;
        r.referenceSpaceType   = XR_REFERENCE_SPACE_TYPE_STAGE;
        r.poseInReferenceSpace = g_anchor;     // origin pinned to the calibrated room point (incl. yaw)
        XrResult res = g_nextCreateReferenceSpace(session, &r, space);
        const XrPosef& p = g_anchor;
        Log("xrCreateReferenceSpace  LOCAL -> REBASED to STAGE+anchor  pos=(% .3f,% .3f,% .3f) quat=(% .3f,% .3f,% .3f,% .3f)  r=%d",
            p.position.x, p.position.y, p.position.z,
            p.orientation.x, p.orientation.y, p.orientation.z, p.orientation.w, (int)res);
        return res;
    }
    if (ci) {
        const XrPosef& p = ci->poseInReferenceSpace;
        Log("xrCreateReferenceSpace  type=%-14s  pos=(% .3f,% .3f,% .3f)  quat=(% .3f,% .3f,% .3f,% .3f)",
            RefSpaceName(ci->referenceSpaceType),
            p.position.x, p.position.y, p.position.z,
            p.orientation.x, p.orientation.y, p.orientation.z, p.orientation.w);
    }
    return g_nextCreateReferenceSpace(session, ci, space);
}

static XRAPI_ATTR XrResult XRAPI_CALL Layer_xrCreateSession(
        XrInstance instance, const XrSessionCreateInfo* ci, XrSession* session) {
    XrResult r = g_nextCreateSession(instance, ci, session);
    if (XR_SUCCEEDED(r) && session) {
        g_createCount++;
        g_bounceArmGen.store(0);     // a new session means the churn hasn't settled yet -> disarm the bounce
        g_session = *session;
        g_renderSpace = XR_NULL_HANDLE;
        if (g_nextCreateReferenceSpace) {
            XrReferenceSpaceCreateInfo si{XR_TYPE_REFERENCE_SPACE_CREATE_INFO};
            si.referenceSpaceType = XR_REFERENCE_SPACE_TYPE_STAGE;
            si.poseInReferenceSpace = IdentityPose();
            XrSpace st = XR_NULL_HANDLE;
            XrResult sr = g_nextCreateReferenceSpace(*session, &si, &st);
            if (XR_SUCCEEDED(sr)) { g_stageSpace = st; Log("created our STAGE tracking space"); }
            else { g_stageSpace = XR_NULL_HANDLE; Log("FAILED to create STAGE space r=%d", (int)sr); }
        }
    }
    Log("xrCreateSession #%d r=%d  (created=%d destroyed=%d, live=%d)",
        g_createCount, (int)r, g_createCount, g_destroyCount, g_createCount - g_destroyCount);
    return r;
}

static XRAPI_ATTR XrResult XRAPI_CALL Layer_xrLocateViews(
        XrSession session, const XrViewLocateInfo* vli, XrViewState* vs,
        uint32_t cap, uint32_t* outCount, XrView* views) {
    XrResult r = g_nextLocateViews(session, vli, vs, cap, outCount, views);
    if (vli) { g_renderSpace = vli->space; g_displayTime = vli->displayTime; }
    if (g_calibrateReq.exchange(false)) {
        DoCalibrate(vli ? vli->space : XR_NULL_HANDLE, vli ? vli->displayTime : 0);
    }
    if (vli) MaybeLogDrift(vli->space, vli->displayTime);
    return r;
}

// ------------------------------------------- black-screen debug probes
static const char* SessionStateName(XrSessionState s) {
    switch (s) {
        case XR_SESSION_STATE_IDLE:         return "IDLE";
        case XR_SESSION_STATE_READY:        return "READY";
        case XR_SESSION_STATE_SYNCHRONIZED: return "SYNCHRONIZED";
        case XR_SESSION_STATE_VISIBLE:      return "VISIBLE";
        case XR_SESSION_STATE_FOCUSED:      return "FOCUSED";
        case XR_SESSION_STATE_STOPPING:     return "STOPPING";
        case XR_SESSION_STATE_LOSS_PENDING: return "LOSS_PENDING";
        case XR_SESSION_STATE_EXITING:      return "EXITING";
        default:                            return "?";
    }
}

static XRAPI_ATTR XrResult XRAPI_CALL Layer_xrPollEvent(XrInstance instance, XrEventDataBuffer* ev) {
    XrResult r = g_nextPollEvent(instance, ev);
    if (r == XR_SUCCESS && ev) {
        switch (ev->type) {
        case XR_TYPE_EVENT_DATA_SESSION_STATE_CHANGED: {
            auto* e = reinterpret_cast<const XrEventDataSessionStateChanged*>(ev);
            Log("[evt] SessionState -> %s", SessionStateName(e->state));
            if (BOUNCE_ENABLED && g_isAC && e->state == XR_SESSION_STATE_FOCUSED) {
                g_bounceArmGen.store(g_createCount);   // arm the auto-bounce against the current (final) session
                g_bounceArmTick.store(GetTickCount64());
            }
            break; }
        case XR_TYPE_EVENT_DATA_REFERENCE_SPACE_CHANGE_PENDING: {
            auto* e = reinterpret_cast<const XrEventDataReferenceSpaceChangePending*>(ev);
            Log("[evt] ReferenceSpaceChangePending refType=%d", (int)e->referenceSpaceType);
            break; }
        case XR_TYPE_EVENT_DATA_INTERACTION_PROFILE_CHANGED:
            Log("[evt] InteractionProfileChanged"); break;
        case XR_TYPE_EVENT_DATA_EVENTS_LOST:
            Log("[evt] EventsLost"); break;
        default: break;
        }
    }
    return r;
}

static XRAPI_ATTR XrResult XRAPI_CALL Layer_xrBeginSession(XrSession s, const XrSessionBeginInfo* bi) {
    XrResult r = g_nextBeginSession(s, bi);
    Log("xrBeginSession r=%d  (session #%d)", (int)r, g_createCount);
    return r;
}

// Lifecycle hooks: end/destroy of each session. A black-screen launch should correlate with a
// destroy landing AFTER a FOCUSED transition; with the OpenComposite deferInputProfileQuery fix the
// post-FOCUSED inputs-restart destroy should be gone entirely (live count stays at 1 after the
// graphics recreation settles).
static XRAPI_ATTR XrResult XRAPI_CALL Layer_xrEndSession(XrSession s) {
    Log("xrEndSession  (session #%d)", g_createCount);
    return g_nextEndSession(s);
}

static XRAPI_ATTR XrResult XRAPI_CALL Layer_xrDestroySession(XrSession s) {
    g_destroyCount++;
    Log("xrDestroySession #%d  (created=%d destroyed=%d, live=%d)",
        g_destroyCount, g_createCount, g_destroyCount, g_createCount - g_destroyCount);
    if (s == g_session) g_session = XR_NULL_HANDLE;
    return g_nextDestroySession(s);
}

static XRAPI_ATTR XrResult XRAPI_CALL Layer_xrWaitFrame(XrSession s, const XrFrameWaitInfo* wi, XrFrameState* fs) {
    XrResult r = g_nextWaitFrame(s, wi, fs);
    if (fs) {
        static unsigned long long last = 0;
        static int lastShould = -1;
        unsigned long long now = GetTickCount64();
        if ((int)fs->shouldRender != lastShould || now - last > 1000) {   // log flips instantly, else ~1/s
            last = now; lastShould = (int)fs->shouldRender;
            Log("[frame] waitFrame shouldRender=%d predDisplayTime=%lld", (int)fs->shouldRender, (long long)fs->predictedDisplayTime);
        }
    }
    return r;
}

static XRAPI_ATTR XrResult XRAPI_CALL Layer_xrEndFrame(XrSession s, const XrFrameEndInfo* fi) {
    if (fi) {
        static unsigned long long last = 0;
        unsigned long long now = GetTickCount64();
        if (now - last > 1000) {
            last = now;
            Log("[frame] endFrame layerCount=%u displayTime=%lld blend=%d",
                fi->layerCount, (long long)fi->displayTime, (int)fi->environmentBlendMode);
        }
    }

    return g_nextEndFrame(s, fi);
}

static XRAPI_ATTR XrResult XRAPI_CALL Layer_xrDestroyInstance(XrInstance instance) {
    Log("xrDestroyInstance");
    g_session = XR_NULL_HANDLE; g_stageSpace = XR_NULL_HANDLE; g_renderSpace = XR_NULL_HANDLE;
    return g_nextDestroyInstance(instance);
}

// ----------------------------------------------------- xrGetInstanceProcAddr
static XRAPI_ATTR XrResult XRAPI_CALL Layer_xrGetInstanceProcAddr(
        XrInstance instance, const char* name, PFN_xrVoidFunction* function) {
    if (!name || !function) return XR_ERROR_VALIDATION_FAILURE;
    if (!g_active)   // host isn't an enabled game -> install no hooks, stay completely out of the way
        return g_nextGIPA ? g_nextGIPA(instance, name, function) : XR_ERROR_FUNCTION_UNSUPPORTED;
    auto bind = [&](PFN_xrVoidFunction f){ *function = f; return XR_SUCCESS; };
    if (!strcmp(name, "xrGetInstanceProcAddr"))   return bind(reinterpret_cast<PFN_xrVoidFunction>(Layer_xrGetInstanceProcAddr));
    if (!strcmp(name, "xrCreateReferenceSpace"))  return bind(reinterpret_cast<PFN_xrVoidFunction>(Layer_xrCreateReferenceSpace));
    if (!strcmp(name, "xrCreateSession"))         return bind(reinterpret_cast<PFN_xrVoidFunction>(Layer_xrCreateSession));
    if (!strcmp(name, "xrLocateViews"))           return bind(reinterpret_cast<PFN_xrVoidFunction>(Layer_xrLocateViews));
    if (!strcmp(name, "xrPollEvent"))             return bind(reinterpret_cast<PFN_xrVoidFunction>(Layer_xrPollEvent));
    if (!strcmp(name, "xrBeginSession"))          return bind(reinterpret_cast<PFN_xrVoidFunction>(Layer_xrBeginSession));
    if (!strcmp(name, "xrEndSession"))            return bind(reinterpret_cast<PFN_xrVoidFunction>(Layer_xrEndSession));
    if (!strcmp(name, "xrDestroySession"))        return bind(reinterpret_cast<PFN_xrVoidFunction>(Layer_xrDestroySession));
    if (!strcmp(name, "xrWaitFrame"))             return bind(reinterpret_cast<PFN_xrVoidFunction>(Layer_xrWaitFrame));
    if (!strcmp(name, "xrEndFrame"))              return bind(reinterpret_cast<PFN_xrVoidFunction>(Layer_xrEndFrame));
    if (!strcmp(name, "xrDestroyInstance"))       return bind(reinterpret_cast<PFN_xrVoidFunction>(Layer_xrDestroyInstance));
    if (!g_nextGIPA) { *function = nullptr; return XR_ERROR_FUNCTION_UNSUPPORTED; }
    return g_nextGIPA(instance, name, function);
}

// Is the host process Assetto Corsa specifically? This gates ONLY the auto-bounce (the launch black
// screen is an AC/OpenComposite quirk; native-OpenXR games don't have it). NOT the FORCE override —
// FORCE turns on anchoring for a non-standard host, but must not fire the VD bounce in unrelated apps.
static bool HostIsAssettoCorsa(const char* appName) {
    if (appName) {                                   // OpenXR app name (AC via OpenComposite = "OpenComposite_acs")
        std::string a(appName);
        for (auto& c : a) if (c >= 'A' && c <= 'Z') c += 32;
        if (a.find("acs") != std::string::npos) return true;
    }
    wchar_t path[MAX_PATH];                           // ...or the host executable basename (acs.exe)
    DWORD n = GetModuleFileNameW(nullptr, path, MAX_PATH);
    if (n > 0 && n < MAX_PATH) {
        std::wstring w(path);
        for (auto& c : w) if (c >= L'A' && c <= L'Z') c += 32;
        if (w.find(L"acs.exe") != std::wstring::npos) return true;
    }
    return false;
}

// Host exe basename, lowercase (e.g. "acs.exe", "iracingsim64dx11.exe"). Empty on failure.
static std::string HostExeBasename() {
    wchar_t path[MAX_PATH];
    DWORD n = GetModuleFileNameW(nullptr, path, MAX_PATH);
    if (n == 0 || n >= MAX_PATH) return "";
    std::wstring w(path);
    size_t slash = w.find_last_of(L"\\/");
    std::wstring base = (slash == std::wstring::npos) ? w : w.substr(slash + 1);
    std::string s;
    for (wchar_t c : base) if (c < 128) s += (char)((c >= L'A' && c <= L'Z') ? c + 32 : c);
    return s;
}

// Is the host exe enabled? Reads enabled-games.txt (one lowercase basename per line, written by the
// app). Absent file -> default to acs.exe only (back-compat). Present but host not listed -> false
// (an empty file means the master switch is off, so nothing is enabled).
static bool HostGameEnabled(const std::string& hostExe) {
    std::ifstream f((DataDir() + L"\\enabled-games.txt").c_str());
    if (!f) return hostExe == "acs.exe";
    std::string line;
    while (std::getline(f, line)) {
        size_t a = line.find_first_not_of(" \t\r\n");            // trim the ENDS only — keep interior
        if (a == std::string::npos) continue;                   // (so "le mans ultimate.exe" still matches)
        size_t b = line.find_last_not_of(" \t\r\n");
        std::string t;                                          // normalize like HostExeBasename: drop
        for (size_t i = a; i <= b; ++i) {                       // non-ASCII (incl. a stray UTF-8 BOM),
            unsigned char c = (unsigned char)line[i];           // lowercase A-Z, keep interior spaces
            if (c >= 128) continue;
            t += (c >= 'A' && c <= 'Z') ? (char)(c + 32) : (char)c;
        }
        if (!t.empty() && t == hostExe) return true;
    }
    return false;
}

// --------------------------------------------------- xrCreateApiLayerInstance
static XRAPI_ATTR XrResult XRAPI_CALL Layer_xrCreateApiLayerInstance(
        const XrInstanceCreateInfo* info, const XrApiLayerCreateInfo* apiLayerInfo, XrInstance* instance) {
    if (!apiLayerInfo || !apiLayerInfo->nextInfo) return XR_ERROR_INITIALIZATION_FAILED;

    PFN_xrGetInstanceProcAddr    nextGIPA   = apiLayerInfo->nextInfo->nextGetInstanceProcAddr;
    PFN_xrCreateApiLayerInstance nextCreate = apiLayerInfo->nextInfo->nextCreateApiLayerInstance;
    g_nextGIPA = nextGIPA;

    XrApiLayerCreateInfo newInfo = *apiLayerInfo;
    newInfo.nextInfo = apiLayerInfo->nextInfo->next;

    const char* app = (info && info->applicationInfo.applicationName[0])
                      ? info->applicationInfo.applicationName : "(unknown)";
    std::string hostExe = HostExeBasename();                 // e.g. "acs.exe", "iracingsim64dx11.exe"
    g_hostStem = hostExe;
    size_t dot = g_hostStem.rfind(".exe");
    if (dot != std::string::npos && dot == g_hostStem.size() - 4) g_hostStem.resize(dot);
    char fbuf[8];
    bool forced = GetEnvironmentVariableA("XR_APILAYER_COCKPITANCHOR_FORCE", fbuf, sizeof(fbuf)) > 0;
    g_isAC   = HostIsAssettoCorsa(app);                      // AC (or forced) -> arms the auto-bounce only
    g_active = HostGameEnabled(hostExe) || forced;           // any enabled game -> install the anchor hooks
    Log("================ CockpitAnchor layer loaded — app='%s' host='%s'  (enabled: %s, AC/bounce: %s) ================",
        app, hostExe.c_str(), g_active ? "yes" : "NO -> inert passthrough", g_isAC ? "yes" : "no");

    if (!g_active) return nextCreate(info, &newInfo, instance);  // not an enabled game: chain only

    if (LoadAnchor(g_anchor)) {
        g_anchorValid = true;
        const XrPosef& p = g_anchor;
        Log("loaded existing seat anchor: pos=(% .4f,% .4f,% .4f) quat=(% .4f,% .4f,% .4f,% .4f)",
            p.position.x, p.position.y, p.position.z,
            p.orientation.x, p.orientation.y, p.orientation.z, p.orientation.w);
    } else {
        Log("no seat anchor on disk yet — press Ctrl+Shift+S in-car to calibrate");
    }
    Log("re-base is %s on launch  (Ctrl+Shift+S = save/calibrate, Ctrl+Shift+B = bypass)",
        (g_anchorValid && g_enabled.load()) ? "ACTIVE" : "INACTIVE");

    XrResult res = nextCreate(info, &newInfo, instance);
    if (XR_FAILED(res)) { Log("nextCreateApiLayerInstance FAILED (%d)", (int)res); return res; }

    nextGIPA(*instance, "xrCreateReferenceSpace", reinterpret_cast<PFN_xrVoidFunction*>(&g_nextCreateReferenceSpace));
    nextGIPA(*instance, "xrCreateSession",        reinterpret_cast<PFN_xrVoidFunction*>(&g_nextCreateSession));
    nextGIPA(*instance, "xrDestroyInstance",      reinterpret_cast<PFN_xrVoidFunction*>(&g_nextDestroyInstance));
    nextGIPA(*instance, "xrLocateViews",          reinterpret_cast<PFN_xrVoidFunction*>(&g_nextLocateViews));
    nextGIPA(*instance, "xrLocateSpace",          reinterpret_cast<PFN_xrVoidFunction*>(&g_nextLocateSpace));
    nextGIPA(*instance, "xrPollEvent",            reinterpret_cast<PFN_xrVoidFunction*>(&g_nextPollEvent));
    nextGIPA(*instance, "xrBeginSession",         reinterpret_cast<PFN_xrVoidFunction*>(&g_nextBeginSession));
    nextGIPA(*instance, "xrEndSession",           reinterpret_cast<PFN_xrVoidFunction*>(&g_nextEndSession));
    nextGIPA(*instance, "xrDestroySession",       reinterpret_cast<PFN_xrVoidFunction*>(&g_nextDestroySession));
    nextGIPA(*instance, "xrWaitFrame",            reinterpret_cast<PFN_xrVoidFunction*>(&g_nextWaitFrame));
    nextGIPA(*instance, "xrEndFrame",             reinterpret_cast<PFN_xrVoidFunction*>(&g_nextEndFrame));

    LoadBounceKeys();
    EnsureHotkeyThread();
    Log("instance ready (locateViews=%p locateSpace=%p)",
        reinterpret_cast<void*>(g_nextLocateViews), reinterpret_cast<void*>(g_nextLocateSpace));
    return res;
}

// ------------------------------------------------------- negotiation export
extern "C" __declspec(dllexport) XRAPI_ATTR XrResult XRAPI_CALL
xrNegotiateLoaderApiLayerInterface(const XrNegotiateLoaderInfo* loaderInfo,
                                   const char* layerName,
                                   XrNegotiateApiLayerRequest* apiLayerRequest) {
    Log("xrNegotiateLoaderApiLayerInterface layerName=%s", layerName ? layerName : "(null)");
    if (!loaderInfo || !apiLayerRequest) return XR_ERROR_INITIALIZATION_FAILED;
    if (loaderInfo->structType != XR_LOADER_INTERFACE_STRUCT_LOADER_INFO ||
        apiLayerRequest->structType != XR_LOADER_INTERFACE_STRUCT_API_LAYER_REQUEST) {
        return XR_ERROR_INITIALIZATION_FAILED;
    }
    apiLayerRequest->layerInterfaceVersion  = XR_CURRENT_LOADER_API_LAYER_VERSION;
    apiLayerRequest->layerApiVersion        = XR_CURRENT_API_VERSION;
    apiLayerRequest->getInstanceProcAddr    = Layer_xrGetInstanceProcAddr;
    apiLayerRequest->createApiLayerInstance = Layer_xrCreateApiLayerInstance;
    return XR_SUCCESS;
}
