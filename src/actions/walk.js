// Stroll to a random spot along the taskbar.
export default {
  name: 'walk',
  weight: 3,

  start(k, ctx) {
    const x = k.root.position.x, span = ctx.x2 - ctx.x1;
    let min = ctx.x1 + 0.08 * span, max = ctx.x2 - 0.08 * span; // the taskbar, or his window
    if (ctx.pointer) { // he follows the mouse: strolls stay within a couple of steps of it
      const near = ctx.pointer.x, r = 1.5 * ctx.SIZE;
      min = Math.max(min, Math.min(max - r, near - r));
      max = Math.min(max, Math.max(min + r, near + r));
    }
    this.to = min + Math.random() * (max - min);
    if (Math.abs(this.to - x) < 0.3 * ctx.SIZE) this.to = Math.abs(min - x) > Math.abs(max - x) ? min : max; // a stroll, not a shuffle
    this.phase = 0;
  },

  update(k, dt, ctx) {
    const p = k.root.position, dir = Math.sign(this.to - p.x), speed = 0.65 * ctx.SIZE; // px/s
    p.x += dir * Math.min(speed * dt, Math.abs(this.to - p.x));
    this.phase += ((speed * dt) / (0.5 * ctx.SIZE)) * Math.PI; // one step ~0.5 units, matches the leg swing so feet don't slide
    k.face(dir);
    k.look(0, 0);
    k.walk(this.phase, dt);
    return Math.abs(this.to - p.x) < 1;
  },

  stop() {},
};
