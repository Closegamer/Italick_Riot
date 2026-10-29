# Project memory — Italick

This file is the persistent memory for everyone (human or AI) working on this repository. Update it when the
architecture, features, version or release process changes.

## What this is

**Italick** is a Windows-only 3D desktop companion built with Electron + Three.js. He lives in the tray, walks on the
taskbar, climbs open windows, parachutes, works at a desk, plants a flag, sleeps in a bed, fights rubber Anthropic statues,
and is occasionally stopped by two policemen.

- Repository: https://github.com/Closegamer/Italick_Riot
- Author / developer nick: **Closegamer** — `closegamer@mail.ru`
- Flag signature: **Italick, Russian programmer**
- Current version: **1.3.0** (next release tag `v1.3`; v1.2 is the latest published)
- Latest download: `Italick-1.2-windows.zip` (v1.3 build pending)
- Important spelling: the character/app is **Italick**, not “Italic”. Keep it that way everywhere.
- Windows 10/11 x64 only for now.

## Hard rules

- **No chat, no voice control, no microphone, no AI assistant.** Those were removed. Do not reintroduce `main.js`,
  `chat.html`, `voice/`, or wake-word code.
- **Commit as `Closegamer <closegamer@mail.ru>` only.** Never add `Co-Authored-By:` or other AI co-author trailers:
  they create extra entries in GitHub's contributor list.
- The single-file exe is the main deliverable. It must stay self-contained (no Node.js on the target machine).
- Only one instance may run (`app.setName('Italick')` + `requestSingleInstanceLock`).
- Keep the app usable while roaming: he can be grabbed and dragged with the mouse; grabbing cancels roaming cleanly.
- All timers that touch the window must tolerate shut-down (`win.isDestroyed()` guards, cleared intervals).
- `plans/`, `dist/` and `node_modules/` are not committed.

## Entry points and layout

| Path | Purpose |
|---|---|
| `italick-main.js` | Electron main process: tray, overlay window, window lister, demo timer, battles, police visits, sleep/wake |
| `src/app.js` | Three.js scene, animation loop, door/flag/sleep/police scenes, mouse drag/throw, script queue |
| `src/geek.js` | Italick model, poses, ninja and karate outfits |
| `src/roam.js` | Roaming, ladder/rope climbing, parachuting, statue battles (ninja + karate), roam cleanup |
| `src/statue.js` | Rubber Anthropic statue, gravity, hits, dust |
| `src/nunchaku.js` | Nunchaku model |
| `src/bed.js` | Bed, Zzz sprite, sleep animation support |
| `src/police.js` | Two policemen: uniform, cap, walk/read/point/talk/laugh animations |
| `src/passport.js` | Russian passport: burgundy cover, gold double-headed eagle, «ПАСПОРТ» |
| `src/flag.js` | Flag cloth, caption/signature, wind flutter |
| `src/sfx.js` | All sounds, synthesized with Web Audio (no audio assets) |
| `src/actions/*.js` | Random behaviours: `walk`, `idle`, `sit` |
| `src/parts.js` | Procedural modelling helpers |
| `roam/windows.ps1`, `roam/edges.js` | Open-window lister and walkable top-edge maths |
| `tools/build-italick.mjs` | Folder build using the local Electron |
| `tools/bundle-italick.mjs` + `tools/launcher.cs` | Single-file self-extracting build |
| `HOW-TO-RUN.txt` | Plain-text user guide shipped in the zip |
| `README.md` | Public documentation, download, controls, uninstall |

## Behaviour

### Demo cycle (`italick-main.js`)
- After `ITALICK_START_MS` (default 12 s): roam for 55 s → sit at desk and work for 22 s → repeat.
- Statue battles: every 45 s.
- Police visits: **random 3–8 minutes apart**.
- Sleep: after 5 minutes of no keyboard/mouse (`powerMonitor.getSystemIdleTime`), a bed appears; any input wakes him.
- Timers for the show/battles/police are cleared while sleeping and restarted on wake.

### Statue battles
- Spawn on a random window top or the taskbar (65% window if available).
- Italick hurries (2.4× walk/climb speed), climbs a ladder offset ~1 body-width beside the statue.
- 50/50 outfit: ninja with nunchaku, or karate man in a white kimono with black obi.
- 5 hits → statue bursts into dust. Statues use the character's gravity (2600 px/s²); falling to the taskbar shatters them.
- Karate fights: punches and kicks; body/face square to the statue.

### Police visits
- Cops enter from the right, stop near the flag, read the passport, walk up to the flag, point with both hands, turn to
  each other and discuss, laugh, then leave past the left edge.
- Footsteps, murmurs and laughs are synthesized.
- Visit is skipped while asleep or working at the desk; it retries on the next random interval.

### Flag
- Plants at the left edge at startup, caption: **“Hey, Anthropic! Stop blocking Russian accounts!”**
- Signature: **Italick, Russian programmer** (italic, black).
- Cloth flutters visibly in the wind (x/y/z vertex motion + cloth sway).

### Bed / sleep
- Bed appears beside him; he walks to it, lies **on his back**, Zzz floats, soft snores.
- Waking stands him up and removes the bed.

### Interaction
- Hover + drag with the mouse. Grabbing during roam hides ladder/rope/ninja props.
- No chat window; clicks do nothing.
- Single instance; launching again brings the running overlay to the front.

## Build and release

Requirements: Node.js 20+, Windows, local `node_modules` (Electron + Three). `.NET Framework` csc ships with Windows.

```powershell
npm install
npm start                 # run from source
npm run build:italick     # folder build: dist\Italick-<ver>-win32-x64\Italick.exe
npm run bundle:italick    # single file:  dist\Italick-<ver>.exe
```

Version is derived from `package.json` (`1.3.0` → display/file `1.3`). The bundle:
1. builds the folder,
2. zips it,
3. compiles `tools/launcher.cs` with csc (icon + version metadata),
4. concatenates launcher + zip + 8-byte zip length.

The launcher unpacks once to `%LOCALAPPDATA%\Italick\app-<build id>` and starts `Italick.exe` from there. Old caches are
removed automatically.

### Release checklist
1. Update `package.json` version and description; update `package-lock.json` version.
2. Update `README.md` and `HOW-TO-RUN.txt` version and filenames.
3. `npm run bundle:italick`.
4. Test launch + quit (`ITALICK_QUIT_MS=12000`).
5. Zip `Italick-<ver>.exe` + `README.md` + `HOW-TO-RUN.txt` → `dist\Italick-<ver>-windows.zip`.
6. `git add -A && git commit && git push`.
7. `git tag v<ver> && git push origin v<ver>`.
8. `gh release create v<ver> dist\Italick-<ver>-windows.zip --title "Italick <ver> - Windows" --notes-file ...`.
9. Update the GitHub repository description if the feature set changed.
10. Verify the release is marked **Latest** and the asset URL works.

Release assets must be uploaded to GitHub Releases, not committed (the exe is ~140 MB, above the 100 MB git limit).

## Test knobs (environment)

| Variable | Effect |
|---|---|
| `ITALICK_START_MS` | delay before the demo cycle starts (default 12000) |
| `ITALICK_ROAM_MS` | roam phase length (default 55000) |
| `ITALICK_WORK_MS` | desk phase length (default 22000) |
| `ITALICK_BATTLE_MS` | statue interval (default 45000) |
| `ITALICK_POLICE_MS` | fixed police interval for testing (default is random 3–8 min) |
| `ITALICK_POLICE_NOW` | start a police visit N ms after load (testing) |
| `ITALICK_IDLE_MS` | idle time before sleep (default 300000) |
| `ITALICK_ACTIONS` | comma list of behaviours; `idle` keeps him still (testing) |
| `ITALICK_QUIT_MS` | quit cleanly N ms after load (testing shutdown) |

Example quick police test:

```powershell
$env:ITALICK_START_MS='100000'; $env:ITALICK_BATTLE_MS='100000'
$env:ITALICK_POLICE_MS='100000'; $env:ITALICK_POLICE_NOW='12000'
npm start
```

## Known gotchas

- While roaming, `script === roamScript`; battles/police queue and run after the roam cleanup, so props don’t remain.
- Sleeping clears demo timers; `show()`, `battles()` and `police()` are restarted on wake.
- Do not call `win.webContents` without `win && !win.isDestroyed()` checks in timers.
- The police scene is intentionally long (~25 s): entry, reading, flag discussion, talk, laugh, exit.
- The full AI assistant is gone; `%APPDATA%\desktop-assistant` and `voice/` belong to old versions only.
- Old “Italic” cache folders may still exist on users’ machines; uninstall docs list them.

## Current state

- Latest feature work: victory poses after statue fights (karate finishing stance and bow, ninja nunchaku flourish and hand seal).
- Latest release: **v1.2** (`Italick-1.2-windows.zip`); **v1.3** is prepared but not yet published.
- Recent commits: `48b8f0e Add victory poses after statue fights`.

_Last updated: 2026-10-29._
