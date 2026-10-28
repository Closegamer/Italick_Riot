const { app, BrowserWindow, screen, Tray, Menu, ipcMain, dialog, globalShortcut, session: browserSession } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const readline = require('readline');
const { spawn, spawnSync } = require('child_process');
const { afterName } = require('./voice/wake');

let tray, win, chat, quitting = false; // keep references, or they get garbage-collected

// Chromium stops painting windows it thinks are covered; our full-screen transparent overlay "covers" everything
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

// every file in src/actions is an action module; its file name is the action name
const ALL_ACTIONS = fs.readdirSync(path.join(__dirname, 'src', 'actions')).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3));
const SETTINGS = path.join(app.getPath('userData'), 'settings.json');
let settings = { off: [], size: 130, permissions: 'default', name: 'Assistant', speak: false, wake: true };
const TALK_KEY = 'Control+Alt+Space'; // global: open the chat and start listening
try { settings = { ...settings, ...JSON.parse(fs.readFileSync(SETTINGS, 'utf8')) }; } catch {}
const save = () => fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2));
const enabled = () => ALL_ACTIONS.filter((a) => !settings.off.includes(a));

const SIZES = { Small: 90, Medium: 130, Large: 180, Huge: 250 }; // px per model unit; Medium is ~190 px tall
const PERMISSIONS = [ // Claude Code permission modes
  ['Ask before changes', 'default'],
  ['Auto-approve file edits', 'acceptEdits'],
  ['Full auto (never ask)', 'bypassPermissions'],
];
const login = { path: process.execPath, args: [app.getAppPath()] }; // unpackaged: electron.exe + app folder

function menu() {
  const radio = (items, isOn, pick) => items.map(([label, value]) => ({ label, type: 'radio', checked: isOn(value), click: () => pick(value) }));
  return Menu.buildFromTemplate([
    { label: 'Open chat', click: () => toggleChat() },
    { label: 'Talk', accelerator: TALK_KEY, click: () => talk() },
    { label: 'Rename…', click: () => { if (!chat?.isVisible()) toggleChat(); chat?.webContents.send('claude', { type: 'rename' }); } },
    { label: 'New conversation', click: () => newChat() },
    { type: 'separator' },
    { label: 'Actions', enabled: false },
    ...ALL_ACTIONS.map((name) => ({
      label: name[0].toUpperCase() + name.slice(1),
      type: 'checkbox',
      checked: !settings.off.includes(name),
      click: (item) => {
        settings.off = item.checked ? settings.off.filter((a) => a !== name) : [...settings.off, name];
        save();
        win.webContents.executeJavaScript(`setActions(${JSON.stringify(enabled())})`);
      },
    })),
    { type: 'separator' },
    { label: 'Permissions', submenu: radio(PERMISSIONS, (v) => settings.permissions === v, setPermissions) },
    {
      label: 'Size',
      submenu: radio(Object.entries(SIZES), (px) => settings.size === px, (px) => {
        settings.size = px;
        save();
        win.webContents.executeJavaScript(`setAvatarSize(${px})`);
      }),
    },
    {
      label: 'Listen for his name',
      type: 'checkbox',
      checked: settings.wake,
      click: (item) => {
        settings.wake = item.checked;
        save();
        win.webContents.executeJavaScript(`setWake(${item.checked})`);
      },
    },
    {
      label: 'Speak replies',
      type: 'checkbox',
      checked: settings.speak,
      click: (item) => {
        settings.speak = item.checked;
        save();
        chat?.webContents.send('claude', { type: 'speak', on: item.checked });
      },
    },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: app.getLoginItemSettings(login).openAtLogin,
      click: (item) => app.setLoginItemSettings({ ...login, openAtLogin: item.checked }),
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
}

function setPermissions(mode) {
  if (mode === 'bypassPermissions') {
    const ok = dialog.showMessageBoxSync({
      type: 'warning',
      buttons: ['Enable full auto', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      message: 'Let Claude act without asking?',
      detail: 'In full auto mode Claude can edit and delete files and run any command on this computer without asking you first.',
    });
    if (ok !== 0) return tray.setContextMenu(menu()); // keep the old choice checked
  }
  settings.permissions = mode;
  save();
  tray.setContextMenu(menu());
}

// ---------- Claude: the installed Claude Code CLI in headless mode, so the user's own login and settings apply ----------
function findClaude() {
  const home = os.homedir();
  const known = [
    path.join(home, '.local', 'bin', 'claude.exe'), // native installer
    path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'), // npm
  ];
  const where = spawnSync('where', ['claude.exe'], { encoding: 'utf8' }).stdout?.split(/\r?\n/).filter(Boolean) ?? [];
  return [...known, ...where].find((p) => fs.existsSync(p));
}
const persona = () => `Your name is ${settings.name}. `
  + 'You are talking to the user through a small desktop assistant character (a friendly geek in glasses who walks around their screen). '
  + 'Replies appear in a small chat panel: keep them short, warm and in plain text with little markdown. '
  + 'Answer in the language of the latest user message (English gets English, Russian gets Russian), even if earlier messages used another language. '
  + 'You can work on their computer with your tools; the working directory is their home folder.';
let session = null, job = null;
const toChat = (msg) => chat?.webContents.send('claude', msg);

function setBusy(on) {
  win.webContents.executeJavaScript(`setBusy(${on})`);
  toChat({ type: 'busy', on });
}

const describe = (name, input = {}) =>
  input.command ? `${name === 'Bash' ? '$' : 'PS>'} ${input.command}`
  : input.file_path ? `${name} ${input.file_path}`
  : input.pattern ? `${name} ${input.pattern}`
  : input.url || input.query ? `${name} ${input.url || input.query}`
  : name;
// allow exactly the denied command for shell tools, the tool as a whole otherwise (only for the retried turn)
const rule = (d) => (d.tool_input?.command ? `${d.tool_name}(${d.tool_input.command})` : d.tool_name);

function ask(prompt, allow = []) {
  if (job) return;
  const exe = findClaude();
  if (!exe) return toChat({ type: 'error', text: 'Claude Code is not installed. Get it at https://claude.com/claude-code, sign in once, then try again.' });
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', settings.permissions, '--append-system-prompt', persona()];
  if (session) args.push('--resume', session);
  if (allow.length) args.push('--allowedTools', ...allow);
  job = spawn(exe, args, { cwd: os.homedir(), windowsHide: true });
  let stderr = '';
  job.stderr.on('data', (d) => { stderr += d; });
  readline.createInterface({ input: job.stdout }).on('line', (line) => {
    let e;
    try { e = JSON.parse(line); } catch { return; }
    if (e.session_id) session = e.session_id;
    if (e.type === 'assistant') {
      for (const b of e.message.content) {
        if (b.type === 'text' && b.text.trim()) toChat({ type: 'text', text: b.text });
        if (b.type === 'tool_use') toChat({ type: 'tool', text: describe(b.name, b.input) });
      }
    }
    if (e.type === 'result') {
      if (e.is_error) toChat({ type: 'error', text: e.result || e.subtype });
      if (e.permission_denials?.length) {
        toChat({ type: 'ask', items: e.permission_denials.map((d) => ({ text: describe(d.tool_name, d.tool_input), rule: rule(d) })) });
      }
    }
  });
  job.on('error', (err) => toChat({ type: 'error', text: err.message }));
  job.on('close', (code) => {
    if (code && stderr.trim()) toChat({ type: 'error', text: stderr.trim().slice(-600) });
    job = null;
    setBusy(false);
  });
  job.stdin.end(prompt);
  setBusy(true);
}

function stop() {
  if (job) spawnSync('taskkill', ['/pid', String(job.pid), '/T', '/F']); // also ends commands Claude started
}

function newChat() {
  stop();
  session = null;
  chat?.webContents.send('claude', { type: 'reset' });
}

// ---------- voice: a local Whisper worker (voice/stt.py) turns the chat's raw recordings into text ----------
let stt = null;
const pending = []; // { file, done } in the worker's order
function transcribe(samples, done) {
  const file = path.join(os.tmpdir(), `assistant-voice-${Date.now()}-${pending.length}.f32`);
  fs.writeFileSync(file, Buffer.from(samples));
  if (!stt) {
    let stderr = '';
    stt = spawn('python', [path.join(__dirname, 'voice', 'stt.py')], { windowsHide: true });
    stt.stderr.on('data', (d) => { stderr += d; });
    stt.on('error', () => {}); // reported on close
    stt.on('close', (code) => {
      stt = null;
      pending.splice(0).forEach((p) => fs.rm(p.file, () => {}));
      if (code) toChat({ type: 'error', text: `Voice input needs Python with faster-whisper (pip install faster-whisper).\n${stderr.trim().slice(-300)}` });
    });
    readline.createInterface({ input: stt.stdout }).on('line', (line) => {
      let m;
      try { m = JSON.parse(line); } catch { return; }
      if (m.ready) return;
      const p = pending.shift();
      fs.rm(p.file, () => {});
      p.done(m);
    });
  }
  pending.push({ file, done });
  stt.stdin.write(JSON.stringify({ path: file, hotwords: settings.name }) + '\n');
}

// open the chat if needed, then run fn once its page is ready
function withChat(fn) {
  if (!chat?.isVisible()) toggleChat();
  if (chat.webContents.isLoading()) chat.webContents.once('did-finish-load', () => setTimeout(fn, 300));
  else fn();
}

// a phrase heard by the always-on listener: act on it only if it starts with his name (or answers his "Yes?")
let awaitingUntil = 0;
function onPhrase(m) {
  const text = m.text?.trim();
  if (!text || job) return;
  const rest = afterName(text, settings.name);
  const request = rest ?? (Date.now() < awaitingUntil ? text : null); // after "Yes?" the name isn't needed
  if (request === null) return;
  if (request) {
    awaitingUntil = 0;
    return withChat(() => toChat({ type: 'heard', text: request }));
  }
  awaitingUntil = Date.now() + 8000; // name only: the next phrase is the request
  win.webContents.executeJavaScript('heardName()');
  withChat(() => toChat({ type: 'status', text: 'Yes? I’m listening…' }));
}

function talk() {
  withChat(() => { chat.focus(); toChat({ type: 'listen' }); });
}

// ---------- windows ----------
const preload = path.join(__dirname, 'preload.js');

function toggleChat(near) {
  if (!chat) {
    chat = new BrowserWindow({
      width: 380, height: 540, minWidth: 300, minHeight: 320, show: false, frame: false,
      backgroundColor: '#1e1f24', skipTaskbar: false, title: settings.name, webPreferences: { preload },
    });
    chat.setAlwaysOnTop(true, 'screen-saver');
    chat.loadFile('chat.html', { query: { name: settings.name, speak: settings.speak ? '1' : '0' } });
    chat.on('close', (e) => { if (!quitting) { e.preventDefault(); chat.hide(); } });
    chat.once('ready-to-show', () => toggleChat(near));
    return;
  }
  if (chat.isVisible()) return chat.hide();
  const d = screen.getPrimaryDisplay(), wa = d.workArea, [w, h] = chat.getSize();
  // next to him if we know where he is, otherwise bottom-right
  let x = near ? d.bounds.x + near.right + 12 : wa.x + wa.width - w - 12;
  if (x + w > wa.x + wa.width) x = Math.max(wa.x, d.bounds.x + (near?.left ?? wa.width) - w - 12);
  chat.setPosition(Math.round(x), Math.round(wa.y + wa.height - h - 12));
  chat.show();
  chat.moveTop();
  chat.focus();
}

ipcMain.on('hover', (_e, on) => win.setIgnoreMouseEvents(!on, { forward: true }));
ipcMain.on('toggle-chat', (_e, near) => toggleChat(near));
ipcMain.on('hide-chat', () => chat?.hide());
ipcMain.on('ask', (_e, text) => ask(text));
ipcMain.on('allow', (_e, rules) => ask('Approved - please go ahead.', rules));
ipcMain.on('stop', stop);
ipcMain.on('talking', (_e, on) => win.webContents.executeJavaScript(`setTalking(${!!on})`));
ipcMain.on('new-chat', newChat);
ipcMain.on('transcribe', (_e, samples) => transcribe(samples, (m) => toChat(m.error ? { type: 'error', text: m.error } : { type: 'heard', text: m.text })));
ipcMain.on('wake-audio', (_e, samples) => { if (settings.wake && !job) transcribe(samples, onPhrase); });
ipcMain.on('set-name', (_e, raw) => {
  const name = String(raw).replace(/\s+/g, ' ').trim().slice(0, 24);
  if (!name) return;
  settings.name = name;
  save();
  tray.setToolTip(name);
  chat?.setTitle(name);
  win.webContents.executeJavaScript(`setName(${JSON.stringify(name)})`);
});

if (!app.requestSingleInstanceLock()) app.quit(); // a second click on the shortcut must not spawn a second assistant
else app.whenReady().then(() => {
  browserSession.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'media')); // microphone for voice input
  const d = screen.getPrimaryDisplay();
  const { x, y, width, height } = d.bounds;
  // Transparent overlay over the whole screen (incl. taskbar) so he can roam anywhere; clicks pass through except on him.
  // height - 1: a topmost window covering the full monitor makes Windows treat it as a fullscreen app.
  win = new BrowserWindow({
    x, y, width, height: height - 1,
    transparent: true, frame: false, resizable: false, skipTaskbar: true,
    focusable: false, hasShadow: false, alwaysOnTop: true,
    webPreferences: { preload, backgroundThrottling: false },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  setInterval(() => { // the taskbar is topmost too and rises above us whenever it's touched; the chat stays above us
    win.moveTop();
    if (chat?.isVisible()) chat.moveTop();
  }, 1500);
  win.loadFile('index.html', { query: {
    ground: String(d.workArea.y + d.workArea.height - y), // top edge of the taskbar, in window pixels
    actions: enabled().join(','),
    size: String(settings.size),
    name: settings.name,
    wake: settings.wake ? '1' : '0',
  } });

  tray = new Tray(path.join(__dirname, 'icon.png'));
  tray.setToolTip(settings.name);
  tray.setContextMenu(menu());
  tray.on('click', () => toggleChat());
  globalShortcut.register(TALK_KEY, talk);
});
app.on('before-quit', () => { quitting = true; stop(); stt?.kill(); });
