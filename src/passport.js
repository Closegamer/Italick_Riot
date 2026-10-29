import * as THREE from 'three';
import { mesh, canvasTex } from './parts.js';

// A recognizable Russian passport: burgundy cover, gold double-headed eagle, РОССИЙСКАЯ ФЕДЕРАЦИЯ / ПАСПОРТ.
export function createPassport() {
  const root = new THREE.Group();
  root.visible = false;

  const pages = new THREE.MeshStandardMaterial({ color: 0xf0ead8, roughness: 0.9 });
  const cover = new THREE.MeshStandardMaterial({ color: 0x7a1020, roughness: 0.55 });
  mesh(new THREE.BoxGeometry(0.252, 0.332, 0.035), pages, root, [0, 0, -0.006]);
  mesh(new THREE.BoxGeometry(0.26, 0.34, 0.045), cover, root);

  const tex = canvasTex(512, 680, (g, w, h) => {
    const gold = '#d8ad4a', wine = '#7a1020';
    g.fillStyle = wine;
    g.fillRect(0, 0, w, h);
    const shine = g.createLinearGradient(0, 0, w, h);
    shine.addColorStop(0, 'rgba(255,255,255,0.10)');
    shine.addColorStop(0.45, 'rgba(255,255,255,0)');
    shine.addColorStop(1, 'rgba(0,0,0,0.16)');
    g.fillStyle = shine;
    g.fillRect(0, 0, w, h);

    // double gold frame
    g.strokeStyle = gold;
    g.lineWidth = 9;
    g.strokeRect(16, 16, w - 32, h - 32);
    g.lineWidth = 3;
    g.strokeRect(30, 30, w - 60, h - 60);

    g.fillStyle = gold;
    g.textAlign = 'center';
    g.font = '700 25px "Segoe UI", sans-serif';
    g.fillText('РОССИЙСКАЯ ФЕДЕРАЦИЯ', w / 2, 66);

    // the double-headed eagle
    const cx = w / 2, cy = 228;
    for (const s of [-1, 1]) {
      g.fillStyle = gold;
      g.beginPath();
      g.moveTo(cx + s * 18, cy + 15);
      g.bezierCurveTo(cx + s * 65, cy - 55, cx + s * 150, cy - 30, cx + s * 168, cy + 55);
      g.bezierCurveTo(cx + s * 132, cy + 38, cx + s * 102, cy + 50, cx + s * 78, cy + 98);
      g.bezierCurveTo(cx + s * 60, cy + 70, cx + s * 38, cy + 62, cx + s * 18, cy + 58);
      g.closePath();
      g.fill();
      // feather separations
      g.strokeStyle = wine;
      g.lineWidth = 5;
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.moveTo(cx + s * (36 + i * 19), cy + 18 + i * 9);
        g.quadraticCurveTo(cx + s * (86 + i * 18), cy + 4 + i * 16, cx + s * (128 + i * 8), cy + 48 + i * 9);
        g.stroke();
      }
    }
    g.fillStyle = gold;
    g.beginPath();
    g.ellipse(cx, cy + 52, 33, 58, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath(); // tail
    g.moveTo(cx - 27, cy + 92);
    g.lineTo(cx, cy + 158);
    g.lineTo(cx + 27, cy + 92);
    g.closePath();
    g.fill();

    g.strokeStyle = gold;
    g.lineWidth = 18;
    g.lineCap = 'round';
    for (const s of [-1, 1]) { // necks and heads
      g.beginPath();
      g.moveTo(cx + s * 12, cy + 18);
      g.quadraticCurveTo(cx + s * 30, cy - 30, cx + s * 40, cy - 58);
      g.stroke();
      g.beginPath();
      g.arc(cx + s * 43, cy - 68, 14, 0, Math.PI * 2);
      g.fillStyle = gold;
      g.fill();
      g.beginPath(); // beak
      g.moveTo(cx + s * 52, cy - 73);
      g.lineTo(cx + s * 70, cy - 67);
      g.lineTo(cx + s * 52, cy - 61);
      g.closePath();
      g.fill();
      // little crowns
      g.beginPath();
      g.moveTo(cx + s * 36, cy - 82);
      g.lineTo(cx + s * 43, cy - 96);
      g.lineTo(cx + s * 50, cy - 82);
      g.closePath();
      g.fill();
    }
    // chest shield
    g.fillStyle = wine;
    g.beginPath();
    g.ellipse(cx, cy + 40, 21, 29, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = gold;
    g.lineWidth = 4;
    g.stroke();

    g.fillStyle = gold;
    g.font = '800 70px "Segoe UI", sans-serif';
    g.fillText('ПАСПОРТ', w / 2, 470);
    g.font = '600 22px "Segoe UI", sans-serif';
    g.fillText('RUSSIAN FEDERATION', w / 2, 520);
  });
  mesh(new THREE.PlaneGeometry(0.24, 0.32), new THREE.MeshBasicMaterial({ map: tex }), root, [0, 0, 0.024]);

  return {
    root,
    set: (x, y, z, scale, angle = 0) => {
      root.position.set(x, y, z);
      root.scale.setScalar(scale);
      root.rotation.set(0, 0, angle);
    },
    show: () => { root.visible = true; },
    hide: () => { root.visible = false; },
  };
}
