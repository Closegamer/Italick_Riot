// Builds the standalone Italic demo: a folder with Italic.exe and the Electron runtime, no npm/Node needed on the target
// machine. It reuses the Electron already in node_modules and the scene code in src/.
//   npm run build:italic   ->   dist/Italic-win32-x64/Italic.exe
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electron = path.join(root, 'node_modules', 'electron', 'dist');
if (!fs.existsSync(electron)) throw new Error('Electron is missing: run "npm install" first.');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const short = version.replace(/\.0$/, '') || version; // 1.0.0 -> 1.0, for names people see

const win = process.platform === 'win32';
const out = path.join(root, 'dist', `Italic-${short}-${process.platform}-${process.arch}`);
const exe = win ? 'Italic.exe' : 'Italic';

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(electron, out, { recursive: true }); // the runtime: electron.exe, dlls, locales, resources/

fs.renameSync(path.join(out, win ? 'electron.exe' : 'electron'), path.join(out, exe));
fs.rmSync(path.join(out, 'resources', 'default_app.asar'), { force: true });
// keep only the UI languages the demo can use: everything else is ~48 MB of unused .pak files
const locales = path.join(out, 'locales');
if (fs.existsSync(locales)) for (const name of fs.readdirSync(locales)) if (!/^(en-US|ru)\.pak$/.test(name)) fs.rmSync(path.join(locales, name));

const appDir = path.join(out, 'resources', 'app');
fs.mkdirSync(appDir, { recursive: true });
for (const item of ['italic-main.js', 'preload.js', 'index.html', 'icon.png', 'src', 'roam']) {
  fs.cpSync(path.join(root, item), path.join(appDir, item), { recursive: true });
}
// index.html loads three.js through an import map: only these three files are actually used (the package is ~20 MB)
const three = path.join(root, 'node_modules', 'three');
for (const file of ['build/three.module.js', 'build/three.core.js', 'examples/jsm/environments/RoomEnvironment.js']) {
  fs.mkdirSync(path.dirname(path.join(appDir, 'node_modules', 'three', file)), { recursive: true });
  fs.cpSync(path.join(three, file), path.join(appDir, 'node_modules', 'three', file));
}

fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify({
  name: 'italic',
  productName: 'Italic',
  version,
  private: true,
  main: 'italic-main.js',
  description: "writtenBy('Closegamer', 2026) · closegamer@mail.ru",
  author: 'Closegamer <closegamer@mail.ru>',
}, null, 2));

console.log(`Italic is ready: ${path.join(out, exe)}`);
