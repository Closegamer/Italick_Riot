# Desktop Assistant

A 3D character (a geek in glasses and a reindeer sweater) who lives on your Windows desktop. He walks along the taskbar,
idles, sits on its edge, and can be picked up and thrown with the mouse. Click him to open a chat: your messages go to
[Claude Code](https://claude.com/claude-code) running on this computer, so he can answer questions and do tasks for you.
While Claude works he sits down with his laptop and types.

## Run

Needs Node.js and Claude Code installed and signed in (`claude` once in a terminal).

```
npm install
npm start
```

## Use

- **Click** him: open/close the chat. **Drag** him: carry him; let go to drop or throw.
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
| `chat.html` | Chat panel |

Settings live in `%APPDATA%\desktop-assistant\settings.json`.
