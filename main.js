// writtenBy('Closegamer', 2026) · closegamer@mail.ru
const { app, BrowserWindow, screen, Tray, Menu, ipcMain, dialog, globalShortcut, shell, net, powerMonitor, session: browserSession } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const readline = require('readline');
const { spawn, spawnSync } = require('child_process');
const { afterName } = require('./voice/wake');
const { topEdges } = require('./roam/edges');

let tray, win, chat, quitting = false; // keep references, or they get garbage-collected

// Chromium stops painting windows it thinks are covered; our full-screen transparent overlay "covers" everything
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

// every file in src/actions is an action module; its file name is the action name
const ALL_ACTIONS = fs.readdirSync(path.join(__dirname, 'src', 'actions')).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3));
const SETTINGS = path.join(app.getPath('userData'), 'settings.json');
let settings = { off: [], size: 130, permissions: 'default', name: 'Assistant', speak: false, wake: true, dialog: false, saver: 3 }; // dialog: conversation mode // saver: idle minutes before he roams the screen, 0 = off
const TALK_KEY = 'Control+Alt+Space'; // global: open the chat and start listening
try { settings = { ...settings, ...JSON.parse(fs.readFileSync(SETTINGS, 'utf8')) }; } catch {}
const save = () => fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2));
// shortcuts: a request the assistant solved with shell commands, saved to replay locally (no tokens) when asked the same way again
const SHORTCUTS = path.join(app.getPath('userData'), 'shortcuts.json');
let shortcuts = {};
try { shortcuts = JSON.parse(fs.readFileSync(SHORTCUTS, 'utf8')); } catch {}
const saveShortcuts = () => fs.writeFileSync(SHORTCUTS, JSON.stringify(shortcuts, null, 2));
// ponytail: exact match after normalizing; fuzzy matching (or asking a tiny model) if voice wording varies too much
const norm = (text) => (afterName(text, settings.name) ?? text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
// worth keeping as a shortcut: a whole request (3+ words, so not an answer like "1" or "memory") and not a question,
// whose answer is the assistant's words rather than the commands' raw output; never while he works inside a terminal
const lasting = (text) => norm(text).split(' ').length >= 3 && !/\?\s*$/.test(text.trim()) && !home;
const enabled = () => ALL_ACTIONS.filter((a) => !settings.off.includes(a));

const SIZES = { Small: 90, Medium: 130, Large: 180, Huge: 250 }; // px per model unit; Medium is ~190 px tall
const login = { path: process.execPath, args: [app.getAppPath()] }; // unpackaged: electron.exe + app folder

function menu() {
  const radio = (items, isOn, pick) => items.map(([label, value]) => ({ label, type: 'radio', checked: isOn(value), click: () => pick(value) }));
  const modelRadios = radio(models.map((m) => [prettyModel(m), m]),
    (m) => settings.brain.model === m, (model) => setBrain({ cli: 'opencode', model }));
  return Menu.buildFromTemplate([
    { label: 'Open chat', click: () => toggleChat() },
    { label: 'Talk', accelerator: TALK_KEY, click: () => talk() },
    { label: 'Default look', enabled: !!settings.look, click: () => setLook(null) },
    { label: 'Rename…', click: () => { if (!chat?.isVisible()) toggleChat(); chat?.webContents.send('assistant', { type: 'rename' }); } },
    { label: 'Clear chat', click: () => newChat() },
    {
      label: `Brain: ${brainLabel().join(' · ')}`,
      submenu: [
        ...(has.opencode ? [{ label: 'DeepSeek via opencode', enabled: false }, ...modelRadios] : []),
        ...(has.opencode ? [] : [{ label: 'Install opencode (needs a DeepSeek API key)', enabled: !installing, click: () => installOpencode() }]),
      ],
    },
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
    {
      label: 'Full auto (never ask)',
      type: 'checkbox',
      checked: settings.permissions === 'bypassPermissions',
      click: (item) => setPermissions(item.checked ? 'bypassPermissions' : 'default'),
    },
    { label: 'Shortcuts…', click: () => { if (!fs.existsSync(SHORTCUTS)) saveShortcuts(); shell.openPath(SHORTCUTS); } },
    {
      label: 'Screensaver',
      submenu: radio([['Off', 0], ['After 1 min', 1], ['After 3 min', 3], ['After 10 min', 10]], (m) => settings.saver === m, (m) => {
        settings.saver = m;
        save();
      }),
    },
    {
      label: 'Size',
      submenu: radio(Object.entries(SIZES), (px) => settings.size === px, (px) => {
        settings.size = px;
        save();
        win.webContents.executeJavaScript(`setAvatarSize(${px})`);
      }),
    },
    { label: 'Learn my voice…', click: () => learnVoice() },
    {
      label: 'Only my voice',
      type: 'checkbox',
      checked: !!settings.onlyMe,
      enabled: fs.existsSync(VOICEPRINT),
      click: (item) => { settings.onlyMe = item.checked; save(); },
    },
    {
      label: 'Voice check',
      enabled: fs.existsSync(VOICEPRINT),
      submenu: radio(Object.keys(STRICTNESS).map((k) => [k, k]), (k) => (settings.voiceCheck ?? 'Normal') === k, (k) => {
        settings.voiceCheck = k;
        save();
      }),
    },
    {
      label: 'Conversation mode (no name needed)',
      type: 'checkbox',
      checked: settings.dialog,
      click: (item) => setDialog(item.checked),
    },
    {
      label: 'Listen for his name',
      type: 'checkbox',
      checked: settings.wake,
      click: (item) => {
        settings.wake = item.checked;
        save();
        win.webContents.executeJavaScript(`setWake(${item.checked || settings.dialog})`);
      },
    },
    {
      label: 'Speak replies',
      type: 'checkbox',
      checked: settings.speak,
      click: (item) => {
        settings.speak = item.checked;
        save();
        chat?.webContents.send('assistant', { type: 'speak', on: item.checked });
      },
    },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: app.getLoginItemSettings(login).openAtLogin,
      click: (item) => app.setLoginItemSettings({ ...login, openAtLogin: item.checked }),
    },
    { type: 'separator' },
    { label: 'Quit', click: goodbye },
  ]);
}

function setPermissions(mode) {
  if (mode === 'bypassPermissions') {
    const ok = dialog.showMessageBoxSync({
      type: 'warning',
      buttons: ['Enable full auto', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      message: 'Let the assistant act without asking?',
      detail: 'In full auto mode the assistant can edit and delete files and run any command on this computer without asking you first.',
    });
    if (ok !== 0) return tray.setContextMenu(menu()); // keep the old choice checked
  }
  settings.permissions = mode;
  save();
  tray.setContextMenu(menu());
}

// ---------- his brain: opencode in headless mode, running DeepSeek models with the user's own API key ----------
const EXE = process.platform === 'win32' ? '.exe' : '';
const onPath = (name) => spawnSync(process.platform === 'win32' ? 'where' : 'which', [name + EXE], { encoding: 'utf8' }).stdout?.split(/\r?\n/).filter(Boolean) ?? [];
function findOpencode() {
  return [
    path.join(process.resourcesPath ?? '', 'opencode', `opencode${EXE}`), // shipped inside Shpiton's installer
    path.join(os.homedir(), '.opencode', 'bin', `opencode${EXE}`), // installed by him or by opencode's own installer
    ...onPath('opencode'),
  ].find((p) => fs.existsSync(p));
}
const has = { opencode: !!findOpencode() };
const DEEPSEEK_DEFAULT = 'deepseek/deepseek-flash';
let models = [
  'deepseek/deepseek-flash',
  'deepseek/deepseek-v4-pro',
  'opencode/deepseek-v4.1-flash',
  'opencode/deepseek-v4.1-flash-free',
]; // the live list comes from opencode at startup
// ask opencode which DeepSeek models this machine can actually use (it knows the stored keys)
function loadModels() {
  try {
    const exe = findOpencode();
    const out = exe ? spawnSync(exe, ['models'], { encoding: 'utf8', windowsHide: true }).stdout ?? '' : '';
    const ids = out.split(/\r?\n/).map((l) => l.trim()).filter((l) => /deepseek/i.test(l) && /^[\w.-]+\/[\w.-]+$/.test(l));
    if (ids.length) { // the same model may be listed by two providers: show it once
      const seen = new Set();
      models = ids.filter((id) => { const name = prettyModel(id); if (seen.has(name)) return false; seen.add(name); return true; });
    }
  } catch {}
  tray?.setContextMenu(menu());
}
// deepseek/deepseek-v4-pro -> "DeepSeek V4 Pro"; opencode/deepseek-v4.1-flash-free -> "DeepSeek V4.1 Flash (free)"
const prettyModel = (id) => {
  const base = id.replace(/^[^/]+\//, '').replace(/^deepseek-/, ''), free = base.endsWith('-free');
  const words = base.replace(/-free$/, '').split(/[-_]/).filter(Boolean);
  return words.map((w) => (/^v?\d/.test(w) ? w.replace(/^v/i, 'V') : w[0].toUpperCase() + w.slice(1))).join(' ') + (free ? ' (free)' : '');
};
// an old settings file may still name the Claude brain: start on DeepSeek and drop what only Claude Code used
if (settings.brain?.cli !== 'opencode' || !/deepseek/i.test(settings.brain?.model ?? '')) settings.brain = { cli: 'opencode', model: DEEPSEEK_DEFAULT };
delete settings.versions;
delete settings.session;
delete settings.vpn;
if (settings.permissions === 'acceptEdits') settings.permissions = 'default'; // opencode has no edit-only approval mode
// what his flag says: [provider, model]
const brainLabel = () => {
  if (noBrain()) return ['No AI yet', installing ? 'installing…' : 'say: install opencode'];
  return ['DeepSeek', prettyModel(settings.brain.model)];
};
function setBrain(brain) {
  settings.brain = brain;
  save();
  tray.setContextMenu(menu());
  flag();
}

// ---------- a new computer with no AI: he installs opencode and explains how to add the DeepSeek key ----------
const noBrain = () => !has.opencode;
let installing = false;
function guide(ru = ruClock()) {
  withChat(() => toChat({ type: 'text', text: ru
    ? 'У меня пока нет мозга: на этом компьютере не установлен opencode, через который я работаю на DeepSeek. '
      + 'Скажи «установи opencode» — я сам скачаю его (около 120 МБ). Потом подключи ключ DeepSeek: '
      + 'выполни в терминале `opencode auth login`, выбери DeepSeek и вставь ключ. После этого спроси «какие модели».'
    : 'I have no brain yet: opencode, which I use to run on DeepSeek, is not installed on this computer. '
      + 'Say "install opencode" and I download it (about 120 MB). Then add your DeepSeek key: run `opencode auth login` in a terminal, '
      + 'pick DeepSeek and paste the key. After that, ask "which models".' }));
}
const status = (text) => withChat(() => toChat({ type: 'status', text }));
function installed(what) {
  installing = false;
  setBusy(false);
  tray.setContextMenu(menu());
  flag();
  return what;
}
// OpenCode 2 straight from its GitHub release: one file, unpacked with the tar every Windows 10+, macOS and Linux has.
// (opencode's own install script and npm package still give version 1, whose CLI lacks --standalone and --auto.)
// ponytail: no "baseline" (pre-AVX2 CPU) or musl builds; add them if someone's old PC or Alpine needs them
async function installOpencode() {
  if (installing || has.opencode) return;
  installing = true;
  setBusy(true);
  flag();
  try {
    const plat = { win32: 'windows', darwin: 'darwin', linux: 'linux' }[process.platform], arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    const ext = plat === 'linux' ? '.tar.gz' : '.zip';
    status('Looking for the latest opencode…');
    const releases = await (await net.fetch('https://api.github.com/repos/anomalyco/opencode/releases?per_page=30')).json();
    const tag = releases.find?.((r) => /^v2\.\d+\.\d+$/.test(r.tag_name))?.tag_name;
    if (!tag) throw new Error('no OpenCode 2 release found on GitHub');
    status(`Downloading opencode ${tag} (about 120 MB)…`);
    const r = await net.fetch(`https://github.com/anomalyco/opencode/releases/download/${tag}/opencode-${plat}-${arch}${ext}`);
    if (!r.ok) throw new Error(`download failed: HTTP ${r.status}`);
    const dir = path.join(os.homedir(), '.opencode', 'bin'), file = path.join(os.tmpdir(), `opencode-${tag}${ext}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    status('Unpacking…');
    const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar'; // not Git's GNU tar: it can't open zips
    const out = spawnSync(tar, ['-xf', file, '-C', dir], { encoding: 'utf8' });
    fs.rmSync(file, { force: true });
    if (out.status !== 0) throw new Error(out.stderr?.trim() || out.error?.message || 'unpacking failed');
    if (!EXE) fs.chmodSync(path.join(dir, 'opencode'), 0o755);
    if (!findOpencode()) throw new Error('opencode was not where the archive should have put it');
    has.opencode = true;
    loadModels();
    installed();
    setBrain({ cli: 'opencode', model: DEEPSEEK_DEFAULT });
    toChat({ type: 'text', text: `${ruClock() ? 'Готово! opencode установлен' : 'Done! opencode is installed'}. `
      + (ruClock() ? 'Теперь подключи ключ DeepSeek: выполни в терминале `opencode auth login`, выбери DeepSeek и вставь ключ. Потом спроси «какие модели».'
        : 'Now add your DeepSeek key: run `opencode auth login` in a terminal, pick DeepSeek and paste the key. Then ask "which models".') });
  } catch (err) {
    installed();
    toChat({ type: 'error', text: `${ruClock() ? 'Не получилось установить opencode' : 'Couldn’t install opencode'}: ${err.message}` });
  }
}

// ---------- hello on launch: where he is ----------
// ponytail: the IP shows where a VPN exits, so "in Russia" also trusts the clock's time zone; a list of Russian zones
const RU_ZONES = /^(Europe\/(Moscow|Kaliningrad|Samara|Volgograd|Saratov|Ulyanovsk|Kirov|Astrakhan)|Asia\/(Yekaterinburg|Omsk|Novosibirsk|Barnaul|Tomsk|Novokuznetsk|Krasnoyarsk|Irkutsk|Chita|Yakutsk|Khandyga|Vladivostok|Ust-Nera|Magadan|Sakhalin|Srednekolymsk|Kamchatka|Anadyr))$/;
const ruClock = () => RU_ZONES.test(Intl.DateTimeFormat().resolvedOptions().timeZone);
let geo = {}; // where the internet sees this PC: { country_code, country, city }
// ponytail: polled every 2 minutes for the flag; a VPN switched on or off shows up with that delay
async function geoIp() {
  try { geo = await (await net.fetch('https://ipwho.is/')).json(); } catch { geo = {}; }
  flag();
  return geo;
}
function flag() {
  win.webContents.executeJavaScript(`setFlag(${JSON.stringify({ brain: brainLabel(), place: geo.country ? `online · ${geo.country}` : 'no internet?', ok: null })})`).catch(() => {});
}
async function greet() {
  await geoIp();
  const ru = ruClock(), owner = settings.owner || os.userInfo().username, place = [geo.city, geo.country].filter(Boolean).join(', ');
  const where = !place ? '' : ru ? ` Ты в сети из: ${place}.` : ` You're online from ${place}.`;
  withChat(() => toChat({ type: 'text', text: `${ru ? 'Привет' : 'Hi'}, ${owner}!${where}` }));
  if (noBrain()) { // a new computer: he installs opencode himself and explains how to add the key
    guide(ru);
    status(ru ? 'Ставлю opencode…' : 'Installing opencode…');
    installOpencode();
  }
  setInterval(geoIp, 120000);
  // a VPN switched on or off adds or drops its tunnel adapter: recheck the IP at once (and again once routes settle)
  // ponytail: a VPN in plain proxy mode (no adapter) is only noticed by the 2-minute poll
  let nets = '';
  setInterval(() => {
    const now = JSON.stringify(Object.entries(os.networkInterfaces()).map(([n, a]) => [n, a.map((x) => x.address)]));
    if (nets && now !== nets) { setTimeout(geoIp, 1000); setTimeout(geoIp, 5000); }
    nets = now;
  }, 2000);
}

const persona = () => `Your name is ${settings.name}. `
  + 'You are talking to the user through a small desktop assistant character (a friendly geek in glasses who walks around their screen). '
  + 'Replies appear in a small chat panel: keep them short, warm and in plain text with little markdown. '
  + 'Answer in the language of the latest user message (English gets English, Russian gets Russian), even if earlier messages used another language. '
  + 'You can work on their computer with your tools; the working directory is their home folder. '
  + 'This is one long conversation that has run since you were first launched on this computer, so earlier messages are your memory. '
  + 'The app also handles some phrases itself, without you, and tells you about them in a note before the next message: '
  + '"go rest / отдохни / спрячься" sends you out through a door ("come back / вернись" or your name brings you back); '
  + '"explore / погуляй" and idle time start the screensaver, where you climb the windows; '
  + 'requests you solved with shell commands are saved as shortcuts and replayed locally next time; '
  + '"which models" and "switch to <model>" change the AI model you run on (tray → Brain too). '
  + 'Point the user to these when they fit.';
// one opencode conversation for good: its id is saved, so restarts resume it (opencode condenses it when it gets long)
let job = null;
// things the app did without the AI (rest, shortcuts...): told to it with the next message
const happened = [];
const note = (text) => { happened.push(text); if (happened.length > 20) happened.shift(); };
const toChat = (msg) => chat?.webContents.send('assistant', msg);

function setBusy(on) {
  win.webContents.executeJavaScript(`setBusy(${on})`);
  toChat({ type: 'busy', on });
}

const describe = (name, input = {}) =>
  input.command ? `$ ${input.command}`
  : input.filePath || input.file_path ? `${name} ${input.filePath || input.file_path}`
  : input.pattern ? `${name} ${input.pattern}`
  : input.url || input.query ? `${name} ${input.url || input.query}`
  : name;
// opencode's tool names, in its own lower-case spelling
const SHELLS = ['bash', 'shell'];
const READ_ONLY = ['read', 'glob', 'grep', 'list', 'webfetch', 'websearch', 'todowrite', 'toolsearch', 'task'];
let request = '', steps = [], replayable = true; // the user's request and the commands the assistant ran for it

// "TYPE: <command>" lines are for the terminal he lives in: the app types them there, they're not shown as text
function showText(text) {
  const shown = text.replace(/^[ \t]*`*TYPE:[ \t]*(.+?)`*[ \t]*$/gm, (_, cmd) => { toType.push(cmd.trim()); return ''; }).replace(/\n{3,}/g, '\n\n').trim();
  if (shown) toChat({ type: 'text', text: shown });
}

// opencode headless: --standalone runs a private server, because its shared one sits on a fixed port that Windows can reserve.
// Its own conversation (settings.ocSession) learns the persona from its first message.
function ask(prompt) {
  if (job) return;
  const exe = findOpencode();
  if (!exe) return toChat({ type: 'error', text: 'opencode is not installed. Say "install opencode", or get it at https://opencode.ai.' });
  const args = ['run', '--standalone', '--format', 'json', '-m', settings.brain.model];
  if (settings.ocSession) args.push('--session', settings.ocSession);
  else prompt = `${persona()}\n\n${prompt}`;
  if (settings.permissions === 'bypassPermissions') args.push('--auto');
  job = spawn(exe, args, { cwd: os.homedir(), windowsHide: true });
  let stderr = '', failed = false;
  job.stderr.on('data', (d) => { stderr += d; });
  readline.createInterface({ input: job.stdout }).on('line', (line) => {
    let e;
    try { e = JSON.parse(line); } catch { return; }
    if (e.sessionID && e.sessionID !== settings.ocSession) { settings.ocSession = e.sessionID; save(); }
    if (e.type === 'text' && e.part?.text?.trim()) showText(e.part.text);
    if (e.type === 'tool_use') {
      const tool = e.part.tool, input = e.part.state?.input ?? {};
      toChat({ type: 'tool', text: describe(tool === 'bash' ? 'Bash' : tool, input) });
      if (SHELLS.includes(tool) && input.command) steps.push({ tool: 'Bash', command: input.command });
      else if (!READ_ONLY.includes(tool)) replayable = false; // file edits etc. can't be replayed as commands
    }
    if (e.type === 'error') {
      failed = true;
      const out = /quota|limit/i.test(`${e.error?.type} ${e.error?.message}`) ? '\nSay "which models" or "switch to <model>" (no tokens needed), or pick one in the tray → Brain.' : '';
      toChat({ type: 'error', text: (e.error?.message ?? 'opencode failed') + out });
    }
  });
  job.on('error', (err) => toChat({ type: 'error', text: err.message }));
  job.on('close', (code) => {
    if (code && !failed && stderr.trim()) toChat({ type: 'error', text: stderr.trim().slice(-600) });
    if (toType.length) typeHere(toType.splice(0));
    if (!failed && !code && replayable && steps.length && lasting(request) && !shortcuts[norm(request)]) remember(); // he learns it by himself
    job = null;
    setBusy(false);
  });
  job.stdin.end(prompt);
  setBusy(true);
}

function remember() {
  shortcuts[norm(request)] = { phrase: request, steps };
  saveShortcuts();
  toChat({ type: 'tool', text: `✓ saved: “${request}” will run locally next time` });
}

// fixed commands, handled right here without the AI: he leaves through a door, or comes back out of it
const COMMANDS = {
  leave: ['go rest', 'rest', 'hide', 'disappear', 'отдохни', 'иди отдохни', 'спрячься', 'исчезни'],
  comeBack: ['come back', 'вернись'],
  explore: ['explore', 'go explore', 'go for a walk', 'погуляй', 'гуляй', 'иди гулять'],
  learnVoice: ['learn my voice', 'remember my voice', 'запомни мой голос', 'выучи мой голос'],
  dialogOn: ['let s talk', 'lets talk', 'conversation mode', 'dialog mode on', 'dialogue mode on', 'dialog mode', 'dialogue mode', 'conversation mode on', 'давай поговорим', 'поговорим', 'режим разговора', 'режим диалога'],
  dialogOff: ['stop listening', 'dialog mode off', 'dialogue mode off', 'conversation mode off','end conversation', 'end of conversation', 'that s all', 'хватит', 'хватит слушать', 'конец разговора', 'закончим разговор'],
  leaveHome: ['leave the window', 'get out of the window', 'go down', 'come down', 'выйди из окна', 'выходи из окна', 'спустись', 'спускайся', 'вылезай'],
};
const REPLIES = {
  leave: ['Okay, I’ll go rest. Call me by name when you need me.', 'Хорошо, пойду отдохну. Позови меня по имени, когда понадоблюсь.'],
  comeBack: ['I’m back!', 'Я тут!'],
  explore: ['Off I go exploring your windows! Say anything and I’ll come down.', 'Пойду погуляю по окнам! Скажи что-нибудь, и я спущусь.'],
  learnVoice: ['Okay!', 'Хорошо!'],
  dialogOn: ['Conversation mode is on: just talk, no need to say my name. I answer after a pause. Say "stop listening" to end it.',
    'Режим разговора включён: просто говори, имя не нужно. Отвечаю после паузы. Скажи «хватит», чтобы закончить.'],
  dialogOff: ['Conversation mode is off. Say my name when you need me.', 'Режим разговора выключен. Позови меня по имени, когда понадоблюсь.'],
  leaveHome: ['Coming down to the taskbar!', 'Спускаюсь на панель задач!'],
};
// "switch to pro", "use deepseek flash", "переключись на pro", "which models": his brain changes right here, without the
// AI, so it works even when the current model is out of tokens
const SWITCH = /^(?:switch(?: brain| model)? to|change (?:brain|model) to|use|переключись на|переключи на|переключись|смени модель на|используй)\s+(.+)$/;
const LIST = /^(?:which|what|list)(?: models| brains)|^(?:models|brains)$|^(?:какие|список) модел|^модели$/;
const key = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function brains() {
  return models.map((m) => ({
    cli: 'opencode', model: m,
    key: key(`${prettyModel(m)} ${m.replace(/^[^/]+\//, '')}`),
  }));
}
// "deepseek" alone = the first model; otherwise the closest model name ("flash", "pro", "free"...)
function brainFor(want) {
  const name = want.replace(/^(deepseek|open ?code)\s*/, '');
  const options = brains();
  if (!name) return options[0];
  return options.find((o) => o.key === name) ?? options.find((o) => o.key.startsWith(name)) ?? options.find((o) => o.key.includes(name));
}
const brainList = () => brains().map((o) => `DeepSeek ${prettyModel(o.model)}`).join(', ');
// what speech-to-text makes of the names (and Russian ways to say them) -> the names; filler words dropped
const SAID = {
  deep: 'deepseek', deepseek: 'deepseek', deepsick: 'deepseek', дип: 'deepseek', дипсик: 'deepseek', дипси: 'deepseek',
  flash: 'flash', флеш: 'flash', флэш: 'flash', pro: 'pro', про: 'pro', профи: 'pro', free: 'free', фри: 'free',
  v4: 'v4', 'в4': 'v4', op: 'opencode', опен: 'open', оупен: 'open',
  switch: 'switch', свіч: 'switch', свич: 'switch', свитч: 'switch', into: 'to', інту: 'to', инту: 'to', ту: 'to',
  model: '', models: 'models', модель: '', please: '', пожалуйста: '', the: '',
};
const canon = (n) => n.split(' ').map((w) => SAID[w] ?? w).filter(Boolean).join(' ').replace(/\bopen code\b/g, 'opencode');
// "install opencode", "установи opencode", "setup": the way to a brain, without one
const INSTALL = /^(?:install|установи|поставь|скачай|загрузи)\s+opencode$/;
const SETUP = /^(?:setup|set up|настрой|настройка|настроить|how to connect ai|как подключить ии)$/;
function setupCommand(n, ru) {
  n = canon(n);
  if (INSTALL.test(n)) {
    if (has.opencode) toChat({ type: 'text', text: ru ? 'Уже установлено. «какие модели» покажет, что можно выбрать.' : 'Already installed. "which models" shows what you can pick.' });
    else installOpencode();
    return true;
  }
  if (!SETUP.test(n)) return false;
  guide(ru);
  return true;
}
function switchCommand(n, ru) {
  n = canon(n);
  const want = n.match(SWITCH)?.[1];
  if (!want && !LIST.test(n)) return false;
  const now = brainLabel().join(' · ');
  if (!want) return toChat({ type: 'text', text: ru ? `Сейчас: ${now}. Могу: ${brainList()}.` : `Now: ${now}. I can use: ${brainList()}.` }) ?? true;
  const b = brainFor(want);
  if (!b && want.split(' ').length > 3) return false; // "use deepseek to write a script": a request, not a switch
  if (!b) return toChat({ type: 'error', text: ru ? `Не знаю модель «${want}». Могу: ${brainList()}.` : `I don't know "${want}". I can use: ${brainList()}.` }) ?? true;
  setBrain({ cli: b.cli, model: b.model });
  toChat({ type: 'text', text: `${ru ? 'Переключился' : 'Switched'}: ${brainLabel().join(' · ')}` });
  note(`the user switched the app to ${brainLabel().join(' ')}`);
  return true;
}

function command(text) {
  const n = norm(text);
  if (setupCommand(n, /[а-яё]/i.test(text)) || switchCommand(n, /[а-яё]/i.test(text))) return true;
  const name = Object.keys(COMMANDS).find((c) => COMMANDS[c].includes(norm(text)));
  if (!name) return false;
  toChat({ type: 'text', text: REPLIES[name][/[а-яё]/i.test(text) ? 1 : 0] });
  note(`the user said "${text}" and the app ran the built-in "${name}" command`);
  if (name === 'explore') { exploring = true; roamCheck(); }
  else if (name === 'dialogOn' || name === 'dialogOff') setDialog(name === 'dialogOn', true);
  else if (name === 'learnVoice') learnVoice();
  else win.webContents.executeJavaScript(`${name}()`);
  if (name === 'leave' || name === 'explore') setTimeout(() => chat?.hide(), 1500); // so you can watch him go
  return true;
}

// a new request: a fixed command, else a saved shortcut, else ask the AI
function newRequest(text) {
  exploring = false; // any message calls him down
  roamCheck();
  if (job || command(text)) return;
  if (noBrain()) return guide(/[а-яё]/i.test(text));
  const saved = !home && shortcuts[norm(text)]; // shortcuts run in the home folder, so not while he lives in a terminal
  if (saved) { note(`the user asked "${text}" and the app replayed its saved shortcut for it`); return replay(saved.steps); }
  request = text; steps = []; replayable = true;
  const notes = happened.splice(0);
  ask((notes.length ? `[Since your last reply the app did this without you: ${notes.join('; ')}.]\n\n` : '')
    + (home ? `${HOME_NOTE}\n\n` : '') + text);
}

function gitBash() {
  const gits = spawnSync('where', ['git.exe'], { encoding: 'utf8' }).stdout?.split(/\r?\n/).filter(Boolean) ?? [];
  // Git\cmd\git.exe or Git\mingw64\bin\git.exe -> Git\bin\bash.exe; never WSL's System32 bash
  return gits.flatMap((g) => [path.join(g, '..', '..', 'bin', 'bash.exe'), path.join(g, '..', '..', '..', 'bin', 'bash.exe')]).find((p) => fs.existsSync(p));
}

// run the saved commands one by one in the home folder; stop at the first failure
// ponytail: each command runs in a fresh shell, so a `cd` in one step doesn't carry into the next
function replay(list, i = 0) {
  if (i === 0) { setBusy(true); toChat({ type: 'tool', text: '⚡ saved shortcut, no tokens used' }); }
  if (i >= list.length) { job = null; return setBusy(false); }
  const { tool, command } = list[i];
  const [exe, args] = tool === 'Bash' ? [gitBash(), ['-c', command]] : ['powershell.exe', ['-NoProfile', '-Command', command]];
  if (!exe) { job = null; setBusy(false); return toChat({ type: 'error', text: 'Git Bash not found, so this shortcut can’t run.' }); }
  toChat({ type: 'tool', text: describe(tool, { command }) });
  let out = '';
  job = spawn(exe, args, { cwd: os.homedir(), windowsHide: true });
  job.stdout.on('data', (d) => { out += d; });
  job.stderr.on('data', (d) => { out += d; });
  job.on('error', (err) => { out += err.message; });
  job.on('close', (code) => {
    const text = out.trim().slice(-1500);
    if (code) { job = null; setBusy(false); return toChat({ type: 'error', text: `Step ${i + 1} failed (exit ${code}).\n${text}` }); }
    if (text) toChat({ type: 'text', text });
    replay(list, i + 1);
  });
}

function stop() {
  if (job) spawnSync('taskkill', ['/pid', String(job.pid), '/T', '/F']); // also ends commands the AI started
}

// clears the chat panel only: he keeps his memory (the one long conversation)
function newChat() {
  stop();
  chat?.webContents.send('assistant', { type: 'reset' });
}

// ---------- voice: a local Whisper worker (voice/stt.py) turns the chat's raw recordings into text ----------
let stt = null;
const pending = []; // { file, done } in the worker's order
function transcribe(samples, done, embed = false) {
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
  stt.stdin.write(JSON.stringify({ path: file, hotwords: settings.name, embed }) + '\n');
}

// Quit: he comes down from the windows if he's up there, walks off through his door, then the app closes
let leavingApp = false;
async function goodbye() {
  if (leavingApp) return app.quit(); // a second Quit doesn't wait
  leavingApp = true;
  chat?.hide();
  const timeout = new Promise((r) => setTimeout(r, 20000));
  await Promise.race([win.webContents.executeJavaScript('leaveForQuit()'), timeout]).catch(() => {});
  app.quit();
}

// ---------- his look: the app can restyle him, and "Default look" forgets a saved one ----------
function setLook(look) {
  settings.look = look;
  save();
  tray.setContextMenu(menu());
  win.webContents.executeJavaScript(`setLook(${JSON.stringify(look ?? {})})`);
}

// ---------- his home: a terminal window the user dropped him into. "Here" means that terminal, so commands for it are
// typed into it (in its own current folder, and a cd really moves it) instead of run with the AI's tools in the home folder.
let home = null; // hwnd of that terminal window
// While he lives there he's drawn in that window's layer: the overlay drops out of always-on-top and a small helper keeps
// it just above the terminal, so windows on top of the terminal cover him too. Leaving puts him back on top of everything.
let layerer = null;
const overlayHwnd = () => String(win.getNativeWindowHandle().readBigInt64LE());
function keepInLayer() {
  if (!home) return;
  if (!layerer) {
    layerer = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'roam', 'zorder.ps1')], { windowsHide: true });
    layerer.on('error', () => {});
    layerer.on('close', () => { layerer = null; });
  }
  layerer.stdin.write(`${overlayHwnd()} ${home}\n`);
}
ipcMain.on('home', (_e, id) => {
  home = id;
  if (home) { win.setAlwaysOnTop(false); keepInLayer(); }
  else { win.setAlwaysOnTop(true, 'screen-saver'); win.moveTop(); }
});
const toType = []; // TYPE: lines from the AI's reply, typed once the turn is over
const HOME_NOTE = '[You are standing inside the user\'s terminal window right now. When the user means "here" (create, list, open, '
  + 'go into a folder...), act in THAT terminal, in its current folder, not with your own tools: write each command on its own line '
  + 'as "TYPE: <command>", and the app types it there and presses Enter. E.g. "TYPE: mkdir reports", then "TYPE: cd reports" to go into it. '
  + 'Its shell may be PowerShell, cmd or bash: use commands that work in all three (mkdir, cd, dir, git, python...). '
  + 'You don\'t see the terminal\'s output, so keep the commands simple and say in a few words what you typed.]';
function typeHere(cmds) {
  if (!home) return;
  for (const c of cmds) toChat({ type: 'tool', text: `⌨ ${c}` });
  const typer = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'roam', 'type.ps1'), '-Hwnd', String(home)], { windowsHide: true });
  typer.on('error', () => {});
  typer.on('close', (code) => { if (code) toChat({ type: 'error', text: 'I couldn’t get to the terminal window to type there. Is it still open?' }); });
  typer.stdin.end(cmds.join('\n') + '\n');
  win.webContents.executeJavaScript('typing(3)').catch(() => {});
}

// ---------- screensaver: while the user is away he roams the whole screen, standing on the tops of windows ----------
let roaming = false, lister = null, exploring = false; // exploring: asked to by command, not by idleness
function roamCheck() {
  const idle = settings.saver > 0 && powerMonitor.getSystemIdleTime() >= settings.saver * 60;
  const on = (idle || exploring) && !job && !leavingApp;
  if (on === roaming) return;
  roaming = on;
  win.webContents.executeJavaScript(`setRoam(${on})`);
}

// open windows, always tracked: their top edges are platforms in the screensaver, and a terminal can be his home
function startLister() {
  lister = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'roam', 'windows.ps1'), '-Skip', String(process.pid)], { windowsHide: true });
  lister.on('error', () => {});
  readline.createInterface({ input: lister.stdout }).on('line', (line) => {
    let list;
    try { list = JSON.parse(line); } catch { return; }
    // ponytail: primary display only, and one scale factor for all windows; per-monitor DPI if he roams other screens
    const d = screen.getPrimaryDisplay(), f = d.scaleFactor;
    const rects = list.map(([id, l, t, r, b, term]) => ({ id: String(id), l: l / f - d.bounds.x, t: t / f - d.bounds.y, r: r / f - d.bounds.x, b: b / f - d.bounds.y, term }));
    win.webContents.executeJavaScript(`setEdges(${JSON.stringify(topEdges(rects))}); setWindows(${JSON.stringify(rects)})`);
    keepInLayer(); // the window order may have changed: back above his terminal
  });
  lister.on('close', () => { if (!quitting) setTimeout(startLister, 3000); }); // keep it alive
}

// open the chat if needed, then run fn once its page is ready
function withChat(fn) {
  if (!chat?.isVisible()) toggleChat();
  if (chat.webContents.isLoading()) chat.webContents.once('did-finish-load', () => setTimeout(fn, 300));
  else fn();
}

// a phrase heard by the always-on listener: act on it only if it starts with his name (or answers his "Yes?")
let awaitingUntil = 0;
// Conversation mode: every phrase counts (no name needed). Phrases are collected and sent as one request after a long
// pause; starting to talk again holds it back, so a long thought with breaths in it stays together.
const PAUSE = 2500; // ms of quiet after the last phrase
// Whisper's usual inventions on silence or noise: never worth a request
const NOISE = /^(продолжение следует|субтитры|редактор субтитров|спасибо за просмотр|thank you\.?|thanks for watching|you\.?|\.+)$/i;
let said = [], saidLang = 'en', sayTimer = null, talkingNow = false, talkedAt = 0;
function setDialog(on, quiet = false) {
  settings.dialog = on;
  save();
  tray.setContextMenu(menu());
  win.webContents.executeJavaScript(`setWake(${settings.wake || on})`);
  said = [];
  clearTimeout(sayTimer);
  if (!quiet) withChat(() => toChat({ type: 'status', text: on ? 'Conversation mode: I’m listening to everything you say.' : 'Conversation mode off.' }));
}
function sayLater() {
  clearTimeout(sayTimer);
  if (said.length) sayTimer = setTimeout(() => {
    const text = said.splice(0).join(' ').trim();
    if (text && !job) withChat(() => toChat({ type: 'heard', text, lang: saidLang }));
  }, PAUSE);
}
ipcMain.on('wake-speech', (_e, talk) => {
  if (!settings.dialog) return;
  if (talk) clearTimeout(sayTimer); // you're still talking: hold the request
  else sayLater(); // that was just a noise
});
// ---------- only my voice: each phrase the listener hears carries a voiceprint (voice/stt.py), compared with the user's ----------
const VOICEPRINT = path.join(app.getPath('userData'), 'voiceprint.json');
const LEARN = 6; // phrases that make the user's voiceprint
let learning = null; // the voiceprints collected so far while learning
// the score a phrase needs to count as the user's. For this model the same person usually scores ~0.6-0.85 and others
// below ~0.4. A bar set just under the learning phrases themselves (all recorded at one sitting) was far too strict:
// it shut the user out the moment they spoke from further away. Lowered further if their own phrases varied more.
const STRICTNESS = { Relaxed: 0.45, Normal: 0.55, Strict: 0.65 };
const bar = () => Math.min(STRICTNESS[settings.voiceCheck ?? 'Normal'], (mine.own ?? 1) - 0.05);
const unit = (v) => { const n = Math.hypot(...v); return v.map((x) => x / n); };
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
let mine = null;
try { mine = JSON.parse(fs.readFileSync(VOICEPRINT, 'utf8')); } catch {}
function learnVoice() {
  learning = [];
  win.webContents.executeJavaScript('setWake(true)');
  withChat(() => toChat({ type: 'text', silent: true, text: `Let me learn your voice: just talk for half a minute, or read this aloud, with pauses between sentences. `
    + `"Hi ${settings.name}. Open the reports folder. What's the weather tomorrow? Привет! Сколько у нас токенов? Создай папку для проекта."` }));
}
function learnFrom(m) {
  if (m.embError) { learning = null; return toChat({ type: 'error', text: `I can't take voiceprints: ${m.embError}\nIt needs: pip install sherpa-onnx` }); }
  if (!m.emb || (m.text ?? '').split(/\s+/).length < 2) return; // a cough or a word is too little to go on
  learning.push(m.emb);
  if (learning.length < LEARN) return toChat({ type: 'status', text: `Learning your voice: ${learning.length}/${LEARN}… keep talking` });
  const print = unit(learning[0].map((_, i) => learning.reduce((sum, e) => sum + e[i], 0)));
  // own: how close the least typical of the user's phrases came to their average - the bar is set relative to it
  mine = { print, own: Math.min(...learning.map((e) => dot(e, print))) };
  fs.writeFileSync(VOICEPRINT, JSON.stringify(mine));
  learning = null;
  settings.onlyMe = true;
  save();
  tray.setContextMenu(menu());
  win.webContents.executeJavaScript(`setWake(${settings.wake || settings.dialog})`);
  toChat({ type: 'status', text: '' });
  toChat({ type: 'text', text: 'Got it, I know your voice now. From now on I only listen to you (tray: "Only my voice").' });
}

function onPhrase(m) {
  if (learning) return learnFrom(m);
  // someone else talking: not for him (the 🎤 button isn't checked: the user pressed it)
  const score = settings.onlyMe && mine && m.emb ? dot(m.emb, mine.print) : 1;
  if (score < bar()) {
    // shown only when it was meant for him (his name, or conversation mode), so the score helps to tune "Voice check"
    if (settings.dialog || afterName(m.text ?? '', settings.name) !== null) toChat({ type: 'status', text: `🔇 not your voice (${score.toFixed(2)}, needs ${bar().toFixed(2)})` });
    return settings.dialog ? sayLater() : undefined;
  }
  const text = m.text?.trim();
  if (settings.dialog) {
    if (talkingNow || Date.now() - talkedAt < 800 || job) return sayLater(); // his own voice, or he's busy
    if (!text || NOISE.test(text.replace(/[.!…\s]+$/, ''))) return sayLater();
    said.push(afterName(text, settings.name) || text); // a name said out of habit is dropped
    saidLang = m.lang || saidLang;
    withChat(() => toChat({ type: 'status', text: `🎙${score < 1 ? ` ${score.toFixed(2)}` : ''} ${said.join(' ')}` })); // the score helps tune Voice check
    return sayLater();
  }
  if (!text || job) return;
  const rest = afterName(text, settings.name);
  const request = rest ?? (Date.now() < awaitingUntil ? text : null); // after "Yes?" the name isn't needed
  if (request === null) return;
  if (request) {
    awaitingUntil = 0;
    return withChat(() => toChat({ type: 'heard', text: request, lang: m.lang }));
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
ipcMain.on('ask', (_e, text) => newRequest(text));
ipcMain.on('stop', stop);
ipcMain.on('talking', (_e, on) => {
  if (talkingNow && !on) talkedAt = Date.now(); // conversation mode ignores the mic for a moment after he speaks
  talkingNow = !!on;
  win.webContents.executeJavaScript(`setTalking(${!!on})`);
});
ipcMain.on('new-chat', newChat);
ipcMain.on('transcribe', (_e, samples) => transcribe(samples, (m) => toChat(m.error ? { type: 'error', text: m.error } : { type: 'heard', text: m.text, lang: m.lang })));
// audio heard while he speaks (or right after) is his own voice from the speakers: drop it before transcribing
ipcMain.on('wake-audio', (_e, samples) => {
  if ((settings.wake || settings.dialog || learning) && !job && !talkingNow && Date.now() - talkedAt > 1500) transcribe(samples, onPhrase, !!(learning || settings.onlyMe));
});
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
  const full = { x, y, width, height: height - 1 };
  setInterval(roamCheck, 3000);
  // where the mouse pointer is, for him to keep an eye on (only sent when it moves)
  let last = '';
  setInterval(() => {
    const c = screen.getCursorScreenPoint(), at = `${c.x - x},${c.y - y}`;
    if (at !== last) { last = at; win.webContents.executeJavaScript(`setPointer(${at})`).catch(() => {}); }
  }, 100);
  win.webContents.once('did-finish-load', startLister);
  app.on('will-quit', () => { lister?.kill(); layerer?.kill(); });
  setInterval(() => { // the taskbar is topmost too and rises above us whenever it's touched; the chat stays above us
    // Windows squeezes the overlay when the work area changes (input panel, Settings): his feet got cut off above the taskbar
    const b = win.getBounds();
    if (Object.keys(full).some((k) => b[k] !== full[k])) win.setBounds(full);
    if (!home) win.moveTop(); // in a terminal he keeps to its layer instead
    if (chat?.isVisible()) chat.moveTop();
  }, 1500);
  win.webContents.on('did-finish-load', () => { if (settings.look) win.webContents.executeJavaScript(`setLook(${JSON.stringify(settings.look)})`); });
  win.webContents.once('did-finish-load', () => setTimeout(greet, 2000));
  win.loadFile('index.html', { query: {
    ground: String(d.workArea.y + d.workArea.height - y), // top edge of the taskbar, in window pixels
    actions: enabled().join(','),
    size: String(settings.size),
    name: settings.name,
    wake: settings.wake || settings.dialog ? '1' : '0',
  } });

  tray = new Tray(path.join(__dirname, 'icon.png'));
  tray.setToolTip(settings.name);
  tray.setContextMenu(menu());
  if (has.opencode) loadModels();
  tray.on('click', () => toggleChat());
  globalShortcut.register(TALK_KEY, talk);
});
app.on('before-quit', () => { quitting = true; stop(); stt?.kill(); });
