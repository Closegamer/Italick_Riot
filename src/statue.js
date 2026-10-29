import * as THREE from 'three';
import { mesh, canvasTex } from './parts.js';
import * as sfx from './sfx.js';

// A rubber statue of Anthropic: a coral "A" on a dark pedestal, with googly eyes and an ANTHROPIC plaque. It has the
// same gravity as the character (G), so it can be knocked off a window, land on the taskbar and burst into dust.
const G = 2600; // px/s², as in the character's fall

export function createStatue({ scene, size, platforms }) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  const rubber = new THREE.MeshPhysicalMaterial({ color: 0xd97757, roughness: 0.38, clearcoat: 0.55, clearcoatRoughness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x24252b, roughness: 0.6, metalness: 0.25 });
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const black = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.35 });

  const body = new THREE.Group();
  root.add(body);

  mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.12, 28), dark, body, [0, 0.06, 0]);
  const plaque = canvasTex(512, 96, (g, w, h) => {
    g.fillStyle = '#24252b';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f3ede6';
    g.font = '700 56px "Segoe UI", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('ANTHROPIC', w / 2, h / 2 + 3);
  });
  mesh(new THREE.PlaneGeometry(0.5, 0.095), new THREE.MeshBasicMaterial({ map: plaque }), body, [0, 0.06, 0.315]);

  // the logo-like A, with a rounded rubber bevel
  const shape = new THREE.Shape();
  shape.moveTo(-0.4, 0);
  shape.lineTo(-0.13, 1);
  shape.lineTo(0.13, 1);
  shape.lineTo(0.4, 0);
  shape.lineTo(0.2, 0);
  shape.lineTo(0.13, 0.22);
  shape.lineTo(-0.13, 0.22);
  shape.lineTo(-0.2, 0);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 4, curveSegments: 4 });
  geometry.translate(0, 0.12, -0.1);
  mesh(geometry, rubber, body, [0, 0, 0]);

  // googly eyes and a little mouth, so it is something to punch rather than just a logo
  for (const side of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.078, 16, 12), white, body, [side * 0.1, 0.66, 0.13]);
    mesh(new THREE.SphereGeometry(0.036, 12, 10), black, body, [side * 0.1, 0.66, 0.195]);
  }
  mesh(new THREE.BoxGeometry(0.1, 0.022, 0.02), black, body, [0, 0.47, 0.17]);

  // dust
  const dust = new THREE.Group();
  dust.visible = false;
  root.add(dust);
  const dustMat = new THREE.MeshStandardMaterial({ color: 0xc9c2b5, roughness: 1, transparent: true, opacity: 0, depthWrite: false });
  const bits = [];
  for (let i = 0; i < 46; i++) {
    const bit = mesh(new THREE.TetrahedronGeometry(0.018 + Math.random() * 0.032), dustMat, dust, [0, 0, 0]);
    bit.visible = false;
    bit.userData.v = new THREE.Vector3();
    bits.push(bit);
  }

  let x = 0, y = 0, vy = 0, id = null, hp = 5;
  let alive = true, falling = false, gone = false, dusting = false;
  let appear = 0, wobble = 0, wobT = 0, dustT = 0;

  const support = () => platforms().find((p) => p.id === id && x >= p.x1 - 2 && x <= p.x2 + 2) ?? null;

  function place(x0, y0, pid) {
    x = x0;
    y = y0;
    id = pid;
    vy = 0;
    falling = false;
    root.position.set(x, y, 0);
    root.visible = true;
    appear = 0;
  }

  function shatter() {
    if (!alive) return;
    alive = false;
    dusting = true;
    dustT = 0;
    body.visible = false;
    dust.visible = true;
    for (const bit of bits) {
      bit.visible = true;
      bit.position.set((Math.random() - 0.5) * 0.4, 0.08 + Math.random() * 0.85, (Math.random() - 0.5) * 0.3);
      bit.scale.setScalar(0.6 + Math.random());
      bit.userData.v.set((Math.random() - 0.5) * 1.6, 0.35 + Math.random() * 1.5, (Math.random() - 0.5) * 0.45);
    }
    dustMat.opacity = 0.95;
    sfx.smash();
  }

  function updateDust(dt) {
    dustT += dt;
    for (const bit of bits) {
      const v = bit.userData.v;
      v.y -= 2.2 * dt;
      bit.position.addScaledVector(v, dt);
      bit.rotation.x += dt * 4;
      bit.rotation.z += dt * 3;
    }
    dustMat.opacity = Math.max(0, 0.95 * (1 - dustT / 2.4));
    if (dustT > 2.6) {
      gone = true;
      root.visible = false;
    }
  }

  function update(dt) {
    if (gone) return;
    if (dusting) {
      updateDust(dt);
      return;
    }
    appear = Math.min(1, appear + dt * 2.6);
    const pop = 1 + 2.7 * (appear - 1) ** 3 + 1.7 * (appear - 1) ** 2;
    wobT += dt;
    wobble *= Math.exp(-dt * 3.2);
    const squash = 1 + 0.16 * wobble * Math.sin(wobT * 26);
    const base = size * pop;
    root.scale.set(base / Math.sqrt(squash), base * squash, base / Math.sqrt(squash));
    root.rotation.z = 0.22 * wobble * Math.sin(wobT * 18);

    if (!falling) {
      const sup = support();
      if (!sup) {
        falling = true; // the window under it is gone: down it goes
        vy = 0;
      } else {
        id = sup.id;
        y = sup.y;
      }
    }
    if (falling) {
      const y0 = y;
      vy -= G * dt;
      y += vy * dt;
      const land = platforms()
        .filter((p) => x >= p.x1 && x <= p.x2 && p.y <= y0 && p.y >= y)
        .sort((a, b) => b.y - a.y)[0];
      if (land) {
        y = land.y;
        id = land.id;
        falling = false;
        vy = 0;
        wobble = 1;
        if (land.id === 'ground') shatter(); // the taskbar smashes it
        else sfx.thump();
      }
    }
    root.position.set(x, y, 0);
  }

  // one nunchaku hit: squashes, gets knocked back, and can be pushed off the edge
  function hit(dir) {
    if (!alive) return;
    hp -= 1;
    wobble = 1;
    wobT = 0;
    x += dir * 0.09 * size;
    if (!falling && !support()) falling = true;
    if (hp <= 0) shatter();
  }

  function remove() {
    scene.remove(root);
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry?.dispose();
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material?.dispose();
    });
    dustMat.dispose();
  }

  return {
    place, update, hit, remove,
    x: () => x,
    y: () => y,
    hp: () => hp,
    alive: () => alive,
    falling: () => falling,
    gone: () => gone,
  };
}
