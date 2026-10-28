import * as THREE from 'three';

// Shared building blocks for procedural characters: primitives, canvas textures, painted heads.

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const UP = V(0, 1, 0), FWD = V(0, 0, 1);

export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}

export const sphere = (r = 1, seg = 24) => new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75));

export function mesh(geo, mat, parent, pos = [0, 0, 0], scale) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  if (scale) m.scale.set(...scale);
  parent.add(m);
  return m;
}

export const blob = (parent, mat, pos, scale) => mesh(sphere(), mat, parent, pos, scale);

export const aim = (m, from, dir) => m.quaternion.setFromUnitVectors(from, V(...dir).normalize());

export const sub = (b, a) => b.map((v, i) => v - a[i]);

export const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// tapered limb from a (radius ra) to b (radius rb) with rounded ends
export function limb(parent, mat, a, b, ra, rb) {
  const d = sub(b, a);
  const m = mesh(new THREE.CylinderGeometry(rb, ra, Math.hypot(...d), 20), mat, parent, lerp(a, b, 0.5));
  aim(m, UP, d);
  mesh(sphere(ra), mat, parent, a);
  mesh(sphere(rb), mat, parent, b);
  return m;
}

// ring (bangle, armlet, hem) around axis dir
export function ring(parent, mat, pos, dir, r, tube) {
  const m = mesh(new THREE.TorusGeometry(r, tube, 8, 36), mat, parent, pos);
  aim(m, FWD, dir);
  return m;
}

// paints features onto a head's sphere UVs (u=0.25 faces +z); draw() gets fill/stroke taking paths in head units
export function paintHead(A, B, jaw, skin, draw) {
  return canvasTex(2048, 1024, (g, W, H) => {
    g.fillStyle = skin;
    g.fillRect(0, 0, W, H);
    const P = (x, y) => {
      const lat = Math.asin(Math.max(-1, Math.min(1, y / B))), low = Math.max(0, -y / B);
      const X = x / A / (1 - jaw * low * low) / Math.cos(lat);
      return [(0.25 + Math.asin(Math.max(-1, Math.min(1, X))) / (2 * Math.PI)) * W, (0.5 - lat / Math.PI) * H];
    };
    const U = W / (2 * Math.PI * A); // px per head unit near the face centre
    const shape = (...cmds) => {
      g.beginPath();
      for (const [c, ...v] of cmds) {
        const q = [];
        for (let i = 0; i < v.length; i += 2) q.push(...P(v[i], v[i + 1]));
        ({ M: g.moveTo, L: g.lineTo, Q: g.quadraticCurveTo, C: g.bezierCurveTo })[c].apply(g, q);
      }
    };
    const fill = (style, ...cmds) => { shape(...cmds); g.fillStyle = style; g.fill(); };
    const stroke = (style, w, ...cmds) => { shape(...cmds); g.strokeStyle = style; g.lineWidth = w * U; g.lineCap = 'round'; g.stroke(); };
    draw({ g, P, U, fill, stroke });
  });
}

// egg-shaped head: tapered jaw, fuller cheeks
export function headGeo(A, B, C, jaw) {
  const g = new THREE.SphereGeometry(1, 72, 48);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), low = Math.max(0, -y);
    let z = p.getZ(i);
    if (z > 0) z *= 1 + 0.07 * Math.exp(-(((y + 0.3) / 0.35) ** 2));
    p.setXYZ(i, p.getX(i) * (1 - jaw * low * low) * A, y * B, z * C);
  }
  g.computeVertexNormals();
  return g;
}
