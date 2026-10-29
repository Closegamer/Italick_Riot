import * as THREE from 'three';
import { mesh, sphere } from './parts.js';

// A door that appears out of nowhere, for him to leave through and come back by. Units match the character
// (the root is scaled by SIZE); origin = bottom centre of the doorway. An invisible wall around the doorway
// hides whatever is behind the door plane, so he really walks in and is gone once the door shuts.
const W = 0.8, H = 1.95, F = 0.07; // doorway width, height; frame thickness

export function createDoor() {
  const root = new THREE.Group();
  root.visible = false;
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.6 });
  const paint = new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.5 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xd4a640, metalness: 1, roughness: 0.3 });

  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(F, H + F, 0.12), paint, root, [s * (W + F) / 2, (H + F) / 2, 0]); // jambs
  mesh(new THREE.BoxGeometry(W + 2 * F, F, 0.12), paint, root, [0, H + F / 2, 0]); // head
  mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: 0x0b0c10 }), root, [0, H / 2, -2]); // darkness inside

  // the invisible wall: depth only, drawn before everything else
  const wall = new THREE.Shape([[-3, -0.5], [3, -0.5], [3, 3], [-3, 3]].map(([x, y]) => new THREE.Vector2(x, y)));
  wall.holes.push(new THREE.Path([[-W / 2, 0], [W / 2, 0], [W / 2, H], [-W / 2, H]].map(([x, y]) => new THREE.Vector2(x, y))));
  mesh(new THREE.ShapeGeometry(wall), new THREE.MeshBasicMaterial({ colorWrite: false }), root).renderOrder = -1;

  // the leaf, hinged on the left, swings inwards
  const leaf = new THREE.Group();
  leaf.position.x = -W / 2;
  root.add(leaf);
  mesh(new THREE.BoxGeometry(W, H, 0.04), wood, leaf, [W / 2, H / 2, 0]);
  for (const y of [0.55, 1.4]) mesh(new THREE.BoxGeometry(W * 0.7, 0.6, 0.012), wood, leaf, [W / 2, y, 0.026]); // panels
  mesh(sphere(0.035), brass, leaf, [W - 0.08, 0.95, 0.05]); // knob
  root.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });

  let size = 1;
  return {
    root,
    place: (x, y, z, px) => { root.position.set(x, y, z); size = px; },
    // grow: 0 = not there, 1 = full size; open: 0 = shut, 1 = wide open
    set: (grow, open) => {
      root.visible = grow > 0.01;
      root.scale.setScalar(size * Math.max(0.001, grow));
      leaf.rotation.y = open * 1.6;
    },
  };
}
