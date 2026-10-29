import * as THREE from 'three';
import { mesh, sphere } from './parts.js';

// The flag he plants at the left edge of the screen: his brain (provider, model) and where he is online, for the user to see
// at a glance. Built in pixels like the monitor, so the text stays readable at every character size.
// Origin = the foot of the pole; the cloth flies to the right of the pole top.
const PH = 330, CW = 300, CH = 170; // pole height, cloth size, px
export const GRIP = 0.3 * PH; // where his hand holds the pole, px above its foot

export function createFlag() {
  const root = new THREE.Group();
  root.visible = false;
  const canvas = Object.assign(document.createElement('canvas'), { width: 1200, height: 680 });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  mesh(new THREE.CylinderGeometry(4, 4, PH, 12), new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.6 }), root, [0, PH / 2, 0]);
  mesh(sphere(8), new THREE.MeshStandardMaterial({ color: 0xd4a640, metalness: 1, roughness: 0.3 }), root, [0, PH + 6, 0]);
  const geo = new THREE.PlaneGeometry(CW, CH, 24, 1).translate(CW / 2, 0, 0);
  const cloth = mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.85 }), root, [0, PH - CH / 2 - 6, 0]);
  const flat = geo.attributes.position.array.slice();

  // info = { brain: [provider, model], place: text, ok: true (green) | false (red) | null (grey), caption + signature: optional slogan }
  function draw({ brain, place, ok, caption, signature }) {
    const g = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    g.fillStyle = '#fbf7ee';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#b3122a'; // his sweater red, along the pole
    g.fillRect(0, 0, 36, h);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const line = (text, px, weight, y, color) => {
      g.font = `${weight} ${px}px "Segoe UI", sans-serif`;
      g.font = `${weight} ${Math.floor(px * Math.min(1, (w - 140) / g.measureText(text).width))}px "Segoe UI", sans-serif`;
      g.fillStyle = color;
      g.fillText(text, w / 2 + 18, y);
    };
    if (caption) { // a slogan across the whole cloth, no title
      const wrap = (px) => {
        g.font = `800 ${px}px "Segoe UI", sans-serif`;
        const lines = [];
        let cur = '';
        for (const word of String(caption).split(/\s+/)) {
          const test = cur ? `${cur} ${word}` : word;
          if (cur && g.measureText(test).width > w - 190) { lines.push(cur); cur = word; }
          else cur = test;
        }
        if (cur) lines.push(cur);
        return lines;
      };
      let px = 96, lines = wrap(px);
      while (lines.length * px * 1.3 > 440 && px > 30) { px -= 4; lines = wrap(px); }
      const lh = px * 1.3, top = 50 + (440 - lines.length * lh) / 2;
      lines.forEach((text, i) => line(text, px, 800, top + lh * (i + 0.5), '#111111'));
      if (signature) {
        g.font = 'italic 700 58px "Segoe UI", sans-serif';
        const size = Math.floor(58 * Math.min(1, (w - 150) / g.measureText(signature).width));
        g.font = `italic 700 ${size}px "Segoe UI", sans-serif`;
        g.fillStyle = '#111111';
        g.fillText(signature, w / 2 + 18, 614);
      }
    } else {
      line(brain[0], 150, 800, 140, '#1e1f24');
      line(brain[1] ?? '', 110, 600, 300, '#3d5a86');
      if (place) {
        g.fillStyle = ok ? '#2e9d5b' : ok === false ? '#d64545' : '#6b7280';
        g.beginPath();
        g.roundRect(80, 420, w - 124, 170, 85);
        g.fill();
        line(place, 90, 700, 507, '#ffffff');
      }
    }
    tex.needsUpdate = true;
  }

  return {
    root,
    draw,
    place: (x, y, z) => root.position.set(x, y, z),
    width: CW,
    set: (grow) => {
      root.visible = grow > 0.01;
      root.scale.setScalar(Math.max(0.001, grow));
    },
    furl: (a) => { cloth.scale.x = Math.max(0.001, a); }, // 0 = rolled up against the pole, 1 = flying
    // wind: the free end flutters up/down and sideways, the cloth also sways a little on the pole
    wave: (t) => {
      const p = geo.attributes.position;
      const gust = 0.75 + 0.25 * Math.sin(t * 0.9) + 0.12 * Math.sin(t * 2.3 + 1);
      for (let i = 0; i < p.count; i++) {
        const x = flat[i * 3], y = flat[i * 3 + 1];
        const u = Math.min(1, Math.max(0, x / CW));
        const end = u * u; // the pole end stays put
        p.setX(i, x - end * 5 * Math.sin(t * 2.6 - x / 60));
        p.setY(i, y + end * 7 * gust * Math.sin(t * 4.1 - x / 52 + 0.8));
        p.setZ(i, u * (10 + 10 * gust) * Math.sin(t * 3.2 - x / 45));
      }
      p.needsUpdate = true;
      geo.computeVertexNormals();
      cloth.rotation.z = 0.02 * Math.sin(t * 1.2);
      cloth.rotation.y = 0.05 * Math.sin(t * 1.6 + 0.5);
    },
  };
}
