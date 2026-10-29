import * as THREE from 'three';
import { mesh, sphere, blob, limb } from './parts.js';

// A simple uniformed policeman: navy tunic, peaked cap, gold badge, walking arms and legs.
export function createCop(variant = 0) {
  const root = new THREE.Group();
  root.visible = false;
  const turn = new THREE.Group();
  root.add(turn);
  const body = new THREE.Group();
  turn.add(body);

  const navy = new THREE.MeshStandardMaterial({ color: 0x223a63, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0d1322, roughness: 0.65 });
  const skin = new THREE.MeshStandardMaterial({ color: variant ? 0xd9a06a : 0xe3b383, roughness: 0.8 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd4a640, metalness: 0.7, roughness: 0.35 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf5f2ea, roughness: 0.4 });
  const black = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.4 });

  mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.5, 24), navy, body, [0, 0.95, 0]); // tunic
  mesh(new THREE.BoxGeometry(0.42, 0.09, 0.3), dark, body, [0, 0.72, 0]); // belt
  mesh(new THREE.BoxGeometry(0.08, 0.06, 0.02), gold, body, [0.09, 1.02, 0.2]); // badge
  for (const y of [0.88, 0.8]) mesh(sphere(0.018, 8), gold, body, [0, y, 0.225]); // buttons

  const arms = {};
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const g = new THREE.Group();
    g.position.set(sx * 0.24, 1.1, 0);
    body.add(g);
    limb(g, navy, [0, 0, 0], [0, -0.52, 0], 0.065, 0.05);
    blob(g, skin, [0, -0.58, 0.01], [0.05, 0.06, 0.04]);
    arms[s] = g;
  }

  const legs = {};
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const g = new THREE.Group();
    g.position.set(sx * 0.1, 0.7, 0);
    body.add(g);
    limb(g, navy, [0, 0, 0], [0, -0.62, 0], 0.08, 0.06);
    blob(g, black, [0, -0.66, 0.05], [0.085, 0.05, 0.14]);
    legs[s] = g;
  }

  const head = new THREE.Group();
  head.position.set(0, 1.28, 0);
  body.add(head);
  mesh(sphere(0.155, 28), skin, head);
  for (const s of [-1, 1]) {
    mesh(sphere(0.028, 12), white, head, [s * 0.055, 0.03, 0.14]);
    mesh(sphere(0.014, 10), black, head, [s * 0.055, 0.03, 0.165]);
  }
  mesh(sphere(0.02, 8), skin, head, [0, -0.01, 0.16]);
  blob(head, dark, [0, -0.005, -0.06], [0.16, 0.13, 0.13]); // hair under the cap
  mesh(new THREE.CylinderGeometry(0.165, 0.18, 0.09, 24), navy, head, [0, 0.15, 0]); // cap
  mesh(new THREE.BoxGeometry(0.22, 0.022, 0.13), dark, head, [0, 0.105, 0.12]); // brim
  mesh(sphere(0.024, 10), gold, head, [0, 0.15, 0.17]); // cap badge

  let facing = variant ? -1.05 : -1.1;
  const ease = (v, target, dt) => v + (target - v) * (1 - Math.exp(-dt * 9));

  function face(dir) { facing = dir * 1.1; }
  function walk(phase, dt) {
    const s = Math.sin(phase);
    legs.L.rotation.x = -0.45 * s;
    legs.R.rotation.x = 0.45 * s;
    arms.L.rotation.x = 0.35 * s;
    arms.R.rotation.x = -0.35 * s;
    body.position.y = 0.015 * Math.abs(Math.sin(phase * 2));
    head.rotation.x = 0.02 * Math.sin(phase * 2);
    turn.rotation.y = ease(turn.rotation.y, facing, dt);
  }
  function stand(t, dt) {
    const e = 1 - Math.exp(-dt * 8);
    for (const g of [legs.L, legs.R, arms.L, arms.R]) g.rotation.x += (0 - g.rotation.x) * e;
    for (const g of [arms.L, arms.R]) g.rotation.z += (0 - g.rotation.z) * e;
    body.position.y += (0 - body.position.y) * e;
    head.rotation.x += (0 - head.rotation.x) * e;
    head.rotation.y = 0.07 * Math.sin(t * 0.8 + variant);
    turn.rotation.y = ease(turn.rotation.y, facing, dt);
  }
  function read(t, dt) {
    head.rotation.x = ease(head.rotation.x, 0.18 + 0.04 * Math.sin(t * 2), dt);
    head.rotation.y = 0.1 * Math.sin(t * 1.3 + variant);
    turn.rotation.y = ease(turn.rotation.y, facing, dt);
  }
  function point(dt) {
    arms.R.rotation.z = ease(arms.R.rotation.z, -1.35, dt); // arm out towards the flag
    arms.R.rotation.x = ease(arms.R.rotation.x, -0.25, dt);
    head.rotation.y = ease(head.rotation.y, -0.35, dt);
    turn.rotation.y = ease(turn.rotation.y, facing, dt);
  }
  function laugh(t, dt) {
    body.rotation.z = 0.06 * Math.sin(t * 18 + variant);
    head.rotation.x = 0.08 + 0.05 * Math.sin(t * 12);
    head.rotation.y = 0.1 * Math.sin(t * 9);
    arms.L.rotation.x = 0.2 * Math.sin(t * 10);
    arms.R.rotation.x = -0.2 * Math.sin(t * 10 + 1);
    const e = 1 - Math.exp(-dt * 6);
    arms.L.rotation.z += (0 - arms.L.rotation.z) * e;
    arms.R.rotation.z += (0 - arms.R.rotation.z) * e;
    turn.rotation.y = ease(turn.rotation.y, facing, dt);
  }
  function reset() {
    for (const g of [legs.L, legs.R, arms.L, arms.R]) { g.rotation.set(0, 0, 0); }
    body.rotation.set(0, 0, 0);
    body.position.y = 0;
    head.rotation.set(0, 0, 0);
    turn.rotation.y = facing;
  }

  return {
    root, face, walk, stand, read, point, laugh,
    place: (x, y, scale, dir) => {
      root.position.set(x, y, 0);
      root.scale.setScalar(scale);
      root.visible = true;
      face(dir);
      reset();
    },
    hide: () => { root.visible = false; },
    x: () => root.position.x,
  };
}
