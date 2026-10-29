// Pull up the chair, sit and swing the legs for a while.
export default {
  name: 'sit',
  weight: 1,

  start() {
    this.t = 0;
    this.len = 8 + Math.random() * 12;
  },

  update(k, dt) {
    const t = (this.t += dt);
    k.face(0);
    k.look(0.25 * Math.sin(t * 0.4), -0.05);
    k.breathe(Math.sin(t * 1.3));
    k.sit(t, dt);
    return t > this.len;
  },

  stop(k) { k.breathe(0); },
};
