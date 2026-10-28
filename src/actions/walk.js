// Stroll to a random spot along the taskbar.
export default {
  name: 'walk',
  weight: 3,

  start(k, ctx) {
    const x = k.root.position.x, min = 0.08 * ctx.W, max = 0.92 * ctx.W;
    do this.to = min + Math.random() * (max - min); while (Math.abs(this.to - x) < 0.1 * ctx.W);
    this.phase = 0;
  },

  update(k, dt, ctx) {
    const p = k.root.position, dir = Math.sign(this.to - p.x), speed = 0.55 * ctx.SIZE; // px/s
    p.x += dir * Math.min(speed * dt, Math.abs(this.to - p.x));
    this.phase += ((speed * dt) / (0.75 * ctx.SIZE)) * Math.PI; // one stride ~0.75 units
    k.face(dir);
    k.look(0, 0);
    k.walk(this.phase, dt);
    return Math.abs(this.to - p.x) < 1;
  },

  stop() {},
};
