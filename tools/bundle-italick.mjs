// Bundles the Italick folder build into ONE self-extracting exe: dist/Italick.exe
//   node tools/bundle-italick.mjs        (npm run bundle:italick)
// The stub (tools/launcher.cs) carries the ZIP, unpacks it once to %LOCALAPPDATA%\Italick, then starts it.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const short = version.replace(/\.0$/, '') || version;
const appDir = path.join(dist, `Italick-${short}-${process.platform}-${process.arch}`);
const out = path.join(dist, `Italick-${short}.exe`);

const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${cmd} failed with exit code ${r.status}`);
};

if (process.platform !== 'win32') throw new Error('The single-file bundle is built on Windows only.');

console.log('1/4  building the app folder…');
run(process.execPath, [path.join(root, 'tools', 'build-italick.mjs')]);

console.log('2/4  compressing…');
const zip = path.join(dist, 'italick-payload.zip');
fs.rmSync(zip, { force: true });
const quote = (s) => `'${s.replace(/'/g, "''")}'`;
run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
  `Add-Type -AssemblyName System.IO.Compression.FileSystem; ` +
  `[System.IO.Compression.ZipFile]::CreateFromDirectory(${quote(appDir)}, ${quote(zip)}, ` +
  `[System.IO.Compression.CompressionLevel]::Optimal, $false)`]);

const hash = await new Promise((resolve, reject) => {
  const h = crypto.createHash('sha256');
  fs.createReadStream(zip).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
});

console.log('3/4  compiling the launcher…');
const csc = path.join(process.env.SystemRoot || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
const cs = path.join(dist, 'launcher.build.cs');
const stub = path.join(dist, 'launcher.exe');
const trailer = path.join(dist, 'italick-payload.trailer');
fs.writeFileSync(cs, fs.readFileSync(path.join(root, 'tools', 'launcher.cs'), 'utf8')
  .replace('__BUILD_ID__', hash.slice(0, 16))
  .replaceAll('__VERSION__', version.split('.').concat(['0', '0', '0']).slice(0, 4).join('.')));
run(csc, [
  '/nologo', '/target:winexe', '/platform:x64', `/out:${stub}`, `/win32icon:${path.join(root, 'icon.ico')}`,
  '/r:System.IO.Compression.dll', '/r:System.IO.Compression.FileSystem.dll', '/r:System.Windows.Forms.dll', cs,
]);

console.log('4/4  joining…');
const tail = Buffer.alloc(8);
tail.writeBigInt64LE(BigInt(fs.statSync(zip).size));
fs.writeFileSync(trailer, tail);
fs.rmSync(out, { force: true });
const dest = fs.openSync(out, 'w');
try {
  for (const file of [stub, zip, trailer]) { // launcher, then the payload, then its length
    const src = fs.openSync(file, 'r'), buffer = Buffer.alloc(4 * 1048576);
    let n;
    while ((n = fs.readSync(src, buffer, 0, buffer.length, null)) > 0) fs.writeSync(dest, buffer, 0, n);
    fs.closeSync(src);
  }
} finally {
  fs.closeSync(dest);
}
if (!fs.existsSync(out)) throw new Error('the single-file exe was not written');
for (const f of [zip, cs, stub, trailer]) fs.rmSync(f, { force: true });

console.log(`Single-file Italick: ${out} (${(fs.statSync(out).size / 1048576).toFixed(0)} MB)`);