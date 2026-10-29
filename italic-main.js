// Italic: the show-off build. No chat, no AI, no commands. He comes out of his door, carries a flag to the left edge of
// the screen, plants it, and then just lives there: climbs windows by rope and ladder, parachutes down, sits at his desk
// and works on his laptop. Everything visual comes from the same scene code as the full assistant (src/app.js).
// writtenBy('Closegamer', 2026) · closegamer@mail.ru
const { app, BrowserWindow, screen, Tray, Menu, ipcMain, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { spawn } = require('child_process');
const { topEdges } = require('./roam/edges');

app.setName('Italic'); // one identity for the folder build and the single-file build: only one instance may run

const primary = app.requestSingleInstanceLock(); // a second double-click must not spawn a second Italic
if (!primary) app.quit();
else app.on('second-instance', () => { // the user launched it again: bring the running one back to the front
  if (!win || win.isDestroyed()) return;
  win.moveTop();
  run('comeBack()');
});

// Chromium stops painting windows it thinks are covered; our full-screen transparent overlay "covers" everything
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required'); // fight sounds without a click first

const FLAG = {
  brain: ['Italic', ''],
  place: '',
  ok: null,
  caption: 'Hey, Anthropic! Stop blocking Russian accounts!',
  signature: 'Italick, Russian programmer',
};
const SIZE = 130;
const ACTIONS = fs.readdirSync(path.join(__dirname, 'src', 'actions')).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3));
const preload = path.join(__dirname, 'preload.js');

let win, tray, lister = null, quitting = false;
let pointerTimer = null, keepTimer = null, idleTimer = null;
let sleeping = false;
const timers = [];

const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
// the window can already be destroyed while a timer or the lister is still firing: never touch it then
const run = (js) => {
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return Promise.resolve();
  try { return win.webContents.executeJavaScript(js).catch(() => {}); } catch { return Promise.resolve(); }
};

// open windows are the platforms he climbs: their top edges come from main, and the scene turns them into ladders and ropes
function startLister() {
  lister = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'roam', 'windows.ps1'), '-Skip', String(process.pid)], { windowsHide: true });
  lister.on('error', () => {});
  readline.createInterface({ input: lister.stdout }).on('line', (line) => {
    let list;
    try { list = JSON.parse(line); } catch { return; }
    // ponytail: primary display only, and one scale factor for all windows
    const d = screen.getPrimaryDisplay(), f = d.scaleFactor;
    const rects = list.map(([id, l, t, r, b, term]) => ({ id: String(id), l: l / f - d.bounds.x, t: t / f - d.bounds.y, r: r / f - d.bounds.x, b: b / f - d.bounds.y, term }));
    run(`setEdges(${JSON.stringify(topEdges(rects))}); setWindows(${JSON.stringify(rects)})`);
  });
  lister.on('close', () => { if (!quitting) setTimeout(startLister, 3000); }); // keep it alive
}

// the show: roam the screen for a while, then sit down at the desk and type, and round again
// (the times can be shortened for a quick look: ITALIC_START_MS, ITALIC_ROAM_MS, ITALIC_WORK_MS, ITALIC_BATTLE_MS)
const START_MS = Number(process.env.ITALIC_START_MS) || 12000;
const ROAM_MS = Number(process.env.ITALIC_ROAM_MS) || 55000, WORK_MS = Number(process.env.ITALIC_WORK_MS) || 22000;
const BATTLE_MS = Number(process.env.ITALIC_BATTLE_MS) || 45000;
const IDLE_SLEEP_MS = Number(process.env.ITALIC_IDLE_MS) || 5 * 60 * 1000; // no input -> bed
function show() {
  if (quitting) return;
  run('setRoam(true)');
  later(() => {
    run('setRoam(false); setBusy(true)');
    later(() => { run('setBusy(false)'); show(); }, WORK_MS);
  }, ROAM_MS);
}

// every so often a rubber statue of Anthropic pops up, and Italick goes and deals with it
function battles() {
  if (quitting) return;
  later(() => {
    run('battle()');
    battles();
  }, BATTLE_MS);
}

async function goodbye() {
  if (quitting) return app.quit(); // a second Quit doesn't wait
  quitting = true;
  timers.forEach(clearTimeout);
  clearInterval(pointerTimer);
  clearInterval(keepTimer);
  await Promise.race([run('leaveForQuit()'), new Promise((r) => setTimeout(r, 12000))]);
  app.quit();
}

if (primary) app.whenReady().then(() => {
  const d = screen.getPrimaryDisplay();
  const { x, y, width, height } = d.bounds;
  const full = { x, y, width, height: height - 1 }; // height - 1: a full-monitor topmost window counts as fullscreen
  win = new BrowserWindow({
    ...full, transparent: true, frame: false, resizable: false, skipTaskbar: true,
    focusable: false, hasShadow: false, alwaysOnTop: true,
    webPreferences: { preload, backgroundThrottling: false },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.on('closed', () => { win = null; }); // later timers must not touch it
  ipcMain.on('hover', (_e, on) => { if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(!on, { forward: true }); });

  // where the mouse pointer is, so he can glance at it (only sent when it moves)
  let last = '';
  pointerTimer = setInterval(() => {
    if (!win || win.isDestroyed()) return;
    const c = screen.getCursorScreenPoint(), at = `${c.x - x},${c.y - y}`;
    if (at !== last) { last = at; run(`setPointer(${at})`); }
  }, 100);
  // the taskbar is topmost too and rises above us whenever it's touched; and Windows squeezes the overlay now and then
  keepTimer = setInterval(() => {
    if (!win || win.isDestroyed()) return;
    const b = win.getBounds();
    if (Object.keys(full).some((k) => b[k] !== full[k])) win.setBounds(full);
    win.moveTop();
  }, 1500);

  // five minutes without keyboard or mouse: bring a bed and go to sleep; any input wakes him
  idleTimer = setInterval(() => {
    if (quitting || !win || win.isDestroyed()) return;
    const idle = powerMonitor.getSystemIdleTime() * 1000;
    if (!sleeping && idle >= IDLE_SLEEP_MS) {
      win.webContents.executeJavaScript('sleep()').then((ok) => {
        if (!ok || quitting) return;
        sleeping = true;
        timers.forEach(clearTimeout); // pause the show and the battles
        timers.length = 0;
      }).catch(() => {});
    } else if (sleeping && idle < IDLE_SLEEP_MS) {
      sleeping = false;
      run('wakeUp()');
      show(); // resume the demo
      battles();
    }
  }, 2000);

  win.webContents.once('did-finish-load', startLister);
  win.webContents.once('did-finish-load', () => {
    later(() => run(`setFlag(${JSON.stringify(FLAG)})`), 900); // flagTodo: after the door, he carries it to the left edge
    later(show, START_MS); // once the flag is planted
    later(() => { run('battle()'); battles(); }, START_MS + 7000); // first statue, then every ITALIC_BATTLE_MS
    if (process.env.ITALIC_QUIT_MS) later(goodbye, Number(process.env.ITALIC_QUIT_MS)); // testing a clean quit
  });
  win.loadFile('index.html', { query: {
    ground: String(d.workArea.y + d.workArea.height - y),
    actions: process.env.ITALIC_ACTIONS || ACTIONS.join(','), // ITALIC_ACTIONS=idle keeps him still (testing)
    size: String(SIZE),
    name: 'Italic',
    home: '0', // he never moves into a terminal window
  } });

  tray = new Tray(path.join(__dirname, 'icon.png'));
  const version = app.getVersion().replace(/\.0$/, '');
  tray.setToolTip(`Italic ${version}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `Italic ${version} — from Russia with code`, enabled: false },
    { type: 'separator' },
    { label: 'Quit', click: goodbye },
  ]));

  app.on('will-quit', () => {
    quitting = true;
    lister?.kill();
    clearInterval(pointerTimer);
    clearInterval(keepTimer);
    clearInterval(idleTimer);
    timers.forEach(clearTimeout);
  });
  app.on('window-all-closed', () => app.quit()); // never stay alive with no overlay
});
