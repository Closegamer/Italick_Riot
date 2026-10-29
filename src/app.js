import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createGeek } from './geek.js';
import { createDoor } from './door.js';
import { createFlag, GRIP } from './flag.js';
import { createBed } from './bed.js';
import { createCop } from './police.js';
import { createPassport } from './passport.js';
import { createRoam } from './roam.js';
import { createHelicopter, createFoodPack, createBucket, createBurger, createDrink, createRubbish } from './food.js';
import * as sfx from './sfx.js';

// Behaviour = action modules in ./actions: { name, weight, start(k, ctx), update(k, dt, ctx) -> true when done, stop(k) },
// picked at random by weight (the tray menu enables/disables them). The app itself handles being dragged and thrown,
// and "working" (sitting with the laptop) while the AI is busy.
const q = new URLSearchParams(location.search);
const load = (names) => Promise.all(names.filter(Boolean).map((n) => import(`./actions/${n}.js`).then((m) => m.default)));
let ACTIONS = await load((q.get('actions') ?? 'walk,idle,sit').split(','));

let W = innerWidth; const H = innerHeight; // H: the camera's top edge, fixed (see resize)
// scene is in pixels with y up; ground = top edge of the taskbar
// ground: the floor he stands on (the taskbar top); x1..x2: where he may walk
const ctx = { W, H, SIZE: Number(q.get('size') || 130), ground: H - Number(q.get('ground') ?? H), x1: 0, x2: W, busy: false };
const TASKBAR = ctx.ground;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(W, H);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // r186 removed PCFSoftShadowMap
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
k.root.visible = false; // until he walks out of his door

// Windows can squeeze the overlay (e.g. when a toolbar docks) and main then restores it. The window's top
// stays put, so the scene keeps its coordinates (H = the height at load, scene y = H - window y) and only the camera's
// bottom edge follows the new height: him, his door, desk and ropes all stay where they were placed.
addEventListener('resize', () => {
  W = ctx.W = innerWidth;
  renderer.setSize(W, innerHeight);
  Object.assign(camera, { right: W, bottom: H - innerHeight });
  camera.updateProjectionMatrix();
});
scene.add(k.root);
key.target = k.root;

// soft contact shadow on the taskbar: a dark ellipse that stays on the ground and fades as he leaves it
const shadowCanvas = document.createElement('canvas');
shadowCanvas.width = shadowCanvas.height = 256;
{
  const g = shadowCanvas.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 8, 128, 128, 128);
  grd.addColorStop(0, 'rgba(0,0,0,0.75)');
  grd.addColorStop(0.5, 'rgba(0,0,0,0.38)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
}
const shadowTex = new THREE.CanvasTexture(shadowCanvas);
shadowTex.colorSpace = THREE.SRGBColorSpace;
const contact = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.6, toneMapped: false }),
);
contact.renderOrder = -1;
contact.position.z = -2;
scene.add(contact);

const door = createDoor();
const flag = createFlag();
const bed = createBed();
const copA = createCop(0), copB = createCop(1);
const passport = createPassport();
const heli = createHelicopter();
const foodPack = createFoodPack();
const bucket = createBucket();
const burger = createBurger();
const drink = createDrink();
const rubbish = createRubbish();
burger.visible = drink.visible = rubbish.visible = false;
scene.add(door.root, flag.root, bed.root, copA.root, copB.root, passport.root, heli.root, foodPack.root, bucket.root, burger, drink, rubbish);

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
let approach = null, approachPhase = 0, farFor = 0; // walking over to the mouse pointer: target x; how long it's been far away
function next() {
  action?.stop(k, ctx);
  action = null;
  approach = null;
  if (ctx.busy || gone || !ACTIONS.length) return; // working, or nothing enabled: the loop handles it
  let r = Math.random() * ACTIONS.reduce((sum, a) => sum + (a.weight ?? 1), 0);
  action = ACTIONS.find((a) => (r -= a.weight ?? 1) < 0) ?? ACTIONS[0];
  action.start(k, ctx);
}

// scripted scenes (leaving through a door, coming back) are generators: each frame resumes them with dt
let script = null, gone = true, roamScript = null, battleQueued = false, policeQueued = false, foodQueued = false; // he starts behind his door and comes out of it
const run = (scene) => { action?.stop(k, ctx); action = null; approach = null; script = scene; script.next(); };
function* during(sec, each) {
  for (let s = 0; s < sec;) { const dt = yield; s += dt; each(Math.min(1, s / sec), dt); }
}
const ease = (a) => a * a * (3 - 2 * a);
const pop = (a) => 1 + 2.7 * (a - 1) ** 3 + 1.7 * (a - 1) ** 2; // overshoots a little, like popping into existence
const STEP = 0.5, SPEED = 0.65, DEPTH = 1.4; // units, units/s (as in the walk action); how far in he walks
// beyond the door plane: smaller and a bit higher, faking perspective for the orthographic camera
function inside(a) {
  const p = k.root.position;
  p.z = -a * DEPTH * ctx.SIZE;
  p.y = ctx.ground + 0.12 * ctx.SIZE * a;
  k.root.scale.setScalar(ctx.SIZE * (1 - 0.3 * a));
}

// "go rest": five steps, a door appears, he turns, opens it, walks in, it shuts and vanishes
function* leaving() {
  const p = k.root.position, S = ctx.SIZE, x0 = p.x, dir = p.x < (ctx.x1 + ctx.x2) / 2 ? 1 : -1;
  yield* during(5 * STEP / SPEED, (a, dt) => {
    p.x = x0 + dir * a * 5 * STEP * S;
    k.face(dir);
    k.look(0, 0);
    k.walk(a * 5 * Math.PI, dt);
  });
  door.place(p.x, ctx.ground, -0.3 * S, S);
  yield* during(0.6, (a, dt) => { door.set(pop(a), 0); k.face(0); k.look(-dir * 0.3, 0); k.stand(t, dt); });
  yield* during(0.5, (a, dt) => { k.turn(dir * Math.PI); k.stand(t, dt); });
  sfx.doorOpen();
  yield* during(0.7, (a, dt) => { door.set(1, ease(a)); k.stand(t, dt); });
  yield* during(DEPTH / SPEED, (a, dt) => { inside(a); k.walk(a * (DEPTH / STEP) * Math.PI, dt); });
  sfx.doorClose();
  yield* during(0.7, (a, dt) => { door.set(1, 1 - ease(a)); k.stand(t, dt); });
  k.root.visible = false;
  yield* during(0.4, (a) => door.set(1 - ease(a), 0));
  gone = true;
}

// the same door appears where he left, he walks out of it and it vanishes behind him
function* returning() {
  gone = false;
  const p = k.root.position;
  door.place(p.x, ctx.ground, -0.3 * ctx.SIZE, ctx.SIZE);
  inside(1);
  k.turn(0);
  k.root.visible = true;
  yield* during(0.6, (a, dt) => { door.set(pop(a), 0); k.stand(t, dt); });
  sfx.doorOpen();
  yield* during(0.7, (a, dt) => { door.set(1, ease(a)); k.stand(t, dt); });
  yield* during(DEPTH / SPEED, (a, dt) => { inside(1 - a); k.walk(a * (DEPTH / STEP) * Math.PI, dt); });
  inside(0);
  sfx.doorClose();
  yield* during(0.7, (a, dt) => { door.set(1, 1 - ease(a)); k.look(0, 0); k.stand(t, dt); });
  yield* during(0.4, (a, dt) => { door.set(1 - ease(a), 0); k.stand(t, dt); });
}

// his flag at the left edge of the screen: which AI is his brain and where he is online (main sends setFlag)
const FLAG_X = 40;
let flagInfo = null, flagTodo = false, flagUp = false; // the latest info; a new brain waiting for him; planted
window.setFlag = (info) => {
  const sameBrain = flagInfo?.brain.join('/') === info.brain.join('/');
  flagInfo = info;
  if (flagUp && sameBrain) flag.draw(info); // the same brain: just repaint it where it stands
  else flagTodo = true;
};
// pace: 1 = his stroll; flag errands hurry (same steps, quicker), the leisurely walk is for wandering about
const HURRY = 2.5;
function* walkTo(x, each = () => {}, pace = HURRY) {
  const p = k.root.position, x0 = p.x, d = x - x0, steps = Math.abs(d) / (STEP * ctx.SIZE);
  yield* during(Math.max(0.05, Math.abs(d) / (pace * SPEED * ctx.SIZE)), (a, dt) => {
    p.x = x0 + d * a;
    k.face(Math.sign(d) || -1);
    k.look(0, 0);
    k.walk(a * steps * Math.PI, dt);
    each();
  });
}
const hand = new THREE.Vector3();
function* flagScene() {
  flagTodo = false;
  const S = ctx.SIZE;
  if (flagUp) { // a new brain: he walks over and repaints it
    yield* walkTo(FLAG_X + flag.width + 0.4 * S); // beside the cloth, not in front of it
    yield* during(0.3, (a, dt) => { k.face(-1); k.look(-0.4, 0.1); flag.furl(1 - ease(a)); k.stand(t, dt); });
    flag.draw(flagInfo);
    sfx.cloth();
    yield* during(0.4, (a, dt) => { flag.furl(ease(a)); k.stand(t, dt); });
    yield* during(0.3, (a, dt) => { k.face(0); k.look(0, 0); k.stand(t, dt); });
    return;
  }
  // the first time: the flag pops into his left hand (the one in front when he walks left), he carries it to the left
  // edge and plants it there
  flag.draw(flagInfo);
  const carry = () => {
    k.hand('L', hand);
    flag.place(hand.x, Math.max(ctx.ground + 4, hand.y - GRIP), -0.4 * S); // just behind him, so the cloth trailing behind doesn't hide him
  };
  k.hold({ aL: -0.45, eL: -1.1, oL: 0.15 });
  sfx.cloth();
  yield* during(0.3, (a, dt) => { k.face(0); k.stand(t, dt); carry(); flag.set(pop(a)); });
  yield* walkTo(FLAG_X + 0.45 * S, carry);
  const { x: x0, y: y0 } = flag.root.position; // into the ground, a little behind him
  sfx.flagPlant();
  yield* during(0.3, (a, dt) => { k.face(-1); k.stand(t, dt); flag.place(x0 + (FLAG_X - x0) * ease(a), y0 + (TASKBAR - 10 - y0) * ease(a), -0.3 * S); });
  k.hold(null);
  flagUp = true;
  yield* walkTo(FLAG_X + flag.width + 0.4 * S); // out from in front of it
  yield* during(0.3, (a, dt) => { k.face(0); k.look(0, 0); k.stand(t, dt); });
  flag.draw(flagInfo); // news that came while he carried it
  flagTodo = false;
}

// screensaver: while the user is away he roams the whole screen (see roam.js); main switches it on and off
const roamer = createRoam({ k, ctx, scene, during, ease, time: () => t });
window.setRoam = (on) => { ctx.roam = on; };
// a statue battle, started by the Italick app's timer. Roaming is allowed to finish (it packs the ladder/rope away)
// before the fight starts; door/flag/leaving scenes are not interrupted.
window.battle = () => {
  if (gone) return false;
  if (script && script !== roamScript) return false;
  if (script && script === roamScript) { ctx.roam = false; battleQueued = true; return true; }
  battleQueued = false;
  run(roamer.battle());
  return true;
};

// two policemen stop Italick near the flag: he shows his passport, they read it, point at the flag and leave laughing
window.police = () => {
  if (gone || ctx.busy || bye) return false;
  if (script && script !== roamScript) return false;
  if (script && script === roamScript) { ctx.roam = false; policeQueued = true; return true; }
  policeQueued = false;
  run(policeScene());
  return true;
};

// quitting: he finishes what he's doing (comes down from the windows), then leaves through the door; resolves once he's gone
let bye = null;
window.leaveForQuit = () => new Promise((resolve) => { bye = resolve; ctx.roam = false; });
window.setEdges = roamer.setEdges;

// ---------- sleep: after five minutes without user input a bed appears and he goes to sleep in it ----------
let wakeRequested = false;
function* sleepScene() {
  wakeRequested = false;
  ctx.roam = false;
  ctx.busy = false;
  roamer.cancel(); // put away a ladder, rope or ninja suit left by a roam
  const S = ctx.SIZE, p = k.root.position;
  p.y = ctx.ground;
  p.x = Math.max(ctx.x1 + S, Math.min(ctx.x2 - S, p.x));
  const dir = p.x < W / 2 ? 1 : -1; // the bed goes on the roomier side of him
  const bx = Math.max(1.35 * S, Math.min(W - 1.35 * S, p.x + dir * 1.1 * S));
  bed.place(bx, ctx.ground, 0, S, dir);
  bed.set(0.001);
  sfx.cloth();
  yield* during(0.5, (a, dt) => { bed.set(pop(a)); k.face(dir); k.look(0, 0); k.stand(t, dt); });

  const near = bx - dir * (bed.length / 2 - 0.15) * S; // he stands by the foot of the bed
  yield* walkTo(near, () => {}, 1.5);

  const lieX = bx - dir * 0.72 * S, lieY = ctx.ground + (bed.top + 0.16) * S;
  const rest = { tL: 0.03, tR: 0.03, kL: 0.05, kR: 0.05, aL: 0.12, eL: -0.5, aR: 0.12, eR: -0.5, lean: 0, twist: 0 };
  yield* during(0.9, (a, dt) => {
    const e = ease(a);
    p.x = near + (lieX - near) * e;
    p.y = ctx.ground + (lieY - ctx.ground) * e;
    k.root.rotation.z = -dir * (Math.PI / 2) * e; // lying down, head towards the pillow
    k.face(0); // on his back, face to the viewer
    k.pose(rest, dt);
    k.breathe(Math.sin(t * 1.1));
  });

  sfx.snore();
  let nextSnore = t + 3.5 + Math.random() * 2;
  while (!wakeRequested && !bye) {
    const dt = yield;
    k.face(0);
    k.pose(rest, dt);
    k.breathe(Math.sin(t * 1.1));
    bed.animate(t);
    if (t > nextSnore) { sfx.snore(); nextSnore = t + 3.5 + Math.random() * 2; }
  }

  // the user is back: stand up and let the bed vanish
  sfx.cloth();
  yield* during(0.8, (a, dt) => {
    const e = ease(a);
    k.root.rotation.z = -dir * (Math.PI / 2) * (1 - e);
    p.y = lieY + (ctx.ground - lieY) * e;
    k.face(0);
    k.pose({ tL: 0, tR: 0, kL: 0, kR: 0, aL: 0, eL: -0.15, aR: 0, eR: -0.15 }, dt);
    k.stand(t, dt);
    bed.set(1 - e);
  });
  k.root.rotation.z = 0;
  p.y = ctx.ground;
  bed.hide();
  wakeRequested = false;
}

window.sleep = () => {
  if (gone || bye || (script && script !== roamScript)) return false;
  run(sleepScene());
  return true;
};
window.wakeUp = () => { wakeRequested = true; };

// ---------- police: two officers walk in from the right, stop by the flag, check Italick's passport and leave laughing ----------
function* policeScene() {
  if (bye) return;
  ctx.roam = false;
  ctx.busy = false;
  const S = ctx.SIZE, p = k.root.position;
  p.y = ctx.ground;
  const stopA = FLAG_X + flag.width + 0.7 * S;
  const stopB = stopA + 0.74 * S;
  const meetX = Math.min(W - 1.2 * S, stopB + 1.3 * S);
  copA.place(W + 0.7 * S, ctx.ground, 0.9 * S, -1);
  copB.place(W + 1.6 * S, ctx.ground, 0.86 * S, -1);

  let phA = 0, phB = 0, phI = 0, nextStep = 0;
  while ((copA.x() > stopA || copB.x() > stopB || Math.abs(p.x - meetX) > 2) && !bye) {
    const dt = yield;
    if (copA.x() > stopA) {
      const d = Math.min(1.0 * S * dt, copA.x() - stopA);
      copA.root.position.x -= d;
      phA += (d / (0.35 * S)) * Math.PI;
      copA.walk(phA, dt);
    } else copA.stand(t, dt);
    if (copB.x() > stopB) {
      const d = Math.min(1.0 * S * dt, copB.x() - stopB);
      copB.root.position.x -= d;
      phB += (d / (0.35 * S)) * Math.PI;
      copB.walk(phB, dt);
    } else copB.stand(t, dt);
    if (Math.abs(p.x - meetX) > 2) {
      const d = Math.min(1.6 * SPEED * S * dt, Math.abs(meetX - p.x));
      p.x += Math.sign(meetX - p.x) * d;
      phI += (d / (STEP * S)) * Math.PI;
      k.face(Math.sign(meetX - p.x));
      k.look(0, 0);
      k.walk(phI, dt);
    } else {
      k.face(-1);
      k.stand(t, dt);
    }
    if (t > nextStep) { sfx.step(); nextStep = t + 0.38; }
  }
  if (bye) { copA.hide(); copB.hide(); return; }

  copA.face(1);
  copB.face(1);
  k.face(-1);
  yield* during(0.6, (a, dt) => { copA.stand(t, dt); copB.stand(t, dt); k.stand(t, dt); });

  const hand = new THREE.Vector3();
  const holdPassport = (dt) => {
    k.pose({ aR: -1.45, eR: -0.4, oR: 0.15, aL: 0.08, eL: -0.2 }, dt);
    k.hand('R', hand);
    passport.set(hand.x + 0.02 * S, hand.y + 0.05 * S, hand.z + 0.22 * S, S * 1.1, -0.08);
  };
  sfx.cloth();
  passport.show();
  yield* during(0.7, (a, dt) => { holdPassport(dt); copA.stand(t, dt); copB.stand(t, dt); });

  sfx.mumble();
  let said = false;
  yield* during(2.2, (a, dt) => {
    holdPassport(dt);
    copA.read(t, dt);
    copB.read(t + 0.3, dt);
    if (a > 0.55 && !said) { sfx.mumble(); said = true; }
  });

  // they walk up to the flag, point at it with both hands and discuss it
  copA.face(-1);
  copB.face(-1);
  const flagStopA = FLAG_X + flag.width + 0.15 * S;
  const flagStopB = flagStopA + 0.74 * S;
  const startAx = copA.x(), startBx = copB.x();
  phA = phB = 0;
  yield* during(1.5, (a, dt) => {
    const e = ease(a);
    copA.root.position.x = startAx + (flagStopA - startAx) * e;
    copB.root.position.x = startBx + (flagStopB - startBx) * e;
    phA += (1.2 * S * dt / (0.35 * S)) * Math.PI;
    copA.walk(phA, dt);
    copB.walk(phA, dt);
    holdPassport(dt);
  });
  sfx.mumble();
  yield* during(4.0, (a, dt) => {
    holdPassport(dt);
    copA.point(dt);
    copB.point(dt); // both hands towards the flag
  });

  // they turn to each other and talk it over
  copA.face(1);
  copB.face(-1);
  yield* during(0.7, (a, dt) => {
    holdPassport(dt);
    copA.stand(t, dt);
    copB.stand(t, dt);
  });
  sfx.mumble();
  let nextTalk = t + 1.2;
  yield* during(2.6, (a, dt) => {
    holdPassport(dt);
    copA.talk(t, dt);
    copB.talk(t + 0.4, dt);
    if (t > nextTalk) { sfx.mumble(); nextTalk = t + 1.2; }
  });

  // a good laugh together, then they leave
  sfx.laugh();
  yield* during(1.0, (a, dt) => {
    holdPassport(dt);
    copA.laugh(t, dt);
    copB.laugh(t + 0.3, dt);
  });

  passport.hide();
  yield* during(0.4, (a, dt) => {
    k.pose({ aR: 0, eR: -0.15, aL: 0, eL: -0.15 }, dt);
    copA.stand(t, dt);
    copB.stand(t, dt);
  });

  // they walk away to the left, laughing
  copA.face(-1);
  copB.face(-1);
  sfx.laugh();
  let nextLaugh = t + 1.6;
  phA = phB = 0;
  while (copA.x() > -2 * S && !bye) {
    const dt = yield;
    const d = 1.2 * S * dt;
    copA.root.position.x -= d;
    copB.root.position.x -= d;
    phA += (d / (0.35 * S)) * Math.PI;
    copA.walk(phA, dt);
    copB.walk(phA + 0.5, dt);
    copA.laugh(t, dt);
    copB.laugh(t + 0.6, dt);
    k.face(-1);
    k.stand(t, dt);
    if (t > nextLaugh) { sfx.laugh(); nextLaugh = t + 1.6; }
  }
  copA.hide();
  copB.hide();
  p.y = ctx.ground;
}

// ---------- food delivery: a helicopter drops a burger and a drink; he eats, drinks and bins the rubbish ----------
function* foodScene() {
  if (bye) return;
  ctx.roam = false;
  ctx.busy = false;
  roamer.cancel();
  const S = ctx.SIZE, p = k.root.position;
  p.y = ctx.ground;
  p.x = Math.max(1.1 * S, Math.min(W - 1.1 * S, p.x));
  const side = p.x < W / 2 ? 1 : -1;
  const dropX = Math.max(1.4 * S, Math.min(W - 1.4 * S, p.x + side * 1.2 * S));
  const bucketX = Math.max(0.9 * S, Math.min(W - 0.9 * S, dropX + side * 1.5 * S));
  const hand = new THREE.Vector3();

  // helicopter flies in from the right and hovers over the drop point
  heli.place(W + 1.8 * S, ctx.ground + 2.4 * S, -0.5 * S, S, -1);
  heli.set(0.001);
  sfx.heli();
  const startX = W + 1.8 * S;
  yield* during(1.8, (a, dt) => {
    const e = ease(a);
    heli.root.position.x = startX + (dropX - startX) * e;
    heli.root.position.y = ctx.ground + 2.4 * S + 0.12 * S * Math.sin(a * Math.PI * 3);
    heli.animate(t);
    heli.set(Math.min(1, a * 5));
  });

  // the pack drops under a parachute
  foodPack.place(dropX, ctx.ground + 1.55 * S, -0.2 * S, S);
  foodPack.set(0.001);
  yield* during(0.35, (a, dt) => { foodPack.set(pop(a)); heli.animate(t); });
  sfx.whoosh();
  const dropY = ctx.ground + 1.55 * S;
  yield* during(1.6, (a, dt) => {
    foodPack.root.position.y = dropY + (ctx.ground - dropY) * a * a;
    foodPack.root.position.x = dropX + 0.08 * S * Math.sin(a * Math.PI * 2);
    foodPack.animate(t);
    heli.animate(t);
  });
  sfx.thump();
  foodPack.collapseChute();
  yield* during(0.4, (a, dt) => { foodPack.root.position.y = ctx.ground; heli.animate(t); });

  // the helicopter leaves
  const leaveX = heli.root.position.x;
  yield* during(1.2, (a, dt) => {
    heli.root.position.x = leaveX + (W + 2 * S - leaveX) * ease(a);
    heli.root.position.y = ctx.ground + 2.4 * S + 0.6 * S * a;
    heli.animate(t);
  });
  heli.hide();

  // walk to the pack and open it
  yield* walkTo(dropX - side * 0.55 * S, () => {}, 1.5);
  k.face(side);
  k.look(0, -0.15);
  yield* during(0.35, (a, dt) => { k.stand(t, dt); foodPack.animate(t); });
  foodPack.open();
  sfx.cloth();
  yield* during(0.45, (a, dt) => { k.stand(t, dt); });

  // burger: three bites
  burger.visible = true;
  burger.scale.setScalar(S * 0.85);
  k.face(0);
  k.look(0, -0.1);
  const holdBurger = (dt) => {
    k.eat(t, dt);
    k.hand('R', hand);
    burger.position.set(hand.x + 0.02 * S, hand.y + 0.04 * S, hand.z + 0.1 * S);
    burger.rotation.set(0.2, 0, 0.2);
  };
  yield* during(0.5, (a, dt) => holdBurger(dt));
  for (let bite = 0; bite < 3; bite++) {
    yield* during(0.45, (a, dt) => holdBurger(dt));
    sfx.chomp();
    yield* during(0.25, (a, dt) => holdBurger(dt));
  }
  burger.visible = false;
  k.talk(null);
  sfx.gulp();

  // drink
  drink.visible = true;
  drink.scale.setScalar(S * 0.95);
  const holdDrink = (dt) => {
    k.drink(t, dt);
    k.hand('L', hand);
    drink.position.set(hand.x + 0.01 * S, hand.y + 0.03 * S, hand.z + 0.1 * S);
    drink.rotation.set(-0.35, 0, 0.2);
  };
  yield* during(1.8, (a, dt) => holdDrink(dt));
  sfx.gulp();
  drink.visible = false;
  k.talk(null);
  k.face(0);
  yield* during(0.3, (a, dt) => { k.stand(t, dt); });

  // the bin appears; he carries the wrapper over and throws it in
  bucket.place(bucketX, ctx.ground, 0, S);
  bucket.set(0.001);
  sfx.cloth();
  yield* during(0.4, (a, dt) => { k.stand(t, dt); bucket.set(pop(a)); });

  rubbish.visible = true;
  rubbish.scale.setScalar(S * 0.9);
  yield* walkTo(bucketX - side * 0.55 * S, (dt) => {
    k.hand('R', hand);
    rubbish.position.set(hand.x + 0.03 * S, hand.y + 0.05 * S, hand.z + 0.08 * S);
  }, 1.5);
  k.face(side);
  k.look(0, 0.1);
  yield* during(0.35, (a, dt) => {
    k.pose({ aR: -2.2, eR: -0.6, oR: 0.2, aL: 0.1, eL: -0.3, lean: -0.1, twist: -0.2 }, dt);
    k.hand('R', hand);
    rubbish.position.set(hand.x + 0.03 * S, hand.y + 0.05 * S, hand.z + 0.08 * S);
  });

  const from = new THREE.Vector3();
  k.hand('R', from);
  const to = new THREE.Vector3(bucketX, ctx.ground + 0.62 * S, 0);
  sfx.whoosh();
  yield* during(0.5, (a, dt) => {
    k.pose({ aR: -0.35, eR: -0.2, oR: 0.05, aL: 0.2, eL: -0.4, lean: 0.2, twist: 0.25 }, dt);
    rubbish.position.lerpVectors(from, to, a);
    rubbish.position.y += Math.sin(a * Math.PI) * 0.45 * S;
    rubbish.rotation.x += dt * 8;
  });
  rubbish.visible = false;
  bucket.open(true);
  sfx.thump();
  yield* during(0.35, (a, dt) => { k.stand(t, dt); bucket.open(true); });
  bucket.open(false);

  yield* during(0.5, (a, dt) => { k.stand(t, dt); bucket.set(1 - ease(a)); });
  bucket.hide();
  foodPack.hide();
  k.talk(null);
  k.face(0);
  p.y = ctx.ground;
  sfx.beep(); // delivery finished
}

window.foodDelivery = () => {
  if (gone || ctx.busy || bye) return false;
  if (script && script !== roamScript) return false;
  if (script && script === roamScript) { ctx.roam = false; foodQueued = true; return true; }
  foodQueued = false;
  run(foodScene());
  return true;
};

window.setLook = k.setLook;

next();

// called from the main process
window.leave = () => { if (!gone && !script && mode === 'act') run(leaving()); };
window.comeBack = () => { if (gone) run(returning()); };
window.comeBack(); // his entrance when the app starts
window.setActions = async (names) => { ACTIONS = await load(names); next(); };
window.setAvatarSize = setSize;
window.setBusy = (on) => { ctx.busy = on; if (on) window.comeBack(); next(); }; // a task calls him back to work

// name tag above his head while the mouse is on him
const tag = document.getElementById('tag');
let tagName = '';
window.setName = (name) => { tagName = tag.textContent = name; };
setName(q.get('name') || 'Italick');

// --- mouse: hovering makes the window catch the mouse; drag to carry him, release to drop or throw
const box = new THREE.Box3();
function rect() {
  box.setFromObject(k.root);
  return { left: box.min.x, right: box.max.x, top: H - box.max.y, bottom: H - box.min.y };
}
let over = false, drag = null, vel = { x: 0, y: 0 };
function hover(on) {
  if (on === over) return;
  over = on;
  tag.hidden = !on;
  document.body.style.cursor = on ? 'grab' : '';
  bridge.send('hover', on);
}
// the mouse pointer, in scene coordinates: main sends it as it moves (anywhere on screen), mouse moves over him update it too
let pointer = null;
window.setPointer = (x, y) => { pointer = ctx.pointer = { x, y: H - y }; }; // ctx.pointer: walks stay near it
addEventListener('mousemove', (e) => {
  pointer = ctx.pointer = { x: e.clientX, y: H - e.clientY };
  if (!drag) {
    // grabbable while idle, working or roaming; not behind the door, in the flag scene or mid-fight
    if (gone || (script && script !== roamScript)) return hover(false);
    const r = rect();
    return hover(e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
  }
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5) {
    drag.moved = true;
    mode = 'held';
    if (script === roamScript) { roamer.cancel(); ctx.roam = false; script = null; roamScript = null; } // grab him out of a roam
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
addEventListener('mouseup', (e) => {
  if (!drag) return;
  if (drag.moved) {
    mode = 'fall';
    const cap = 2500; // px/s, so a flick doesn't launch him off the screen
    vel = { x: Math.max(-cap, Math.min(cap, vel.x)), y: Math.max(-cap, Math.min(cap, vel.y)) };
  }
  drag = null;
  document.body.style.cursor = over ? 'grab' : '';
});

const FIXED = 1 / 120; // fixed animation step: springs and foot contacts stay consistent at any refresh rate
let lastFrame = performance.now(), accumulator = 0;
function simulate(dt) {
  t += dt;
  const p = k.root.position;
  if (mode === 'held') {
    k.face(0);
    k.look(0, -0.15);
    k.held(t, dt);
  } else if (mode === 'fall' && vel.y < 0 && p.y > ctx.ground + 1.2 * ctx.SIZE) {
    mode = 'act'; // falling from a height: out comes the parachute (he only drops without one in the ninja suit)
    run(roamer.drop(vel.x));
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
  } else if (script || (!gone && (bye || flagTodo || ctx.roam))) {
    if (!script) {
      if (bye) run(leaving());
      else if (flagTodo) run(flagScene());
      else { run(roamer.roam()); roamScript = script; }
    }
    if (script.next(dt).done) {
      const wasRoam = script === roamScript;
      script = null;
      if (wasRoam) roamScript = null;
      if (battleQueued && !bye) { battleQueued = false; run(roamer.battle()); }
      else if (policeQueued && !bye) { policeQueued = false; run(policeScene()); }
      else if (foodQueued && !bye) { foodQueued = false; run(foodScene()); }
      else next();
    }
  } else if (gone) {
    bye?.(); // behind the door until called, or for good when quitting
  } else if (ctx.busy) { // the AI is working: desk and chair appear, he sits down and types
    p.y = ctx.ground;
    k.face(0);
    k.look(0, 0.3);
    k.breathe(Math.sin(t * 1.4));
    k.work(t, dt);
  } else if (approach !== null) { // walking over to the pointer
    const d = Math.min(SPEED * ctx.SIZE * dt, Math.abs(approach - p.x)), dir = Math.sign(approach - p.x);
    p.x += dir * d;
    approachPhase += (d / (STEP * ctx.SIZE)) * Math.PI;
    k.face(dir);
    k.walk(approachPhase, dt);
    if (Math.abs(approach - p.x) < 1) { approach = null; next(); }
  } else if (action) {
    if (action.update(k, dt, ctx)) next();
  } else {
    k.stand(t, dt);
  }
  // he keeps an eye on the pointer, and when it's more than two of him away for half a second he walks over (along his floor)
  if (pointer && mode === 'act' && !script && !ctx.busy && !gone) {
    const S = ctx.SIZE, dx = pointer.x - p.x;
    k.gaze(Math.atan2(dx, 4 * S), -0.8 * Math.atan2(pointer.y - (p.y + 1.25 * S), 4 * S));
    const target = Math.max(ctx.x1 + 0.3 * S, Math.min(ctx.x2 - 0.3 * S, pointer.x - Math.sign(dx) * S)); // a step short of it
    if (approach !== null) approach = target; // on his way: heads for wherever the pointer is now
    farFor = approach === null && Math.abs(dx) > 2 * S ? farFor + dt : 0;
    if (farFor > 0.5) {
      action?.stop(k, ctx);
      action = null;
      approach = target;
      approachPhase = farFor = 0;
    }
  }
}

renderer.setAnimationLoop(() => {
  const now = performance.now();
  accumulator += Math.min((now - lastFrame) / 1000, 0.25);
  lastFrame = now;
  for (let i = 0; i < 8 && accumulator >= FIXED; i++) { simulate(FIXED); accumulator -= FIXED; }

  const p = k.root.position;
  if (!tag.hidden) {
    const r = rect();
    tag.style.left = `${(r.left + r.right) / 2}px`;
    tag.style.top = `${r.top - 6}px`;
  }
  if (flag.root.visible) flag.wave(t);
  // contact shadow: stays on the taskbar, shrinks and fades while he is up in the air
  const height = Math.max(0, p.y - ctx.ground);
  const near = Math.max(0, 1 - height / (3 * ctx.SIZE));
  contact.visible = !gone && near > 0.02;
  if (contact.visible) {
    const grow = 0.7 + 0.3 * near;
    contact.position.set(p.x, ctx.ground + ctx.SIZE * 0.07, -2);
    contact.scale.set(ctx.SIZE * 1.0 * grow, ctx.SIZE * 0.26 * grow, 1);
    contact.material.opacity = 0.6 * near;
  }
  key.position.copy(p).add(KEY_DIR); // light follows him
  renderer.render(scene, camera);
});
