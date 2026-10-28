# Desktop Assistant

A 3D character (a geek in glasses and a reindeer sweater) who lives on your Windows desktop. He walks along the taskbar,
idles, sits on its edge, and can be picked up and thrown with the mouse. Click him to open a chat: your messages go to
[Claude Code](https://claude.com/claude-code) running on this computer, so he can answer questions and do tasks for you.
While Claude works he sits down with his laptop and types.

## Run

Needs Node.js and Claude Code installed and signed in (`claude` once in a terminal). Voice input also needs Python with `faster-whisper`.

```
npm install
npm start
```

## Use

- **Click** him: open/close the chat. **Drag** him: carry him; let go to drop or throw.
- **Voice**: press **Ctrl+Alt+Space** anywhere (or 🎤 in the chat) and speak; it sends when you pause. Speech is
  transcribed locally with Whisper (`pip install faster-whisper`; the ~500 MB model downloads on first use).
  Tray > *Speak replies* reads his answers aloud with the installed Windows voices.
- **Name**: click the name in the chat header (or tray > *Rename…*) to give him a name.
- **Call him by name**: say e.g. "Shpiton, what's on my calendar?" — or just his name, then your request when he says
  "Yes?". He listens locally (tray > *Listen for his name* turns it off); Latin and Cyrillic spellings both work.
- **Tray icon** (right-click): open chat, new conversation, actions on/off, permissions, size, start with Windows.
- **Permissions**: *Ask before changes* (default — the chat shows Allow/Deny for edits and commands),
  *Auto-approve file edits*, or *Full auto* (Claude acts without asking; you confirm once when switching).

## Code

| File | What |
|---|---|
| `main.js` | Electron main: transparent overlay window, tray settings, chat window, Claude Code bridge (`claude -p --output-format stream-json`) |
| `src/app.js` | Scene, behaviour loop, drag / throw / fall, "working" pose |
| `src/geek.js` | The character: jointed model, textures, poses (`stand`, `walk`, `sit`, `held`) |
| `src/actions/*.js` | Behaviour modules picked at random by weight — add a file to add a behaviour |
| `src/parts.js` | Shared procedural-modelling helpers |
| `chat.html` | Chat panel: messages, approvals, voice recording, read-aloud |
| `voice/stt.py` | Local Whisper speech-to-text worker (raw 16 kHz float32 in, JSON lines out) |
| `voice/wake.js` | Is he being called? Fuzzy name match across scripts (`node voice/wake.js` runs its self-check) |
| `src/wake.js` | Always-on microphone listener that cuts speech into phrases |

Settings live in `%APPDATA%\desktop-assistant\settings.json`.
