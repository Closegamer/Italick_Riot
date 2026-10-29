import * as THREE from 'three';
import { mesh, blob, sphere, ring, canvasTex } from './parts.js';

// Food delivery props: a little helicopter, a parachuted crate, a burger, a drink, a crumpled wrapper and a bin.

const std = (o) => new THREE.MeshStandardMaterial(o);
const RED = std({ color: 0xb3122a, roughness: 0.55 });
const WHITE = std({ color: 0xf3efe6, roughness: 0.75 });
const DARK = std({ color: 0x24252b, roughness: 0.7 });
const STEEL = std({ color: 0xb9c0c8, metalness: 0.7, roughness: 0.35 });
const GLASS = std({ color: 0x8fb6d8, metalness: 0.2, roughness: 0.15 });

const foodSign = canvasTex(256, 128, (g, w, h) => {
  g.fillStyle = '#b3122a';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '900 72px "Segoe UI", sans-serif';
  g.fillText('FOOD', w / 2, h / 2);
});

export function createHelicopter() {
  const root = new THREE.Group();
  root.visible = false;
  const body = new THREE.Group();
  root.add(body);

  blob(body, RED, [0, 0, 0], [0.78, 0.38, 0.42]); // cabin
  blob(body, GLASS, [0.52, 0.1, 0], [0.28, 0.24, 0.33]); // canopy
  mesh(new THREE.BoxGeometry(0.9, 0.11, 0.11), RED, body, [-0.75, 0.02, 0]); // tail boom
  mesh(new THREE.BoxGeometry(0.08, 0.34, 0.18), RED, body, [-1.2, 0.15, 0]); // tail fin
  mesh(new THREE.BoxGeometry(0.42, 0.03, 0.1), WHITE, body, [0.12, -0.32, 0.2]); // skid
  mesh(new THREE.BoxGeometry(0.42, 0.03, 0.1), WHITE, body, [0.12, -0.32, -0.2]);
  for (const z of [-0.2, 0.2]) for (const x of [-0.05, 0.3]) mesh(new THREE.BoxGeometry(0.035, 0.3, 0.035), WHITE, body, [x, -0.17, z]);
  for (const z of [-0.43, 0.43]) {
    const sign = mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map: foodSign }), body, [-0.05, 0.03, z]);
    sign.rotation.y = z > 0 ? 0 : Math.PI;
  }

  const rotor = new THREE.Group();
  rotor.position.set(0, 0.46, 0);
  body.add(rotor);
  mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 10), STEEL, rotor, [0, 0, 0]);
  mesh(new THREE.BoxGeometry(2.2, 0.035, 0.11), DARK, rotor, [0, 0.06, 0]);
  mesh(new THREE.BoxGeometry(0.11, 0.035, 2.2), DARK, rotor, [0, 0.06, 0]);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(-1.24, 0.16, 0.1);
  body.add(tailRotor);
  mesh(new THREE.BoxGeometry(0.03, 0.5, 0.05), DARK, tailRotor);
  mesh(new THREE.BoxGeometry(0.03, 0.05, 0.5), DARK, tailRotor);

  let size = 1;
  return {
    root,
    place: (x, y, z, s, dir = 1) => {
      size = s;
      root.position.set(x, y, z);
      root.scale.setScalar(s);
      root.rotation.y = dir < 0 ? Math.PI : 0;
      root.visible = true;
    },
    set: (g) => { root.visible = g > 0.01; root.scale.setScalar(size * Math.max(0.001, g)); },
    animate: (t) => {
      rotor.rotation.y = t * 28;
      tailRotor.rotation.x = t * 42;
      body.position.y = 0.02 * Math.sin(t * 3.1);
    },
    hide: () => { root.visible = false; },
  };
}

export function createFoodPack() {
  const root = new THREE.Group();
  root.visible = false;
  const cardboard = std({ color: 0xb58b5b, roughness: 0.85 });
  const tape = std({ color: 0xe0cfa8, roughness: 0.7 });
  const chuteMat = std({ color: 0xf3efe6, roughness: 0.8, side: THREE.DoubleSide });
  const chuteRed = std({ color: 0xb3122a, roughness: 0.8, side: THREE.DoubleSide });

  mesh(new THREE.BoxGeometry(0.55, 0.45, 0.4), cardboard, root, [0, 0.225, 0]);
  mesh(new THREE.BoxGeometry(0.56, 0.05, 0.1), tape, root, [0, 0.46, 0]);
  mesh(new THREE.BoxGeometry(0.05, 0.46, 0.41), tape, root, [0, 0.23, 0]);
  const lid = new THREE.Group();
  lid.position.set(0, 0.46, 0.2);
  root.add(lid);
  mesh(new THREE.BoxGeometry(0.56, 0.04, 0.42), cardboard, lid, [0, 0.02, -0.21]);
  mesh(new THREE.BoxGeometry(0.56, 0.02, 0.1), tape, lid, [0, 0.045, -0.2]);

  const chute = new THREE.Group();
  chute.position.set(0, 1.5, 0);
  root.add(chute);
  mesh(new THREE.SphereGeometry(0.8, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), chuteMat, chute, [0, 0, 0], [1, 0.55, 1]);
  for (const x of [-0.8, 0.8]) mesh(new THREE.SphereGeometry(0.8, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), chuteRed, chute, [x * 0.0, 0, 0], [0.28, 0.3, 0.28]);
  for (const [x, z] of [[-0.55, -0.35], [0.55, -0.35], [-0.55, 0.35], [0.55, 0.35]]) {
    mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.0, 6), DARK, chute, [x * 0.55, -0.5, z * 0.55]);
  }

  let size = 1;
  return {
    root,
    place: (x, y, z, s) => {
      size = s;
      root.position.set(x, y, z);
      root.scale.setScalar(s);
      root.visible = true;
      chute.visible = true;
      lid.rotation.x = 0;
    },
    set: (g) => { root.visible = g > 0.01; root.scale.setScalar(size * Math.max(0.001, g)); },
    open: () => { lid.rotation.x = -1.25; },
    close: () => { lid.rotation.x = 0; },
    collapseChute: () => { chute.visible = false; },
    animate: (t) => { if (chute.visible) chute.rotation.z = 0.08 * Math.sin(t * 2.3); },
    hide: () => { root.visible = false; },
  };
}

export function createBucket() {
  const root = new THREE.Group();
  root.visible = false;
  const bodyMat = std({ color: 0x355b46, roughness: 0.7 });
  const rimMat = std({ color: 0x243e31, roughness: 0.6 });
  mesh(new THREE.CylinderGeometry(0.27, 0.23, 0.55, 24), bodyMat, root, [0, 0.275, 0]);
  ring(root, rimMat, [0, 0.55, 0], [0, 1, 0], 0.27, 0.025);
  mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 24), rimMat, root, [0, 0.02, 0]); // base
  const lid = new THREE.Group();
  lid.position.set(0, 0.57, 0.26);
  root.add(lid);
  mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.035, 24), rimMat, lid, [0, 0.0, -0.26]);
  mesh(new THREE.BoxGeometry(0.09, 0.035, 0.06), rimMat, lid, [0, 0.035, -0.26]);
  let size = 1;
  return {
    root,
    place: (x, y, z, s) => { size = s; root.position.set(x, y, z); root.scale.setScalar(s); root.visible = true; },
    set: (g) => { root.visible = g > 0.01; root.scale.setScalar(size * Math.max(0.001, g)); },
    open: (on) => { lid.rotation.x = on ? -1.1 : 0; },
    hide: () => { root.visible = false; },
  };
}

export function createBurger() {
  const root = new THREE.Group();
  const bun = std({ color: 0xc9863f, roughness: 0.8 });
  const patty = std({ color: 0x5b2f20, roughness: 0.9 });
  const cheese = std({ color: 0xf2b93b, roughness: 0.6 });
  const lettuce = std({ color: 0x5aa64a, roughness: 0.8 });
  blob(root, bun, [0, 0.055, 0], [0.15, 0.055, 0.15]);
  mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.045, 20), patty, root, [0, 0.1, 0]);
  mesh(new THREE.BoxGeometry(0.25, 0.012, 0.25), cheese, root, [0, 0.13, 0]).rotation.y = 0.3;
  mesh(new THREE.TorusGeometry(0.13, 0.022, 8, 24), lettuce, root, [0, 0.145, 0]).rotation.x = Math.PI / 2;
  blob(root, bun, [0, 0.19, 0], [0.155, 0.075, 0.155]);
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4;
    blob(root, WHITE, [Math.cos(a) * 0.1, 0.245, Math.sin(a) * 0.1], [0.012, 0.006, 0.012]);
  }
  root.scale.setScalar(0.001);
  return root;
}

export function createDrink() {
  const root = new THREE.Group();
  const cup = std({ color: 0xf3efe6, roughness: 0.6 });
  const band = std({ color: 0xb3122a, roughness: 0.6 });
  mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.23, 20), cup, root, [0, 0.115, 0]);
  mesh(new THREE.CylinderGeometry(0.072, 0.07, 0.045, 20), band, root, [0, 0.15, 0]);
  mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.025, 20), cup, root, [0, 0.24, 0]);
  const straw = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.28, 8), band, root, [0.025, 0.34, 0]);
  straw.rotation.z = -0.25;
  root.scale.setScalar(0.001);
  return root;
}

export function createRubbish() {
  const root = new THREE.Group();
  const paper = std({ color: 0xd8d2c4, roughness: 0.95 });
  blob(root, paper, [0, 0.06, 0], [0.09, 0.07, 0.09]);
  blob(root, paper, [0.04, 0.1, 0.02], [0.05, 0.04, 0.05]);
  root.scale.setScalar(0.001);
  return root;
}
