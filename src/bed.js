import * as THREE from 'three';
import { mesh, canvasTex } from './parts.js';

// A small wooden bed for when the user is away: frame, mattress, pillow, blanket and a floating "Z z z".
export function createBed() {
  const root = new THREE.Group();
  root.visible = false;

  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.7 });
  const sheet = new THREE.MeshStandardMaterial({ color: 0xf2eee4, roughness: 0.9 });
  const blanket = new THREE.MeshStandardMaterial({ color: 0x3d5a86, roughness: 0.9 });
  const pillowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });

  const L = 1.6, D = 0.75; // length, depth (units)
  const leg = (x, z) => mesh(new THREE.BoxGeometry(0.1, 0.28, 0.1), wood, root, [x, 0.14, z]);
  for (const x of [-L / 2 + 0.12, L / 2 - 0.12]) for (const z of [-D / 2 + 0.09, D / 2 - 0.09]) leg(x, z);

  mesh(new THREE.BoxGeometry(L, 0.14, D), wood, root, [0, 0.28, 0]); // frame
  mesh(new THREE.BoxGeometry(L - 0.08, 0.16, D - 0.08), sheet, root, [0, 0.43, 0]); // mattress
  mesh(new THREE.BoxGeometry(0.1, 0.52, D), wood, root, [L / 2 + 0.04, 0.55, 0]); // headboard
  mesh(new THREE.BoxGeometry(0.1, 0.36, D), wood, root, [-L / 2 - 0.04, 0.44, 0]); // footboard
  mesh(new THREE.BoxGeometry(0.36, 0.11, 0.46), pillowMat, root, [L / 2 - 0.3, 0.56, 0]); // pillow
  mesh(new THREE.BoxGeometry(0.86, 0.09, D - 0.06), blanket, root, [-0.12, 0.56, 0]); // blanket

  const zzzTex = canvasTex(512, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#ffffff';
    g.font = 'italic 800 140px "Segoe UI", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('Z z z', w / 2, h / 2);
  });
  const zzzMat = new THREE.SpriteMaterial({ map: zzzTex, transparent: true, opacity: 0, depthWrite: false });
  const zzz = new THREE.Sprite(zzzMat);
  zzz.position.set(L / 2 - 0.25, 1.15, 0.5);
  zzz.scale.set(0.8, 0.4, 1);
  root.add(zzz);

  let size = 1, face = 1;

  function set(grow) {
    const g = Math.max(0.001, grow);
    root.visible = grow > 0.01;
    root.scale.set(size * face * g, size * g, size * g);
    if (grow <= 0.01) zzzMat.opacity = 0;
  }

  function place(x, y, z, s, f) {
    size = s;
    face = f;
    root.position.set(x, y, z);
    set(0.001);
  }

  // gently floating Zzz above the pillow
  function animate(t) {
    zzz.position.y = 1.15 + 0.1 * Math.sin(t * 1.3);
    zzzMat.opacity = 0.25 + 0.55 * Math.max(0, Math.sin(t * 1.1));
  }

  return {
    root,
    place,
    set,
    animate,
    hide: () => set(0),
    top: 0.51, // mattress + pillow top, in units
    length: L,
  };
}
