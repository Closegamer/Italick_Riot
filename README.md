# Italick — a Windows desktop companion

A 3D character who lives on your Windows desktop: he walks along the taskbar, climbs the tops of your open windows by
ladder and rope, parachutes down, perches on window edges, sits at his desk and types — and every so often a rubber
statue of Anthropic pops up and he deals with it (in a ninja suit with nunchaku, or as a karate man in a kimono).
He also has his own bed now: leave him alone for five minutes and he goes to sleep in it — and a little **FOOD**
helicopter occasionally drops him a burger and a drink.

He plants a flag at the left edge of the screen:

> **Hey, Anthropic! Stop blocking Russian accounts!**
>
> *Italick, Russian programmer*

**No chat, no voice control, no microphone** — Italick is a show-off, not an assistant. Windows 10/11 (x64) for now.
Version 1.5.

## Download and run (no installation)

1. Download **`Italick-1.5-windows.zip`** from the [latest release](https://github.com/Closegamer/Italick_Riot/releases/latest).
2. Unzip it anywhere (Desktop, USB stick, another PC).
3. Double-click **`Italick-1.5.exe`**.

- No Node.js, no installer, no extra files: the exe is self-contained.
- **First launch** takes a few seconds — it unpacks itself once to `%LOCALAPPDATA%\Italick`. Later launches are immediate.
- The app lives in the **system tray**. Right-click its icon → **Call police**, **Order food** or **Quit**.
- **SmartScreen**: the exe is unsigned, so Windows may warn the first time — *More info* → *Run anyway*.
- Only **one** Italick can run at a time; launching it again brings the running one to the front.

## What he does

- **Comes out of his door** and plants the flag at the left edge of the screen, with door creak, cloth flap and a pole
  thud. The flag flutters in the wind.
- **Roams your desktop**: walks the taskbar, climbs windows with a ladder or a grappling rope, parachutes down, sits and
  rests on window edges.
- **Works at his desk**: chair, laptop and typing.
- **Statue battles**: a coral rubber Anthropic statue ("ANTHROPIC" on its pedestal) appears on a random window or on the
  taskbar. Italick hurries over — climbing a ladder if it is up on a window — and either turns into a ninja with nunchaku
  or into a karate man in a white kimono, then beats the statue until it bursts into dust. Punches, kicks and fights have
  synthesized sounds. Statues obey the same gravity as he does: knock one off a window and it falls; hit the taskbar and it
  shatters.
- **Police visits**: every 3–8 minutes, two policemen slowly walk in from the right side of the screen. They stop to talk
  it over between themselves on the way, then come up to Italick, who turns to face them; he shows them his Russian
  passport and they read it. At the flag only one of them points, with one arm, while the other stands with his hands
  behind his back; then they discuss it at random length, have a good laugh and walk away to the left.
- **Food delivery**: every 4–9 minutes a little **FOOD** helicopter flies in and drops a parachuted crate with a burger and
  a drink. Italick opens it, takes three bites, drinks, then a bin appears and he throws the wrapper away. A three-beep
  chime marks the end. The tray menu also has **Order food** for an instant delivery.
- **Tray menu**: **Call police** brings the two policemen over right away (if he is working at his desk he stands up
  first), **Order food** calls a helicopter delivery, **Quit** leaves through his door.
- **Sleeps when you are away**: after five minutes without keyboard or mouse activity, a bed pops up beside him, he
  climbs in, lies down with floating Zzz and soft snores. Any input wakes him and the bed disappears.
- **Grabbable**: hover over him, then drag him anywhere. Let go to drop him or throw him. While a battle or a cinematic
  scene is playing he politely ignores the mouse.

## Build from source (Windows)

Needs [Node.js](https://nodejs.org/) 20 or newer.

```powershell
git clone https://github.com/Closegamer/Italick_Riot.git
cd Italick_Riot
npm install

npm start                # run the app from source
npm run build:italick     # dist\Italick-1.5-win32-x64\Italick.exe (folder build)
npm run bundle:italick    # dist\Italick-1.5.exe (single self-contained file)
```

`build:italick` copies the Electron runtime already in `node_modules`; `bundle:italick` wraps that folder in a small
self-extracting launcher (`tools/launcher.cs`, built with the .NET Framework compiler included in Windows).

Useful when testing: `ITALICK_START_MS`, `ITALICK_ROAM_MS`, `ITALICK_WORK_MS`, `ITALICK_BATTLE_MS`, `ITALICK_POLICE_MS`,
`ITALICK_IDLE_MS`, `ITALICK_ACTIONS=idle`, `ITALICK_QUIT_MS`, `ITALICK_POLICE_NOW`.

## Code

Project memory (architecture, conventions, release checklist): **[MEMORY.md](MEMORY.md)**.

| File | What |
|---|---|
| `italick-main.js` | App entry: tray, overlay window, flag show, roam → desk → battle cycle |
| `src/app.js` | Scene, behaviour loop, door/flag scenes, drag / throw / fall, working pose |
| `src/geek.js` | The character: jointed model, textures, poses, ninja and karate outfits |
| `src/roam.js` | Roaming, ladder/rope climbing, parachuting, statue battles (ninja + karate choreography) |
| `src/statue.js` | The rubber Anthropic statue, its gravity and dust |
| `src/police.js`, `src/passport.js` | The two policemen and the Russian passport |
| `src/nunchaku.js` | Nunchaku model |
| `src/sfx.js` | Synthesized sounds: door, flag, fight, dust |
| `src/flag.js` | The flag: caption, signature, wind animation |
| `src/actions/*.js` | Random behaviours: walk, idle, sit |
| `src/parts.js` | Shared procedural-modelling helpers |
| `roam/` | Window lister (PowerShell) and platform-edge maths |
| `tools/build-italick.mjs` | Folder build with the local Electron |
| `tools/bundle-italick.mjs` + `tools/launcher.cs` | Single-file self-extracting build |

## Uninstall

Italick installs nothing into Windows: no registry entries, no services, no startup items, no admin rights needed.

1. Right-click the tray icon → **Quit**.
2. Delete `Italick-1.5.exe` (or the whole unzipped folder).
3. Delete the files it left behind — press **Win+R**, paste each path, press Enter, and delete the folder:
   - `%LOCALAPPDATA%\Italick` — the unpacked app (the biggest one, ~300 MB)
   - `%APPDATA%\Italick` — Electron/Chromium cache and preferences
   - `%LOCALAPPDATA%\Italic` and `%APPDATA%\Italic` — the same, left by older builds (spelled "Italic")
   - `%APPDATA%\italic` — the same, left by even older builds

That is the complete uninstall. To use it again later, just download the zip and run the exe.

If the tray icon is gone but the process still runs: open **Task Manager → Details**, end `Italick.exe`, then delete the
folders above.

---

writtenBy('Closegamer', 2026)
closegamer@mail.ru
