// Stand, breathe and glance around.
export default {
  name: 'idle',
  weight: 2,

  start() {
    this.t = 0;
    this.len = 3 + Math.random() * 5;
    this.gaze = [0, 0];
    this.at = [0, 0];
    this.glance = 1;
  },

  update(k, dt) {
    const t = (this.t += dt);
    if ((this.glance -= dt) < 0) {
      this.glance = 1 + Math.random() * 2.5;
      this.at = [(Math.random() - 0.5) * 1.1, (Math.random() - 0.6) * 0.3];
    }
    this.gaze = this.gaze.map((g, i) => g + (this.at[i] - g) * Math.min(1, dt * 5));
    k.face(0);
    k.look(...this.gaze);
    k.breathe(Math.sin(t * 1.4));
    k.stand(t, dt);
    return t > this.len;
  },

  stop(k) { k.breathe(0); },
};
