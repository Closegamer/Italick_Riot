import * as THREE from 'three';
import { V, canvasTex, mesh, blob, sphere, limb, ring, paintHead, headGeo } from './parts.js';

// The assistant: a friendly geek in glasses and a reindeer sweater. Jointed (hips, knees, shoulders, elbows, head)
// so action modules can pose him: stand, walk, sit on the taskbar edge, work at a desk, dangle when dragged.
// Units ~ metres, origin between his feet, +z faces the viewer. A joint rotated by -x swings forward.

const SKIN = '#f0c6a0';
const phys = (o) => new THREE.MeshPhysicalMaterial(o);
const std = (o) => new THREE.MeshStandardMaterial(o);

// white reindeer silhouette, ~40 units long, facing right (dir = 1) or left (dir = -1)
function reindeer(g, x, y, size, dir) {
  g.save();
  g.translate(x, y);
  g.scale((dir * size) / 40, size / 40);
  g.fillStyle = g.strokeStyle = '#fbf7ee';
  g.lineCap = 'round';
  g.beginPath();
  g.ellipse(0, 0, 15, 7, 0, 0, Math.PI * 2); // body
  g.ellipse(20, -15, 6, 3.6, -0.35, 0, Math.PI * 2); // head
  g.fill();
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(10, -2);
  g.lineTo(17, -13); // neck
  g.stroke();
  g.lineWidth = 2.6;
  g.beginPath();
  for (const [a, b] of [[-10, -11], [-5, -5], [7, 8], [11, 13]]) { g.moveTo(a, 4); g.lineTo(b, 18); } // legs
  g.moveTo(-14, -3); g.lineTo(-18, -7); // tail
  g.stroke();
  g.lineWidth = 1.8;
  g.beginPath(); // antlers
  g.moveTo(17, -18); g.lineTo(14, -29); g.lineTo(10, -33); g.moveTo(14, -29); g.lineTo(17, -34);
  g.moveTo(20, -18); g.lineTo(22, -28); g.lineTo(27, -31); g.moveTo(22, -28); g.lineTo(21, -34);
  g.stroke();
  g.restore();
}

function snowflake(g, x, y, r) {
  g.strokeStyle = '#fbf7ee';
  g.lineWidth = r / 4;
  g.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    g.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r);
    g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  g.stroke();
}

function knit(g, w, h, base) {
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  g.lineWidth = 1.2;
  for (let y = 0; y < h; y += 8) {
    for (let x = 0; x < w; x += 8) { // little V stitches
      g.strokeStyle = (x + y) % 16 ? 'rgba(0,0,0,0.13)' : 'rgba(255,255,255,0.07)';
      g.beginPath();
      g.moveTo(x + 1, y + 1);
      g.lineTo(x + 4, y + 7);
      g.lineTo(x + 7, y + 1);
      g.stroke();
    }
  }
}

function zigzag(g, w, y, hgt, color) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, y + hgt);
  for (let x = 0; x <= w; x += hgt) g.lineTo(x + hgt / 2, (x / hgt) % 2 ? y + hgt : y);
  g.lineTo(w, y + hgt);
  g.fill();
}

// Christmas sweater body: canvas top = neckline, bottom = ribbed hem; u = 0 is the middle of his chest
const sweaterTex = canvasTex(1024, 512, (g, w, h) => {
  knit(g, w, h, '#b3122a');
  for (const y of [96, 252]) {
    g.fillStyle = '#1b6b3a';
    g.fillRect(0, y - 8, w, 6);
    g.fillRect(0, y + 22, w, 6);
    zigzag(g, w, y, 14, '#fbf7ee');
  }
  for (let i = 0; i < 8; i++) reindeer(g, ((i + 0.5) / 8) * w, 180, 58, i % 2 ? 1 : -1); // pairs face each other
  for (const x of [0, w]) snowflake(g, x, 176, 16); // big snowflake on the chest, drawn on both sides of the seam
  for (let i = 0; i < 26; i++) snowflake(g, (i * 397) % w, 20 + ((i * 53) % 50) + (i % 2) * 300, 5);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (let x = 0; x < w; x += 10) g.fillRect(x, h - 34, 4, 34); // ribbed hem
});
const sleeveTex = canvasTex(256, 256, (g, w, h) => {
  knit(g, w, h, '#b3122a');
  for (let i = 0; i < 6; i++) snowflake(g, 20 + i * 41, 40 + (i % 3) * 80, 6);
}, [2, 2]);
const jeansTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#3d5a86';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,0.08)';
  for (let i = -h; i < w; i += 4) { g.beginPath(); g.moveTo(i, h); g.lineTo(i + h, 0); g.stroke(); } // twill
}, [3, 3]);
const lidTex = canvasTex(512, 384, (g) => {
  g.fillStyle = '#c9cdd3';
  g.fillRect(0, 0, 512, 384);
  g.textAlign = 'center';
  g.fillStyle = '#2b2d33';
  g.beginPath(); g.roundRect(60, 60, 170, 110, 20); g.fill();
  g.fillStyle = '#7ee787';
  g.font = 'bold 64px Consolas, monospace';
  g.fillText('</>', 145, 136);
  g.fillStyle = '#b3122a';
  g.beginPath(); g.arc(380, 120, 70, 0, Math.PI * 2); g.fill();
  reindeer(g, 375, 132, 90, 1);
  g.fillStyle = '#ffd43b';
  g.beginPath(); g.roundRect(150, 240, 220, 80, 40); g.fill();
  g.fillStyle = '#2b2d33';
  g.font = 'bold 44px Segoe UI, sans-serif';
  g.fillText('{ hi! }', 260, 296);
});

const M = {
  skin: phys({ color: SKIN, roughness: 0.55, sheen: 0.3, sheenColor: 0xffd8c0 }),
  sweater: phys({ map: sweaterTex, roughness: 0.9, sheen: 1, sheenColor: 0xff9aa8, sheenRoughness: 0.8 }),
  sleeve: phys({ map: sleeveTex, roughness: 0.9, sheen: 1, sheenColor: 0xff9aa8, sheenRoughness: 0.8 }),
  rib: std({ color: 0x8e0e21, roughness: 0.9 }),
  jeans: std({ map: jeansTex, roughness: 0.85 }),
  shoe: std({ color: 0xf4f4f4, roughness: 0.6 }),
  stripe: std({ color: 0xb3122a, roughness: 0.6 }),
  sole: std({ color: 0x2b2d33, roughness: 0.8 }),
  hair: phys({ color: 0x3b2416, roughness: 0.5, sheen: 0.6, sheenColor: 0x8a5a3a }),
  frame: std({ color: 0x15161a, roughness: 0.3 }),
  lens: phys({ color: 0xcfe6ff, roughness: 0, transparent: true, opacity: 0.18 }),
  alu: std({ color: 0xc9cdd3, metalness: 0.8, roughness: 0.35 }),
  lid: std({ map: lidTex, metalness: 0.5, roughness: 0.4 }),
  keys: std({ color: 0x1d1f24, roughness: 0.7 }),
  wood: std({ color: 0x9a6a3c, roughness: 0.6 }),
  chair: std({ color: 0x2b2d33, roughness: 0.7 }),
  chrome: std({ color: 0xd0d4da, metalness: 1, roughness: 0.25 }),
  screen: new THREE.MeshBasicMaterial({ color: 0x24406e }),
  mouth: new THREE.MeshBasicMaterial({ color: 0x4a1418 }),
  teeth: new THREE.MeshBasicMaterial({ color: 0xf4f1ea }),
};

function face(A, B, jaw) {
  return paintHead(A, B, jaw, SKIN, ({ g, P, U, fill, stroke }) => {
    const dot = (x, y, r, color) => { const [px, py] = P(x, y); g.fillStyle = color; g.beginPath(); g.arc(px, py, r * U, 0, Math.PI * 2); g.fill(); };
    for (const s of [1, -1]) {
      const X = (x) => s * x;
      fill('rgba(255,140,130,0.18)', ['M', X(0.03), -0.045], ['Q', X(0.06), -0.03, X(0.08), -0.05], ['Q', X(0.06), -0.07, X(0.03), -0.045]); // blush
      fill('#ffffff', ['M', X(0.018), 0.012], ['Q', X(0.042), 0.032, X(0.066), 0.014], ['Q', X(0.042), -0.006, X(0.018), 0.012]);
      dot(X(0.042), 0.012, 0.0105, '#5a3a20'); // iris
      dot(X(0.042), 0.012, 0.0072, '#7a5230');
      dot(X(0.042), 0.012, 0.0045, '#111');
      dot(X(0.042) + 0.004, 0.017, 0.0022, '#fff'); // catch-light
      stroke('#2a1a12', 0.0028, ['M', X(0.017), 0.012], ['Q', X(0.042), 0.034, X(0.068), 0.015]); // upper lid
      fill('#4a2f1d', ['M', X(0.017), 0.045], ['Q', X(0.045), 0.064, X(0.075), 0.05], ['Q', X(0.046), 0.07, X(0.019), 0.052]); // brow
      for (let i = 0; i < 5; i++) dot(X(0.04 + (i % 3) * 0.01), -0.022 - (i % 2) * 0.007 - i * 0.002, 0.0018, 'rgba(150,80,40,0.55)'); // freckles
    }
    fill('rgba(180,70,70,0.45)', ['M', -0.017, -0.066], ['Q', 0, -0.08, 0.017, -0.066], ['Q', 0, -0.072, -0.017, -0.066]);
    stroke('#7a2e28', 0.0026, ['M', -0.026, -0.058], ['Q', 0, -0.076, 0.026, -0.058]); // grin
  });
}

function head(parent) {
  const h = new THREE.Group();
  h.position.set(0, 0.8, 0.01);
  h.scale.setScalar(1.6); // big cartoon head
  parent.add(h);
  const A = 0.108, B = 0.128, C = 0.115, JAW = 0.25;
  const skull = mesh(headGeo(A, B, C, JAW), phys({ map: face(A, B, JAW), roughness: 0.55, sheen: 0.3, sheenColor: 0xffd8c0 }), h);
  const probe = new THREE.Mesh(skull.geometry); // unparented: hits come back in head-local units
  const fz = (x, y) => new THREE.Raycaster(V(x, y, 1), V(0, 0, -1)).intersectObject(probe)[0]?.point.z ?? 0;

  blob(h, M.skin, [0, -0.024, fz(0, -0.024)], [0.014, 0.028, 0.022]); // nose
  for (const s of [1, -1]) {
    blob(h, M.skin, [s * 0.104, 0, -0.01], [0.02, 0.034, 0.026]); // ears
    // glasses: chunky black frames, faint lenses, temples back to the ears
    const c = [s * 0.043, 0.013, fz(0.043, 0.013) + 0.014];
    mesh(new THREE.TorusGeometry(0.03, 0.0048, 10, 40), M.frame, h, c, [1.12, 0.86, 1]);
    mesh(new THREE.CircleGeometry(0.03, 32), M.lens, h, c, [1.12, 0.86, 1]);
    limb(h, M.frame, [s * 0.077, 0.018, fz(0.074, 0.018) + 0.008], [s * 0.104, 0.02, -0.03], 0.0035, 0.003);
  }
  limb(h, M.frame, [-0.009, 0.02, fz(0, 0.02) + 0.012], [0.009, 0.02, fz(0, 0.02) + 0.012], 0.0035, 0.0035); // bridge

  // talking mouth over the painted grin: flattened to nothing when closed, opens downwards from the upper lip
  const mouth = new THREE.Group();
  mouth.position.set(0, -0.06, fz(0, -0.064) + 0.003);
  h.add(mouth);
  mesh(new THREE.CircleGeometry(1, 32).translate(0, -1, 0), M.mouth, mouth, [0, 0, 0], [0.022, 0.02, 1]);
  mesh(new THREE.PlaneGeometry(1.3, 0.3).translate(0, -0.18, 0), M.teeth, mouth, [0, 0, 0.0005], [0.022, 0.02, 1]); // upper teeth
  mouth.scale.y = 0.001;
  h.userData.mouth = mouth;

  // messy hair: a cap plus tufts falling over the forehead
  blob(h, M.hair, [0, 0.03, -0.025], [0.116, 0.13, 0.118]);
  const tufts = [[-0.06, 0.1, 0.05, 0.045], [-0.02, 0.115, 0.06, 0.05], [0.025, 0.112, 0.06, 0.05], [0.065, 0.098, 0.045, 0.042],
    [-0.04, 0.085, 0.085, 0.035], [0.01, 0.088, 0.09, 0.035], [0.05, 0.08, 0.08, 0.03], [0, 0.135, 0.0, 0.055],
    [-0.085, 0.07, 0.0, 0.04], [0.088, 0.065, 0.0, 0.04], [0.04, 0.13, -0.05, 0.05], [-0.045, 0.13, -0.04, 0.05]];
  for (const [x, y, z, r] of tufts) blob(h, M.hair, [x, y, z], [r, r * 0.8, r]);
  return h;
}

// a limb segment hanging from a joint: rotate `pivot` to pose it, attach the next segment to `end`
function seg(parent, mat, pos, len, r1, r2) {
  const pivot = new THREE.Group();
  pivot.position.set(...pos);
  parent.add(pivot);
  mesh(new THREE.CylinderGeometry(r2, r1, len, 20), mat, pivot, [0, -len / 2, 0]);
  mesh(sphere(r1), mat, pivot);
  const end = new THREE.Group();
  end.position.y = -len;
  pivot.add(end);
  mesh(sphere(r2), mat, end);
  return { pivot, end };
}

function laptop(parent) {
  const l = new THREE.Group();
  mesh(new THREE.BoxGeometry(0.36, 0.018, 0.24), M.alu, l);
  mesh(new THREE.BoxGeometry(0.32, 0.004, 0.11), M.keys, l, [0, 0.01, -0.02]);
  const lid = new THREE.Group();
  lid.position.set(0, 0.009, 0.12); // hinge on the far edge: the screen faces him, the stickers face us
  lid.rotation.x = 0.32;
  l.add(lid);
  // box faces: +x, -x, +y, -y, +z (stickers, towards the viewer), -z (screen, towards him)
  mesh(new THREE.BoxGeometry(0.36, 0.22, 0.012), [M.alu, M.alu, M.alu, M.alu, M.lid, M.screen], lid, [0, 0.11, 0]);
  const light = new THREE.PointLight(0x9cc8ff, 0, 0, 0); // screen glow on his face
  light.position.set(0, 0.12, -0.08);
  lid.add(light);
  parent.add(l);
  return { l, light };
}

// desk and office chair that rise out of the floor while he works; the laptop sits on the desk
function furniture(parent) {
  const g = new THREE.Group();
  parent.add(g);
  mesh(new THREE.BoxGeometry(0.9, 0.04, 0.5), M.wood, g, [0, 0.62, 0.42]); // desk top
  for (const x of [-0.41, 0.41]) for (const z of [0.21, 0.63]) mesh(new THREE.BoxGeometry(0.035, 0.6, 0.035), M.wood, g, [x, 0.3, z]);
  mesh(new THREE.BoxGeometry(0.44, 0.05, 0.42), M.chair, g, [0, 0.4, -0.02]); // seat
  mesh(new THREE.BoxGeometry(0.44, 0.42, 0.05), M.chair, g, [0, 0.68, -0.24]); // backrest
  for (const x of [-0.19, 0.19]) for (const z of [-0.2, 0.16]) mesh(new THREE.BoxGeometry(0.03, 0.38, 0.03), M.chrome, g, [x, 0.19, z]);
  const { l, light } = laptop(g);
  l.position.set(0, 0.65, 0.36);
  return { g, light };
}

const STANCE = { tL: 0, tR: 0, kL: 0, kR: 0, aL: 0, aR: 0, eL: -0.15, eR: -0.15, oL: 0.12, oR: 0.12, hips: 0.85, lean: 0, desk: 0 }; // hips 0.85 puts the soles on y = 0

export function createGeek() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(0.8); // ~1.4 units tall: at the Medium size (130 px/unit) he is ~180 px
  root.add(body);
  const turn = new THREE.Group(); // faces left/right while walking
  body.add(turn);

  const hips = new THREE.Group();
  turn.add(hips);
  blob(hips, M.jeans, [0, 0, 0], [0.18, 0.11, 0.13]);
  const legs = {};
  for (const [S, s] of [['L', 1], ['R', -1]]) {
    const thigh = seg(hips, M.jeans, [s * 0.1, -0.03, 0], 0.37, 0.085, 0.066);
    const shin = seg(thigh.end, M.jeans, [0, 0, 0], 0.36, 0.064, 0.05);
    blob(shin.end, M.shoe, [0, -0.035, 0.06], [0.065, 0.05, 0.13]);
    blob(shin.end, M.stripe, [s * 0.05, -0.035, 0.06], [0.02, 0.025, 0.08]);
    blob(shin.end, M.sole, [0, -0.07, 0.06], [0.068, 0.017, 0.135]);
    legs[S] = { thigh: thigh.pivot, shin: shin.pivot };
  }
  const desk = furniture(turn);

  const spine = new THREE.Group(); // everything that breathes
  spine.position.y = 0.02;
  hips.add(spine);
  const prof = [[0, 0], [0.17, 0.01], [0.175, 0.12], [0.18, 0.24], [0.2, 0.36], [0.21, 0.44], [0.19, 0.5], [0.12, 0.54], [0.06, 0.56]];
  mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 48), M.sweater, spine).scale.z = 0.7;
  ring(spine, M.rib, [0, 0.545, 0.005], [0, 1, 0.2], 0.07, 0.016); // ribbed collar
  limb(spine, M.skin, [0, 0.54, 0], [0, 0.64, 0.01], 0.05, 0.047); // neck
  const h = head(spine);
  const arms = {};
  for (const [S, s] of [['L', 1], ['R', -1]]) {
    const upper = seg(spine, M.sleeve, [s * 0.215, 0.46, 0], 0.3, 0.062, 0.052);
    const fore = seg(upper.end, M.sleeve, [0, 0, 0], 0.27, 0.052, 0.044);
    ring(fore.end, M.rib, [0, 0.02, 0], [0, 1, 0], 0.044, 0.012); // cuff
    blob(fore.end, M.skin, [0, -0.06, 0.005], [0.042, 0.06, 0.028]); // hand
    arms[S] = { upper: upper.pivot, fore: fore.pivot };
  }
  root.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });

  // current pose, eased towards each frame's target so switching actions never snaps
  const cur = { ...STANCE };
  let facing = 0, lookYaw = 0, lookPitch = 0;
  function apply(target, dt) {
    const e = 1 - Math.exp(-dt * 14);
    for (const key in cur) cur[key] += ((target[key] ?? STANCE[key]) - cur[key]) * e;
    for (const [S, s] of [['L', 1], ['R', -1]]) {
      legs[S].thigh.rotation.x = cur['t' + S];
      legs[S].shin.rotation.x = cur['k' + S];
      arms[S].upper.rotation.set(cur['a' + S], 0, s * cur['o' + S]);
      arms[S].fore.rotation.x = cur['e' + S];
    }
    hips.position.y = cur.hips;
    spine.rotation.x = cur.lean;
    desk.g.visible = cur.desk > 0.02;
    desk.g.scale.set(1, Math.max(0.001, cur.desk), 1); // grows up out of the floor
    turn.rotation.y += (facing - turn.rotation.y) * e;
    h.rotation.set(lookPitch, lookYaw, 0);
  }

  return {
    root,
    // dir: 1 = walking right, -1 = left, 0 = facing the viewer (3/4 turn keeps his face visible)
    face: (dir) => { facing = dir * 1.15; },
    look: (yaw, pitch) => { lookYaw = yaw; lookPitch = pitch; },
    // t = time while speaking, or null: the mouth opens and closes in a syllable-like rhythm
    talk: (t) => {
      const open = t === null ? 0 : 0.15 + 0.85 * Math.max(0, Math.sin(t * 13)) * (0.6 + 0.4 * Math.sin(t * 3.7 + 1));
      const m = h.userData.mouth;
      m.scale.y += (Math.max(0.001, open) - m.scale.y) * 0.5;
    },
    breathe: (b) => spine.scale.set(1 + 0.006 * b, 1 + 0.008 * b, 1 + 0.015 * b),

    stand: (t, dt) => apply({ aL: 0.04 * Math.sin(t * 0.6), aR: -0.04 * Math.sin(t * 0.6) }, dt),

    // phase advances with distance walked
    walk: (phase, dt) => {
      const s = Math.sin(phase), knee = (p) => 0.1 + 0.75 * Math.max(0, Math.sin(p + 1.3));
      apply({
        tL: -0.45 * s, tR: 0.45 * s, kL: knee(phase), kR: knee(phase + Math.PI),
        aL: 0.4 * s, aR: -0.4 * s, eL: -0.35, eR: -0.35, oL: 0.08, oR: 0.08,
        hips: 0.83 + 0.03 * Math.abs(Math.cos(phase)), lean: 0.06,
      }, dt);
    },

    // sitting on the taskbar edge (origin = seat), legs dangling over it
    sit: (t, dt) => apply({
      tL: -1.5, tR: -1.5, kL: 1.45 + 0.22 * Math.sin(t * 2.2), kR: 1.45 + 0.22 * Math.sin(t * 2.2 + 2),
      aL: -0.45, aR: -0.45, eL: -0.75, eR: -0.75, oL: 0.1, oR: 0.1, hips: 0.12,
    }, dt),

    // on the chair at the desk (origin = floor), typing on the laptop; the screen glows on his face
    work: (t, dt) => {
      const tap = (p) => 0.08 * Math.max(0, Math.sin(t * 17 + p) * Math.sin(t * 3.1 + p));
      apply({
        tL: -1.5, tR: -1.5, kL: 1.5, kR: 1.5, hips: 0.5,
        aL: -0.45, aR: -0.45, eL: -1.1 + tap(0), eR: -1.1 + tap(1.7), oL: 0.05, oR: 0.05, desk: 1,
      }, dt);
      desk.light.intensity = 0.6 + 0.1 * Math.sin(t * 9);
    },

    // dangling from the mouse: arms flail, legs kick
    held: (t, dt) => apply({
      tL: 0.3 * Math.sin(t * 6), tR: -0.3 * Math.sin(t * 6), kL: 0.4, kR: 0.4,
      aL: -0.3, aR: -0.3, oL: 1.3 + 0.25 * Math.sin(t * 9), oR: 1.3 + 0.25 * Math.sin(t * 9 + 1), eL: -0.6, eR: -0.6,
    }, dt),
  };
}
