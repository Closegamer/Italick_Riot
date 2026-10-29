import * as THREE from 'three';
import { mesh, canvasTex, sphere, UP } from './parts.js';
import { createStatue } from './statue.js';
import { createNunchaku } from './nunchaku.js';
import * as sfx from './sfx.js';

// Screensaver roaming: he walks the taskbar and the tops of open windows. Each trip up is picked at random:
// a ladder up and a parachute down, or (in a puff of smoke) a ninja: grappling hook and rope up, somersault down. Window edges come from main (setEdges) in window px, measured from the top.
const STEP = 0.5, SPEED = 0.65, CLIMB = 0.55, FALL = 0.8; // units; units/s

function createLadder() {
  const root = new THREE.Group();
  root.visible = false;
  const wood = new THREE.MeshStandardMaterial({ color: 0xb8864b, roughness: 0.7 });
  const rails = [-1, 1].map((s) => mesh(new THREE.BoxGeometry(0.05, 1, 0.05), wood, root, [s * 0.24, 0.5, 0]));
  const rungs = Array.from({ length: 90 }, (_, i) => mesh(new THREE.BoxGeometry(0.48, 0.035, 0.035), wood, root, [0, 0.15 + i * 0.28, 0]));
  return {
    root,
    set: (height) => { // units
      root.visible = height > 0.01;
      for (const r of rails) { r.scale.y = Math.max(0.001, height); r.position.y = height / 2; }
      for (const r of rungs) r.visible = r.position.y < height;
    },
  };
}

function createChute() {
  const root = new THREE.Group();
  root.visible = false;
  const gores = canvasTex(512, 64, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#fbf7ee' : '#b3122a'; g.fillRect((i * w) / 8, 0, w / 8, h); }
  });
  const canopy = new THREE.Group();
  canopy.position.y = 2.05;
  root.add(canopy);
  const dome = new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  mesh(dome, new THREE.MeshStandardMaterial({ map: gores, side: THREE.DoubleSide, roughness: 0.8 }), canopy, [0, 0, 0], [0.95, 0.5, 0.95]);
  const lines = [];
  for (const s of [-1, -0.45, 0.45, 1]) lines.push(new THREE.Vector3(s * 0.93, 2.05, 0), new THREE.Vector3(Math.sign(s) * 0.2, 1.55, 0.05));
  const strings = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), new THREE.LineBasicMaterial({ color: 0x555555 }));
  root.add(strings);
  return {
    root,
    set: (open) => {
      root.visible = open > 0.01;
      canopy.scale.setScalar(Math.max(0.001, open));
      strings.visible = open > 0.6;
    },
  };
}

// grappling hook: a shank and three curved prongs (units, origin at the eye where the rope ties on)
function createHook() {
  const root = new THREE.Group();
  root.visible = false;
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 1, roughness: 0.3 });
  mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.16, 8), steel, root, [0, -0.08, 0]);
  for (let i = 0; i < 3; i++) {
    const prong = mesh(new THREE.TorusGeometry(0.05, 0.011, 6, 12, Math.PI * 0.75), steel, root, [0, -0.16, 0]);
    prong.rotation.set(0, (i * Math.PI * 2) / 3, Math.PI * 0.6);
  }
  return root;
}

// a thin rope between two points (px)
function createRope() {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6), new THREE.MeshStandardMaterial({ color: 0xc8a165, roughness: 0.9 }));
  m.visible = false;
  const d = new THREE.Vector3();
  m.span = (a, b, r) => {
    d.subVectors(b, a);
    const len = d.length();
    m.visible = len > 1;
    m.position.addVectors(a, b).multiplyScalar(0.5);
    m.scale.set(r, Math.max(1, len), r);
    if (m.visible) m.quaternion.setFromUnitVectors(UP, d.normalize());
  };
  return m;
}

// a puff of smoke for the costume change
function createPuff() {
  const root = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xd8dce2, roughness: 1, transparent: true, depthWrite: false });
  const balls = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return mesh(sphere(1, 12), mat, root, [0.35 * Math.cos(a), 0.7 + 0.5 * Math.sin(a * 1.7), 0.3 * Math.sin(a)]);
  });
  root.visible = false;
  return {
    root,
    set: (a) => { // 0..1 over the puff's life
      root.visible = a > 0 && a < 1;
      mat.opacity = 0.9 * (1 - a);
      balls.forEach((b, i) => b.scale.setScalar((0.15 + 0.35 * Math.sin(Math.min(1, a * 1.6) * Math.PI * 0.5)) * (0.8 + 0.2 * (i % 3))));
    },
  };
}

export function createRoam({ k, ctx, scene, during, ease, time }) {
  const ladder = createLadder(), chute = createChute(), hook = createHook(), rope = createRope(), puff = createPuff();
  scene.add(ladder.root, chute.root, hook, rope, puff.root);
  let ninja = false;
  const p = k.root.position;
  let raw = [];
  const S = () => ctx.SIZE;
  const ground = () => ({ id: 'ground', x1: 0.3 * S(), x2: ctx.W - 0.3 * S(), y: ctx.ground });
  // edges he fits on: room for his head below the screen top, well above the taskbar, wide enough to walk
  const edges = () => raw
    .map((e) => ({ id: e.id, x1: Math.max(e.x1, 0) + 0.3 * S(), x2: Math.min(e.x2, ctx.W) - 0.3 * S(), y: ctx.H - e.top }))
    .filter((e) => e.x2 - e.x1 > 0.6 * S() && ctx.H - e.y > 1.6 * S() && e.y > ctx.ground + 1.2 * S());
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  let on = ground(); // the surface under his feet
  // keeps him on his window as it moves up or down; false once it has gone (closed, minimized, covered)
  function follow() {
    if (on.id === 'ground') { p.y = ctx.ground; return true; }
    const e = edges().find((e) => e.id === on.id && p.x >= e.x1 - 2 && p.x <= e.x2 + 2);
    if (e) { on = e; p.y = e.y; }
    return !!e;
  }

  function* walkTo(x, tick = null, pace = 1) {
    const dir = Math.sign(x - p.x);
    let phase = 0;
    while (Math.abs(x - p.x) > 1) {
      const dt = yield;
      if (!follow()) return false;
      const d = Math.min(SPEED * pace * S() * dt, Math.abs(x - p.x));
      p.x += dir * d;
      phase += (d / (STEP * S())) * Math.PI;
      k.face(dir);
      k.look(0, 0);
      k.walk(phase, dt);
      if (tick) tick(dt);
    }
    return true;
  }

  // sits on the window edge for a while, legs dangling over the window
  function* perch(sec) {
    let ok = true;
    yield* during(sec, (a, dt) => {
      ok &&= follow();
      k.face(0);
      k.look(0.4 * Math.sin(a * 4), 0.15);
      k.breathe(Math.sin(time() * 1.3));
      k.perch(time(), dt);
    });
    return ok;
  }

  // smoke puff; the outfit changes while he's hidden in it (ninja by default, karate for kimono fights)
  function* dress(on, karateMan = false) {
    puff.root.position.copy(p);
    puff.root.scale.setScalar(S());
    let done = false;
    yield* during(0.9, (a, dt) => {
      puff.set(a);
      if (a > 0.3 && !done) {
        if (karateMan) k.karate(on);
        else { k.ninja(on); ninja = on; }
        done = true;
      }
      k.face(0);
      k.stand(time(), dt);
    });
    puff.set(1);
  }

  // ninja way up. The hook: he picks a spot along the edge (not straight above him), whirls the hook round over his
  // head and throws it in an arc; sometimes it doesn't catch and he reels it in for another go. Then a tug, he walks
  // under it and climbs: arms pull while the legs hang, knees come up and the feet clamp the rope, legs straighten
  // while the hands reach higher - so he rises in surges, not at a ladder's steady pace.
  function* climbRope(e) {
    const y0 = p.y, R = 0.012 * S(), hand = new THREE.Vector3(), foot = new THREE.Vector3();
    const hx = Math.max(e.x1, Math.min(e.x2, p.x + (Math.random() < 0.5 ? -1 : 1) * (0.4 + 0.8 * Math.random()) * S()));
    const top = new THREE.Vector3(hx, e.y + 0.02 * S(), -0.1 * S());
    const dir = Math.sign(hx - p.x) || 1;
    hook.scale.setScalar(S());
    hook.visible = true;
    const holdHook = (spin) => { // the hook whirls round on a short rope from his right hand
      k.hand('R', hand);
      hook.position.set(hand.x + Math.cos(spin) * 0.35 * S(), hand.y + 0.05 * S(), hand.z + Math.sin(spin) * 0.35 * S());
      rope.span(hand, hook.position, R);
    };
    for (let tries = 0; ; tries++) {
      yield* during(0.5, (a, dt) => { k.turn(dir * 2.6); k.look(0, 0.5); k.pose({ aR: -2.9, eR: -0.3, oR: 0.3, aL: 0.2 }, dt); holdHook(a * 6); });
      yield* during(1.1, (a, dt) => { k.pose({ aR: -2.9, eR: -0.3, oR: 0.3, aL: 0.2 }, dt); holdHook(3 + a * 14); });
      k.hand('R', hand);
      const from = hook.position.clone(), catches = tries > 0 || Math.random() < 0.7;
      const apex = Math.max(from.y, top.y) + 0.5 * S();
      yield* during(0.75, (a, dt) => { // the throw: the arm whips forward, the hook flies in an arc with the rope paying out
        k.pose({ aR: -1.9, eR: -0.1, oR: 0.1, aL: 0.3, lean: 0.12 }, dt);
        hook.position.lerpVectors(from, top, a);
        hook.position.y = (1 - a) ** 2 * from.y + 2 * a * (1 - a) * (2 * apex - (from.y + top.y) / 2) + a * a * top.y; // a parabola
        k.hand('R', hand);
        rope.span(hand, hook.position, R);
      });
      if (catches) break;
      const miss = hook.position.clone(); // it scrapes off the edge and drops; he reels it back in
      yield* during(0.6, (a, dt) => { hook.position.set(miss.x, miss.y - (miss.y - y0) * a * a, miss.z); k.hand('R', hand); rope.span(hand, hook.position, R); k.stand(time(), dt); });
      const lie = hook.position.clone();
      yield* during(1.2, (a, dt) => { k.pose({ aR: -0.8 - 0.5 * Math.sin(a * 12), aL: -0.6 + 0.5 * Math.sin(a * 12), eR: -1, eL: -1 }, dt); k.hand('R', hand); hook.position.lerpVectors(lie, hand, ease(a)); rope.span(hand, hook.position, R); });
    }
    hook.position.copy(top);
    yield* during(0.8, (a, dt) => { // two tugs: it holds
      k.pose({ aR: -1.4 - 0.5 * Math.abs(Math.sin(a * Math.PI * 2)), aL: -1.4 - 0.5 * Math.abs(Math.sin(a * Math.PI * 2)), eR: -0.6, eL: -0.6, lean: -0.1 }, dt);
      k.hand('R', hand);
      rope.span(hand, top, R);
    });
    // walk under it, the rope running to his hand
    let phase = 0;
    while (Math.abs(p.x - hx) > 1) {
      const dt = yield, d = Math.min(SPEED * S() * dt, Math.abs(hx - p.x));
      p.x += Math.sign(hx - p.x) * d;
      phase += (d / (STEP * S())) * Math.PI;
      k.face(Math.sign(hx - p.x) || dir);
      k.walk(phase, dt);
      k.hand('R', hand);
      rope.span(hand, top, R);
    }
    foot.set(hx, y0, -0.05 * S());
    rope.span(foot, top, R);
    yield* during(0.4, (a, dt) => { k.turn(Math.PI); k.pose({ aL: -2.85, aR: -2.85, eL: -0.2, eR: -0.2, oL: -0.05, oR: -0.05 }, dt); });
    const RISE = 0.6 * S(), CYCLE = 1.2; // px and seconds per pull-and-clamp
    const lift = (u) => (u < 0.5 ? 0.6 * ease(u / 0.5) : u < 0.75 ? 0.6 : 0.6 + 0.4 * ease((u - 0.75) / 0.25)); // share of RISE done by u
    let n = 0, u = 0;
    while (p.y < e.y) {
      const dt = yield;
      u += dt / CYCLE;
      if (u >= 1) { u -= 1; n++; }
      p.y = Math.min(e.y, y0 + RISE * (n + lift(u)));
      const pull = u < 0.5 ? u / 0.5 : u < 0.75 ? 1 : 1 - (u - 0.75) / 0.25; // 0 = arms up high, 1 = hands at the chin
      const knee = u < 0.5 ? 0 : u < 0.75 ? (u - 0.5) / 0.25 : 1 - (u - 0.75) / 0.25; // feet clamping the rope
      const alt = n % 2 ? 0.15 : -0.15; // hand over hand
      const A = -2.85 + 1.0 * ease(pull), E = -0.2 - 1.5 * ease(pull);
      k.pose({
        aL: A - alt, aR: A + alt, eL: E, eR: E, oL: -0.05, oR: -0.05,
        tL: -1.1 * ease(knee), tR: -1.1 * ease(knee), kL: 0.15 + 1.7 * ease(knee), kR: 0.15 + 1.7 * ease(knee), lean: 0.05,
      }, dt);
      k.root.rotation.z = 0.04 * Math.sin((n + u) * Math.PI); // a little sway on the rope
    }
    k.root.rotation.z = 0;
    on = e;
    yield* during(0.4, (a, dt) => { k.face(0); k.stand(time(), dt); });
    yield* during(1.0, (a, dt) => { // hauls the rope up hand over hand
      k.pose({ aL: -1.2 - 0.4 * Math.sin(a * 14), aR: -1.2 + 0.4 * Math.sin(a * 14), eL: -1, eR: -1, lean: 0.25 }, dt);
      foot.y = y0 + (top.y - y0) * ease(a);
      rope.span(foot, top, R);
    });
    rope.visible = hook.visible = false;
  }

  // ninja way down: a leap with a somersault, a crouched landing on whatever is below
  function* flip(dir) {
    const cy = 0.7 * S(), G = 9 * S(); // he spins around his middle, not his feet; gravity px/s²
    const vx = (dir || (Math.random() < 0.5 ? -1 : 1)) * 0.5 * S();
    let fx = p.x, fy = p.y, vy = dir ? 2.2 * S() : 0, spin = 0, from;
    for (;;) {
      const dt = yield;
      from = fy;
      vy -= G * dt;
      fx = Math.max(0.5 * S(), Math.min(ctx.W - 0.5 * S(), fx + vx * dt));
      fy += vy * dt;
      spin = Math.min(Math.PI * 2, spin + dt * 7.5);
      const r = -Math.sign(vx) * spin; // a roll forwards, the way he's going
      k.root.rotation.z = r;
      p.set(fx + Math.sin(r) * cy, fy + cy - Math.cos(r) * cy, p.z); // rotate about the middle: feet go round it
      k.tuck(dt);
      const land = vy < 0 && [...edges(), ground()].filter((e) => fx >= e.x1 && fx <= e.x2 && e.y <= from && e.y >= fy).sort((m, n) => n.y - m.y)[0];
      if (land) { on = land; break; }
    }
    k.root.rotation.z = 0;
    p.set(fx, on.y, p.z);
    k.face(0);
    yield* during(0.6, (a, dt) => k.crouch(dt));
    yield* during(0.4, (a, dt) => k.stand(time(), dt));
  }

  // whichever way suits his outfit
  function* down(dir) {
    if (ninja) yield* flip(dir);
    else yield* jump(dir);
  }

  function* pause(sec) {
    let ok = true;
    yield* during(sec, (a, dt) => {
      ok &&= follow();
      k.face(0);
      k.look(0.5 * Math.sin(a * 5), -0.05);
      k.breathe(Math.sin(time() * 1.4));
      k.stand(time(), dt);
    });
    return ok;
  }

  // from the ground: a ladder shoots up to the window edge, he climbs it, steps off on top, the ladder goes
  function* climbTo(e, pace = 1) {
    const y0 = p.y, h = (e.y - y0) / S() + 0.35;
    ladder.root.position.set(p.x, y0, -0.3 * S());
    ladder.root.scale.setScalar(S());
    yield* during(0.4, (a, dt) => { k.turn(Math.PI); k.stand(time(), dt); });
    yield* during(0.7, (a, dt) => { ladder.set(h * ease(a)); k.stand(time(), dt); });
    let phase = 0;
    while (p.y < e.y) {
      const dt = yield;
      p.y = Math.min(e.y, p.y + CLIMB * pace * S() * dt);
      phase += ((CLIMB * pace * dt) / 0.28) * Math.PI; // one rung per half cycle
      k.climb(phase, dt);
    }
    on = e;
    yield* during(0.4, (a, dt) => { k.face(0); k.stand(time(), dt); });
    yield* during(0.5, (a, dt) => { ladder.set(h * (1 - ease(a))); k.stand(time(), dt); });
  }

  // off the edge (or out from under a vanished window): the parachute opens and he drifts down onto whatever is below
  function* jump(dir, { hop = true, groundOnly = false } = {}) {
    const y0 = p.y;
    if (dir && hop) yield* during(0.35, (a, dt) => { p.x += (dir * 0.35 * S() * dt) / 0.35; p.y = y0 + 0.25 * S() * Math.sin(a * Math.PI); k.hang(time(), dt); });
    const drift = (dir || (Math.random() < 0.5 ? -1 : 1)) * 0.12 * S();
    let a = 0, from = p.y + 1;
    for (;;) {
      const dt = yield;
      a += dt;
      const open = Math.min(1, a / 0.5);
      from = p.y;
      p.y -= (3 * (1 - open) + FALL * open) * S() * dt; // drops fast until the canopy opens
      p.x = Math.max(S(), Math.min(ctx.W - S(), p.x + drift * dt)); // keep the canopy on screen
      k.root.rotation.z = 0.12 * Math.sin(a * 1.7) * open;
      chute.root.position.copy(p);
      chute.root.rotation.z = k.root.rotation.z;
      chute.root.scale.setScalar(S());
      chute.set(open);
      k.face(0);
      k.look(0, -0.2);
      k.hang(time(), dt);
      const land = [...(groundOnly ? [] : edges()), ground()].filter((e) => p.x >= e.x1 && p.x <= e.x2 && e.y <= from && e.y >= p.y).sort((m, n) => n.y - m.y)[0];
      if (land) { on = land; p.y = land.y; break; }
    }
    k.root.rotation.z = 0;
    yield* during(0.5, (a, dt) => { chute.set(1 - ease(a)); chute.root.position.y = p.y - 0.6 * S() * a; k.stand(time(), dt); });
    chute.set(0);
  }

  // jump off the nearer end of the window he's on
  function* jumpOff() {
    const dir = p.x - on.x1 < on.x2 - p.x ? -1 : 1;
    if (yield* walkTo(dir < 0 ? on.x1 : on.x2)) yield* down(dir);
    else yield* down(0);
  }

  function* roam() {
    on = ground();
    p.y = ctx.ground;
    while (ctx.roam) {
      const up = edges().filter((e) => e.x1 < ctx.W && e.x2 > 0);
      if (on.id === 'ground' && ninja) yield* dress(false); // back down: costume off
      const r = Math.random();
      if (on.id === 'ground' && up.length && r < 0.6) {
        const e = pick(up);
        if (!(yield* walkTo(e.x1 + (0.2 + 0.6 * Math.random()) * (e.x2 - e.x1))) || !ctx.roam) continue;
        if (Math.random() < 0.5) { yield* dress(true); yield* climbRope(e); } else yield* climbTo(e);
      } else if (on.id !== 'ground' && r < 0.3) {
        yield* jumpOff();
      } else {
        const x = on.x1 + Math.random() * (on.x2 - on.x1);
        const rest = on.id !== 'ground' && Math.random() < 0.4 ? perch(3 + Math.random() * 4) : pause(1 + Math.random() * 3);
        if (!((yield* walkTo(x)) && (yield* rest))) yield* down(0); // the window went away under him
      }
    }
    // the user is back: come all the way down to the taskbar - a lower window is not the end, or he would
    // start a normal walk action up on it and stride off into the air
    for (let i = 0; on.id !== 'ground' && i < 4; i++) yield* jumpOff();
    if (on.id !== 'ground') { on = ground(); p.y = ctx.ground; }
    if (ninja) yield* dress(false);
    k.breathe(0);
  }

  // ---- statue battles: a rubber Anthropic statue pops up on a window or the taskbar, and Italick deals with it ----
  let nunchaku = null;
  function weapon() {
    if (!nunchaku) {
      nunchaku = createNunchaku(S());
      scene.add(nunchaku.root);
    }
    nunchaku.root.scale.setScalar(S());
    return nunchaku;
  }

  function spot() {
    const up = edges().filter((e) => e.x2 - e.x1 > 1.3 * S());
    return up.length && Math.random() < 0.65 ? pick(up) : ground();
  }

  // come down to the taskbar first, then walk (and climb) to the statue's platform. He hurries for a statue.
  const CHASE = 2.4;
  function* approach(e, x) {
    for (let i = 0; on.id !== 'ground' && i < 4; i++) yield* jumpOff();
    if (on.id !== 'ground') { on = ground(); p.y = ctx.ground; }
    if (e.id !== 'ground') {
      yield* walkTo(Math.max(e.x1 + 0.4 * S(), Math.min(e.x2 - 0.4 * S(), x)), null, CHASE);
      yield* climbTo(e, CHASE);
    } else {
      yield* walkTo(Math.max(e.x1 + 0.35 * S(), Math.min(e.x2 - 0.35 * S(), x)), null, CHASE);
    }
  }

  // let the statue live (wobble, fall) while something else is happening
  function* tick(statue, sec, each) {
    for (let s = 0; s < sec;) {
      const dt = yield;
      s += dt;
      statue.update(dt);
      if (each) each(Math.min(1, s / sec), dt);
    }
  }

  function* battle() {
    const e = spot();
    const sx = e.x1 + (0.25 + 0.5 * Math.random()) * (e.x2 - e.x1);
    // he arrives beside the statue: the ladder goes up about one body-width to the roomier side
    const side = sx + 0.95 * S() <= e.x2 - 0.25 * S() ? 1 : -1;
    const climbX = Math.max(e.x1 + 0.35 * S(), Math.min(e.x2 - 0.35 * S(), sx + side * 0.95 * S()));
    const statue = createStatue({ scene, size: S(), platforms: () => [ground(), ...edges()] });
    statue.place(sx, e.y, e.id);
    sfx.boing();
    yield* tick(statue, 0.8, (a, dt) => { k.face(0); k.look(0, 0.1); k.breathe(Math.sin(time() * 1.2)); k.stand(time(), dt); });

    yield* approach(e, climbX);
    const stand = Math.max(e.x1 + 0.35 * S(), Math.min(e.x2 - 0.35 * S(), sx + side * 0.6 * S()));
    yield* walkTo(stand, (dt) => statue.update(dt), CHASE);

    if (statue.alive() && !statue.falling()) {
      const style = Math.random() < 0.5 ? 'ninja' : 'karate';
      k.face(-side);
      if (style === 'ninja') {
        if (!ninja) yield* dress(true);
        const sticks = weapon();
        sticks.show();
        const hand = new THREE.Vector3();
        const aim = (angle, swing) => {
          k.hand('R', hand);
          sticks.set(hand.x, hand.y, hand.z, angle, swing, 0, S());
        };
        for (let hits = 0; hits < 5 && statue.alive(); hits++) {
          sfx.whoosh();
          yield* during(0.3, (a, dt) => { // wind up
            k.pose({ aR: -2.5, eR: -0.9, oR: 0.35, aL: 0.35, eL: -0.35, lean: -0.08, twist: -0.18 }, dt);
            aim(-1.5 + 0.2 * a, 0.15 * Math.sin(a * 9));
            statue.update(dt);
          });
          yield* during(0.16, (a, dt) => { // strike
            k.pose({ aR: -0.25, eR: -0.12, oR: 0.05, aL: 0.15, eL: -0.45, lean: 0.22, twist: 0.28 }, dt);
            aim(-1.3 + 2.9 * ease(a), 0.5 * Math.sin(a * Math.PI));
            statue.update(dt);
          });
          statue.hit(-side);
          sfx.thwack();
          yield* tick(statue, 0.3, (a, dt) => { // follow through
            k.pose({ aR: -0.7, eR: -0.35, oR: 0.1, lean: 0.1 }, dt);
            aim(1.6 - 0.7 * ease(a), 0.2);
          });
          if (!statue.alive() || statue.falling()) break;
        }
        sticks.hide();
      } else {
        // karate man in a kimono: punches and kicks
        ninja = false; // the kimono replaces any ninja suit from roaming
        yield* dress(true, true);
        k.turn(-side * Math.PI / 2); // body and face square to the statue, in profile to the user
        for (let hits = 0; hits < 5 && statue.alive(); hits++) {
          const kick = hits % 2 === 1;
          if (hits === 0 || hits === 4) sfx.kiai();
          const wind = kick
            ? { tR: -0.75, kR: 1.35, tL: 0.05, kL: 0.25, aL: -1.5, eL: -1.7, aR: -1.4, eR: -1.7, lean: 0.12 }
            : { aR: -0.9, eR: -1.8, aL: -1.2, eL: -1.5, tR: 0.1, kR: 0.2, lean: 0.06 };
          const strike = kick
            ? { tR: -1.6, kR: 0.05, tL: 0.1, kL: 0.3, aL: -1.9, eL: -1.6, aR: -1.5, eR: -1.8, lean: -0.2 }
            : { aR: -1.7, eR: -0.05, aL: -0.8, eL: -1.8, tR: 0.12, kR: 0.2, lean: 0.14, twist: -0.2 };
          yield* during(0.2, (a, dt) => { k.pose(wind, dt); statue.update(dt); });
          sfx.whoosh();
          yield* during(0.13, (a, dt) => { k.pose(strike, dt); statue.update(dt); });
          statue.hit(-side);
          sfx.thwack();
          yield* tick(statue, 0.24, (a, dt) => {
            k.pose({ aR: -1.2, eR: -1.7, aL: -1.2, eL: -1.7, tR: 0.05, kR: 0.2, lean: 0.02 }, dt);
          });
          if (!statue.alive() || statue.falling()) break;
        }
      }
      yield* tick(statue, 3.2, (a, dt) => {
        if (style === 'karate') k.turn(-side * Math.PI / 2); // keep facing the statue while it turns to dust
        else k.face(-side);
        k.look(0, -0.15);
        k.breathe(Math.sin(time() * 1.2));
        k.stand(time(), dt);
      });
      if (style === 'karate') {
        yield* dress(false, true);
      }
    } else {
      yield* tick(statue, 3.2, (a, dt) => { k.face(0); k.look(0, -0.15); k.breathe(Math.sin(time() * 1.2)); k.stand(time(), dt); });
    }

    if (ninja) yield* dress(false);
    for (let i = 0; on.id !== 'ground' && i < 3; i++) yield* jumpOff();
    if (on.id !== 'ground') { on = ground(); p.y = ctx.ground; } // never leave roam() up on a window
    statue.remove();
  }

  // let go of in mid-air (outside the screensaver): the parachute opens and he floats down to the taskbar
  function* drop(vx) {
    yield* jump(Math.sign(vx), { hop: false, groundOnly: true });
    k.breathe(0);
  }

  // stop a roam mid-scene (he is grabbed with the mouse): hide the ladder, rope, chute and costume
  function cancel() {
    ladder.set(0);
    chute.set(0);
    hook.visible = false;
    rope.visible = false;
    puff.set(1);
    if (nunchaku) nunchaku.hide();
    if (ninja) { k.ninja(false); ninja = false; }
    k.karate(false);
    k.root.rotation.z = 0;
    k.breathe(0);
  }

  return { roam, battle, cancel, drop, setEdges: (list) => { raw = list; } };
}
