# Italic — a Windows desktop companion

A 3D character who lives on your Windows desktop: he walks along the taskbar, climbs the tops of your open windows by
ladder and rope, parachutes down, perches on window edges, sits at his desk and types — and every so often a rubber
statue of Anthropic pops up and he deals with it (in a ninja suit with nunchaku, or as a karate man in a kimono).

He plants a flag at the left edge of the screen:

> **Hey, Anthropic! Stop blocking Russian accounts!**
>
> *Italick, Russian programmer*

**Windows 10/11 (x64) for now.** Version 1.0.

## Download and run (no installation)

1. Download **`Italic-1.0-windows.zip`** from the [latest release](https://github.com/Closegamer/desktop-assistant/releases/latest).
2. Unzip it anywhere (Desktop, USB stick, another PC).
3. Double-click **`Italic-1.0.exe`**.

- No Node.js, no installer, no extra files: the exe is self-contained.
- **First launch** takes a few seconds — it unpacks itself once to `%LOCALAPPDATA%\Italic`. Later launches are immediate.
- The app lives in the **system tray**. Right-click its icon → **Quit**.
- **SmartScreen**: the exe is unsigned, so Windows may warn the first time — *More info* → *Run anyway*.
- Only **one** Italic can run at a time; launching it again just brings the running one to the front.

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
- **Grabbable**: hover over him, then drag him anywhere. Let go to drop him or throw him. While a battle or a cinematic
  scene is playing he politely ignores the mouse.
- **No chat and no commands**: this build is a show-off, not the AI assistant.

## Build from source (Windows)

Needs [Node.js](https://nodejs.org/) 20 or newer.

```powershell
git clone https://github.com/Closegamer/desktop-assistant.git
cd desktop-assistant
npm install

npm run start:italic     # run the demo from source
npm run build:italic     # dist\Italic-1.0-win32-x64\Italic.exe (folder build)
npm run bundle:italic    # dist\Italic-1.0.exe (single self-contained file)
```

`build:italic` copies the Electron runtime already in `node_modules`; `bundle:italic` wraps that folder in a small
self-extracting launcher (`tools/launcher.cs`, built with the .NET Framework compiler included in Windows).

Useful when testing: `ITALIC_START_MS`, `ITALIC_ROAM_MS`, `ITALIC_WORK_MS`, `ITALIC_BATTLE_MS`, `ITALIC_ACTIONS=idle`.

## The full AI assistant (optional)

This repository also contains the original chat assistant (`main.js`): a desktop pet with chat, voice input and output,
and tasks done on your PC through [opencode](https://opencode.ai) running **DeepSeek**. The Italic demo does not use any
of it.

```powershell
npm install
opencode auth login      # pick DeepSeek, paste your API key once
npm start
```

Requirements: opencode and a DeepSeek API key. Voice input needs Python with `faster-whisper`; the voice lock needs
`sherpa-onnx` (the speaker model is in `voice/speaker.onnx`). The assistant can install opencode himself ("install
opencode"). It answers in the chat panel, listens for its name, and can be switched between DeepSeek models.

## Code

| File | What |
|---|---|
| `italic-main.js` | The Italic demo: tray-only, no chat/AI/commands, overlay window, flag show, roam → desk → battle cycle |
| `src/app.js` | Scene, behaviour loop, door/flag scenes, drag / throw / fall, working pose |
| `src/geek.js` | The character: jointed model, textures, poses, ninja and karate outfits |
| `src/roam.js` | Roaming, ladder/rope climbing, parachuting, statue battles (ninja + karate choreography) |
| `src/statue.js` | The rubber Anthropic statue, its gravity and dust |
| `src/nunchaku.js` | Nunchaku model |
| `src/sfx.js` | Synthesized sounds: door, flag, fight, dust |
| `src/flag.js` | The flag: caption, signature, wind animation |
| `src/actions/*.js` | Random behaviours: walk, idle, sit |
| `src/parts.js` | Shared procedural-modelling helpers |
| `tools/build-italic.mjs` | Folder build with the local Electron |
| `tools/bundle-italic.mjs` + `tools/launcher.cs` | Single-file self-extracting build |
| `main.js` | The full AI assistant (chat + voice + DeepSeek via opencode) |
| `chat.html` | Chat panel for the full assistant |
| `voice/*` | Whisper speech-to-text and speaker voiceprint support |

Settings for the full assistant live in `%APPDATA%\desktop-assistant\settings.json`. Italic has no settings.

---

writtenBy('Closegamer', 2026)
closegamer@mail.ru
