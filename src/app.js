import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createGeek } from './geek.js';

// Behaviour = action modules in ./actions: { name, weight, start(k, ctx), update(k, dt, ctx) -> true when done, stop(k) },
// picked at random by weight (the tray menu enables/disables them). The app itself handles being dragged and thrown,
// and "working" (sitting with the laptop) while Claude is busy.
const q = new URLSearchParams(location.search);
const load = (names) => Promise.all(names.filter(Boolean).map((n) => import(`./actions/${n}.js`).then((m) => m.default)));
let ACTIONS = await load((q.get('actions') ?? 'walk,idle,sit').split(','));

const W = innerWidth, H = innerHeight;
// scene is in pixels with y up; ground = top edge of the taskbar
const ctx = { W, H, SIZE: Number(q.get('size') || 130), ground: H - Number(q.get('ground') ?? H), busy: false };

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(W, H);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.6;
const camera = new THREE.OrthographicCamera(0, W, H, 0, 1, 4000);
camera.position.z = 2000;

const KEY_DIR = new THREE.Vector3(700, 1000, 2000);
const key = new THREE.DirectionalLight(0xfff0d8, 2.2);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0005;
const rim = new THREE.DirectionalLight(0x9cc4ff, 1.6);
rim.position.set(-900, 700, -1500);
scene.add(key, rim, new THREE.HemisphereLight(0xfff4e0, 0x35284a, 1.1));

const k = createGeek();
k.root.position.set(W * 0.3, ctx.ground, 0);
scene.add(k.root);
key.target = k.root;

function setSize(px) {
  ctx.SIZE = px;
  k.root.scale.setScalar(px);
  const c = key.shadow.camera, s = px * 1.5; // shadow box hugs him
  Object.assign(c, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 5000 });
  c.updateProjectionMatrix();
  key.shadow.normalBias = 0.01 * px;
}
setSize(ctx.SIZE);

let action = null, mode = 'act', t = 0; // mode: act (actions / working) | held (dragged) | fall
function next() {
  action?.stop(k, ctx);
  action = null;
  if (ctx.busy || !ACTIONS.length) return; // working, or nothing enabled: the loop handles it
  let r = Math.random() * ACTIONS.reduce((sum, a) => sum + (a.weight ?? 1), 0);
  action = ACTIONS.find((a) => (r -= a.weight ?? 1) < 0) ?? ACTIONS[0];
  action.start(k, ctx);
}
next();

// called from the main process
window.setActions = async (names) => { ACTIONS = await load(names); next(); };
window.setAvatarSize = setSize;
window.setBusy = (on) => { ctx.busy = on; next(); };

// --- mouse: hovering makes the window catch the mouse; drag to carry him, release to drop or throw, click for chat
const box = new THREE.Box3();
function rect() {
  box.setFromObject(k.root);
  return { left: box.min.x, right: box.max.x, top: H - box.max.y, bottom: H - box.min.y };
}
let over = false, drag = null, vel = { x: 0, y: 0 };
function hover(on) {
  if (on === over) return;
  over = on;
  document.body.style.cursor = on ? 'grab' : '';
  bridge.send('hover', on);
}
addEventListener('mousemove', (e) => {
  if (!drag) {
    const r = rect();
    return hover(e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
  }
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5) {
    drag.moved = true;
    mode = 'held';
    action?.stop(k, ctx);
    action = null;
  }
  if (!drag.moved) return;
  const p = k.root.position, x = e.clientX - drag.dx, y = H - e.clientY - drag.dy;
  const sec = Math.max(0.005, (e.timeStamp - drag.at) / 1000);
  vel = { x: (x - p.x) / sec, y: (y - p.y) / sec };
  drag.at = e.timeStamp;
  p.set(x, y, 0);
});
addEventListener('mousedown', (e) => {
  if (!over || e.button !== 0) return;
  const p = k.root.position;
  drag = { dx: e.clientX - p.x, dy: H - e.clientY - p.y, sx: e.clientX, sy: e.clientY, at: e.timeStamp, moved: false };
  vel = { x: 0, y: 0 };
  document.body.style.cursor = 'grabbing';
});
addEventListener('mouseup', () => {
  if (!drag) return;
  if (drag.moved) {
    mode = 'fall';
    const cap = 2500; // px/s, so a flick doesn't launch him off the screen
    vel = { x: Math.max(-cap, Math.min(cap, vel.x)), y: Math.max(-cap, Math.min(cap, vel.y)) };
  } else {
    bridge.send('toggle-chat', rect());
  }
  drag = null;
  document.body.style.cursor = over ? 'grab' : '';
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;
  const p = k.root.position;
  if (mode === 'held') {
    k.face(0);
    k.look(0, -0.15);
    k.held(t, dt);
  } else if (mode === 'fall') {
    vel.y -= 2600 * dt; // gravity, px/sВІ
    p.x += vel.x * dt;
    p.y += vel.y * dt;
    const margin = 0.3 * ctx.SIZE;
    if (p.x < margin || p.x > W - margin) {
      p.x = Math.max(margin, Math.min(W - margin, p.x));
      vel.x *= -0.4; // bounce off the screen edge
    }
    k.held(t, dt);
    if (p.y <= ctx.ground) {
      p.y = ctx.ground;
      mode = 'act';
      next();
    }
  } else if (ctx.busy) { // Claude is working: desk and chair appear, he sits down and types
    p.y = ctx.ground;
    k.face(0);
    k.look(0, 0.3);
    k.breathe(Math.sin(t * 1.4));
    k.work(t, dt);
  } else if (action) {
    if (action.update(k, dt, ctx)) next();
  } else {
    k.stand(t, dt);
  }
  key.position.copy(p).add(KEY_DIR); // light follows him
  renderer.render(scene, camera);
});
