# Project memory — Italick

This file is the persistent memory for everyone (human or AI) working on this repository. Update it when the
architecture, features, version or release process changes.

## What this is

**Italick** is a Windows-only 3D desktop companion built with Electron + Three.js. He lives in the tray, walks on the
taskbar, climbs open windows, parachutes, works at a desk, plants a flag, sleeps in a bed, has food delivered by
helicopter, fights rubber Anthropic statues, and is occasionally stopped by two policemen who check his passport.
The tray menu can summon the policemen or a food delivery on demand.

- Repository: https://github.com/Closegamer/Italick_Riot (formerly `Closegamer/Italick`, which was deleted; git history
  was rewritten to a single author, so the contribution graph stays clean)
- Author / developer nick: **Closegamer** — `closegamer@mail.ru`
- Flag signature: **Italick, Russian programmer**
- Current version: **1.5.0** (release tag `v1.5`)
- Latest download: `Italick-1.5-windows.zip`
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
- Do not commit or push without the owner's explicit approval.

## Entry points and layout

| Path | Purpose |
|---|---|
| `italick-main.js` | Electron main process: tray menu, overlay window, window lister, demo timer, battles, police visits, food deliveries, sleep/wake |
| `src/app.js` | Three.js scene, animation loop, door/flag/sleep/police/food scenes, mouse drag/throw, script queue |
| `src/geek.js` | Italick model, poses, ninja and karate outfits, eat/drink poses |
| `src/roam.js` | Roaming, ladder/rope climbing, parachuting, statue battles (ninja + karate), roam cleanup |
| `src/statue.js` | Rubber Anthropic statue, gravity, hits, dust |
| `src/nunchaku.js` | Nunchaku model |
| `src/bed.js` | Bed, Zzz sprite, sleep animation support |
| `src/police.js` | Two policemen: uniform, cap, walk/read/point-one-arm/hands-behind-back/listen/talk/laugh |
| `src/passport.js` | Russian passport: burgundy cover, gold double-headed eagle, «ПАСПОРТ» |
| `src/food.js` | Food delivery props: helicopter, parachuted crate, burger, drink, wrapper, rubbish bin |
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
- Food deliveries: **random 4–9 minutes apart**.
- Sleep: after 5 minutes of no keyboard/mouse (`powerMonitor.getSystemIdleTime`), a bed appears; any input wakes him.
- Timers for the show/battles/police/food are cleared while sleeping and restarted on wake.

### Tray menu
- `Italick <version> — from Russia with code` (disabled label; version comes from `app.getVersion()`).
- **Call police** → `callPolice()`: runs `police()` in the renderer and retries every 2 s (up to 15 times) while he is
  busy; on the first retry it also sends `setBusy(false)` so he stands up from the desk.
- **Order food** → `run('foodDelivery()')`.
- **Quit** → `goodbye()`: he finishes his scene, walks into his door, then the app quits (12 s cap).

### Statue battles
- Spawn on a random window top or the taskbar (65% window if available).
- Italick hurries (2.4× walk/climb speed), climbs a ladder offset ~1 body-width beside the statue.
- 50/50 outfit: ninja with nunchaku, or karate man in a white kimono with black obi.
- 5 hits → statue bursts into dust. Statues use the character's gravity (2600 px/s²); falling to the taskbar shatters them.
- Karate fights: punches and kicks; body/face square to the statue.

### Police visits
- Cops enter from the right and stop half-way (at `chatX`, ~2.4 body-widths right of the meeting point) to talk it over
  between themselves: 2–4 alternating lines with mumble sounds. Skipped on very narrow screens (`canChat`).
- Italick walks to `meetX` and, once there, turns to face whichever policeman is nearest, so he never shows his back
  while they are coming in.
- They read the passport (2.2 s), then walk to the flag.
- At the flag **only the nearer cop points, with one arm** (`pointOne('R')`); the other stands with his hands behind his
  back (`handsBehindBack`). The pointing lasts a random 2.6–5 s.
- They turn to each other and argue, taking turns, 2–4 lines of random length; then laugh and walk away to the left.
- Italick lowers the passport with his hand and puts it away as they walk to the flag (it must not hang in the air).
- Footsteps, murmurs and laughs are synthesized.
- The visit is skipped while asleep or working at the desk; it retries on the next random interval.
- Scene length is intentionally long (~30–40 s).

### Food delivery (`foodScene` in `src/app.js`)
- A **FOOD** helicopter flies in from the right and hovers over a drop point beside him.
- A parachuted crate drops, the chute collapses, the helicopter climbs away and leaves.
- He walks to the crate, opens it, eats a burger in three bites (jaw chews) and drinks from a cup (the props follow the
  hand bones through `k.hand('R'/'L')`).
- A green bin pops in; he carries the wrapper over and throws it in, the lid opens/closes, both props vanish.
- Three synthesized beeps mark the end; skipped while asleep or working at the desk.

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

Version is derived from `package.json` (`1.5.0` → display/file `1.5`). The bundle:
1. builds the folder,
2. zips it,
3. compiles `tools/launcher.cs` with csc (icon + version metadata),
4. concatenates launcher + zip + 8-byte zip length.

The launcher unpacks once to `%LOCALAPPDATA%\Italick\app-<build id>` and starts `Italick.exe` from there. Old caches are
removed automatically. The `app-<build id>` suffix changes with every bundle.

### Release checklist
1. Update `package.json` version and description; update `package-lock.json` version.
2. Update `README.md`, `HOW-TO-RUN.txt` and this file (version, filenames, feature notes).
3. `npm run bundle:italick`.
4. Test launch + quit (`ITALICK_QUIT_MS=15000`; quit itself takes ~20 s because he leaves through the door).
5. Zip `Italick-<ver>.exe` + `README.md` + `HOW-TO-RUN.txt` → `dist\Italick-<ver>-windows.zip`.
6. `git add -A && git commit && git push` (ASCII-only commit message, no AI trailers).
7. `git tag -a v<ver> -m "Italick <ver>" && git push origin v<ver>`.
8. `gh release create v<ver> dist\Italick-<ver>-windows.zip --title "Italick <ver> - Windows" --notes-file ... --latest`.
9. Update the GitHub repository description if the feature set changed.
10. Verify the release is marked **Latest** and the asset URL works (`gh release view v<ver> --json assets,url`).

Release assets must be uploaded to GitHub Releases, not committed (the exe is ~140 MB, above the 100 MB git limit).

### Release history
| Tag | Highlights |
|---|---|
| `v1.0` Italic | Original name, basic desktop pet |
| `v1.1`, `v1.2` | Pre-rewrite iterations (see GitHub releases) |
| `v1.3` | Victory poses after fights; realism pass (blink, IK feet, pelvis sway, contact shadow, 120 Hz step); adult proportions |
| `v1.4` | Helicopter food delivery: parachuted crate, burger, drink, rubbish bin, finish beeps |
| `v1.5` | Police visit rework (chat on the way in, one cop points, random argument, proper passport lowering); tray **Call police** |

## Test knobs (environment)

| Variable | Effect |
|---|---|
| `ITALICK_START_MS` | delay before the demo cycle starts (default 12000) |
| `ITALICK_ROAM_MS` | roam phase length (default 55000) |
| `ITALICK_WORK_MS` | desk phase length (default 22000) |
| `ITALICK_BATTLE_MS` | statue interval (default 45000) |
| `ITALICK_POLICE_MS` | fixed police interval for testing (default is random 3–8 min) |
| `ITALICK_POLICE_NOW` | start a police visit N ms after load (testing, one shot) |
| `ITALICK_FOOD_MS` | fixed food delivery interval for testing (default is random 4–9 min) |
| `ITALICK_FOOD_NOW` | start a food delivery N ms after load (testing) |
| `ITALICK_IDLE_MS` | idle time before sleep (default 300000) |
| `ITALICK_ACTIONS` | comma list of behaviours; `idle` keeps him still (testing) |
| `ITALICK_QUIT_MS` | quit cleanly N ms after load (testing shutdown) |

Example quick police test (use `>= 12000` ms — earlier calls are dropped while he is still behind the door):

```powershell
$env:ITALICK_START_MS='100000'; $env:ITALICK_BATTLE_MS='999999'
$env:ITALICK_POLICE_MS='999999'; $env:ITALICK_POLICE_NOW='13000'
$env:ITALICK_FOOD_MS='999999'; $env:ITALICK_IDLE_MS='999999'
npm start
```

Quick food test: the same with `$env:ITALICK_FOOD_NOW='13000'` (the first 8 s call is dropped while the door scene runs).

## Local testing recipe

- **Quit the running app first** (tray → Quit, or `Stop-Process` on `node_modules\electron\dist\electron.exe`): the
  single-instance lock makes a new launch exit silently.
- Launch from source with `Start-Process node_modules\electron\dist\electron.exe -ArgumentList '.' -WorkingDirectory C:\a_REPOS\Italick_Riot`.
- Capture the screen with PowerShell `System.Drawing` (`CopyFromScreen`) into `%TEMP%\opencode\*.png`, then crop and zoom
  with `NearestNeighbor` to inspect poses. Screens are 1920×1200 here; the character is ~130 px tall.
- The tray icon is not exposed to UI Automation (it hides in the Windows 11 overflow), so menu items are verified by code
  review plus triggering the same action through the env knobs. For the `callPolice` busy-retry path, temporarily add a
  `later(callPolice, ...)` line under a throwaway env var, test, then remove it before committing.

## Known gotchas

- While roaming, `script === roamScript`; battles/police/food queue and run after the roam cleanup, so props don’t remain.
- Sleeping clears demo timers; `show()`, `battles()`, `police()` and `food()` are restarted on wake.
- Do not call `win.webContents` without `win && !win.isDestroyed()` checks in timers.
- `ITALICK_POLICE_NOW` / `ITALICK_FOOD_NOW` fire once; if he is still behind the door (`gone`) the call returns `false`
  and is not retried.
- The police scene is intentionally long (~30–40 s): entry with a chat between the cops, reading, flag discussion, talk,
  laugh, exit.
- The full AI assistant is gone; `%APPDATA%\desktop-assistant` and `voice/` belong to old versions only.
- Old “Italic” cache folders may still exist on users’ machines; uninstall docs list them.
- PowerShell 5.1 `Set-Content` is fine here (files are UTF-8), but prefer the edit tool for small changes to avoid
  rewriting whole files and losing the encoding of «ПАСПОРТ» and the «» quotes.

## Current state

- Latest release: **v1.5** (`Italick-1.5-windows.zip`, marked Latest on GitHub).
- Latest feature work: police visit rework (chat on the way in, Italick faces them, only one cop points with one arm,
  the other stands with his hands behind his back, random pointing/argument length, passport goes down with his hand)
  plus the tray **Call police** item.
- Recent commits: `f698147 Rework the police visit, add tray Call police, bump to 1.5`,
  `3ce8db6 Add helicopter food delivery, bump to 1.4`.
- Known limitation: the character is still stylised (not photo-real); a realistic human needs a custom rigged GLB with
  a red reindeer sweater mesh, glasses and a climb clip (blocked on assets).

_Last updated: 2026-10-30._
