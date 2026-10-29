import * as THREE from 'three';
import { mesh } from './parts.js';

// A pair of nunchaku held in one hand: two short sticks joined by a chain. Drawn in scene pixels, sized by the character.
export function createNunchaku(size) {
  const root = new THREE.Group();
  root.visible = false;
  const stick = new THREE.MeshStandardMaterial({ color: 0x26262c, roughness: 0.45, metalness: 0.15 });
  const band = new THREE.MeshStandardMaterial({ color: 0xc9972f, roughness: 0.35, metalness: 0.7 });
  const chainMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.35, metalness: 1 });

  const grip = new THREE.Group(); // the stick in the hand
  root.add(grip);
  mesh(new THREE.CylinderGeometry(0.021, 0.024, 0.34, 10), stick, grip, [0, 0.17, 0]);
  mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.044, 10), band, grip, [0, 0.05, 0]);
  mesh(new THREE.SphereGeometry(0.026, 10, 8), band, grip, [0, 0.345, 0]);

  const free = new THREE.Group(); // the other stick, hinged at the top of the first
  free.position.y = 0.35;
  root.add(free);
  for (let i = 0; i < 4; i++) mesh(new THREE.TorusGeometry(0.022, 0.007, 6, 10), chainMat, free, [0, 0.035 + i * 0.028, 0]);
  const second = new THREE.Group();
  second.position.y = 0.15;
  free.add(second);
  mesh(new THREE.CylinderGeometry(0.021, 0.024, 0.34, 10), stick, second, [0, 0.17, 0]);
  mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.044, 10), band, second, [0, 0.33, 0]);
  mesh(new THREE.SphereGeometry(0.026, 10, 8), band, second, [0, 0.015, 0]);

  root.scale.setScalar(size);
  return {
    root,
    set: (x, y, z, angle, swing, spin, scale) => {
      if (scale) root.scale.setScalar(scale);
      root.position.set(x, y, z);
      root.rotation.set(0, spin ?? 0, angle);
      free.rotation.z = swing ?? 0;
    },
    hide: () => { root.visible = false; },
    show: () => { root.visible = true; },
  };
}
