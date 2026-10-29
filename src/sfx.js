// Small synthesized sounds for the statue fight: no audio files, everything is made with Web Audio.
let ac = null;
let noiseBuffer = null;

function audio() {
  if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}

function noise() {
  const a = audio();
  if (!noiseBuffer) {
    noiseBuffer = a.createBuffer(1, Math.floor(a.sampleRate * 0.7), a.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = a.createBufferSource();
  src.buffer = noiseBuffer;
  return src;
}

function envelope(param, t0, peak, dur) {
  param.setValueAtTime(0.0001, t0);
  param.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.012);
  param.exponentialRampToValueAtTime(0.0001, t0 + dur);
}

// a stick cutting the air
export function whoosh() {
  try {
    const a = audio(), t0 = a.currentTime;
    const src = noise(), band = a.createBiquadFilter(), gain = a.createGain();
    band.type = 'bandpass';
    band.Q.value = 1.1;
    band.frequency.setValueAtTime(420, t0);
    band.frequency.exponentialRampToValueAtTime(1900, t0 + 0.16);
    envelope(gain.gain, t0, 0.16, 0.2);
    src.connect(band).connect(gain).connect(a.destination);
    src.start(t0);
    src.stop(t0 + 0.22);
  } catch {}
}

// nunchaku hitting a rubber statue
export function thwack() {
  try {
    const a = audio(), t0 = a.currentTime;
    const src = noise(), band = a.createBiquadFilter(), gain = a.createGain();
    band.type = 'bandpass';
    band.Q.value = 0.8;
    band.frequency.value = 780;
    envelope(gain.gain, t0, 0.5, 0.11);
    src.connect(band).connect(gain).connect(a.destination);
    src.start(t0);
    src.stop(t0 + 0.14);
    const osc = a.createOscillator(), thump = a.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, t0);
    osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.12);
    envelope(thump.gain, t0, 0.4, 0.14);
    osc.connect(thump).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + 0.16);
  } catch {}
}

// the statue bursting into dust
export function smash() {
  try {
    const a = audio(), t0 = a.currentTime;
    const src = noise(), low = a.createBiquadFilter(), gain = a.createGain();
    low.type = 'lowpass';
    low.frequency.setValueAtTime(2600, t0);
    low.frequency.exponentialRampToValueAtTime(300, t0 + 0.5);
    envelope(gain.gain, t0, 0.65, 0.55);
    src.connect(low).connect(gain).connect(a.destination);
    src.start(t0);
    src.stop(t0 + 0.6);
    const osc = a.createOscillator(), boom = a.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, t0);
    osc.frequency.exponentialRampToValueAtTime(34, t0 + 0.4);
    envelope(boom.gain, t0, 0.55, 0.5);
    osc.connect(boom).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + 0.55);
  } catch {}
}

// the statue popping into existence (rubber)
export function boing() {
  try {
    const a = audio(), t0 = a.currentTime;
    const osc = a.createOscillator(), gain = a.createGain(), wobble = a.createOscillator(), depth = a.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t0);
    osc.frequency.exponentialRampToValueAtTime(420, t0 + 0.08);
    osc.frequency.exponentialRampToValueAtTime(120, t0 + 0.5);
    wobble.frequency.value = 14;
    depth.gain.value = 28;
    wobble.connect(depth).connect(osc.frequency);
    envelope(gain.gain, t0, 0.25, 0.55);
    osc.connect(gain).connect(a.destination);
    osc.start(t0);
    wobble.start(t0);
    osc.stop(t0 + 0.6);
    wobble.stop(t0 + 0.6);
  } catch {}
}

// a soft landing on a window edge
export function thump() {
  try {
    const a = audio(), t0 = a.currentTime;
    const osc = a.createOscillator(), gain = a.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t0);
    osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.16);
    envelope(gain.gain, t0, 0.3, 0.2);
    osc.connect(gain).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + 0.22);
  } catch {}
}

// a soft snore while he sleeps
export function snore() {
  try {
    const a = audio(), t0 = a.currentTime;
    const osc = a.createOscillator(), low = a.createBiquadFilter(), gain = a.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(88, t0);
    osc.frequency.linearRampToValueAtTime(58, t0 + 0.55);
    low.type = 'lowpass';
    low.frequency.value = 280;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.075, t0 + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
    osc.connect(low).connect(gain).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + 0.75);
  } catch {}
}

// a quiet footstep
export function step() {
  try {
    const a = audio(), t0 = a.currentTime;
    const src = noise(), low = a.createBiquadFilter(), gain = a.createGain();
    low.type = 'lowpass';
    low.frequency.value = 420;
    envelope(gain.gain, t0, 0.045, 0.09);
    src.connect(low).connect(gain).connect(a.destination);
    src.start(t0);
    src.stop(t0 + 0.1);
  } catch {}
}

// two low syllables of the policemen talking
export function mumble() {
  try {
    const a = audio(), t0 = a.currentTime;
    for (const [at, f] of [[0, 150], [0.15, 125]]) {
      const osc = a.createOscillator(), gain = a.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t0 + at);
      osc.frequency.linearRampToValueAtTime(f * 0.8, t0 + at + 0.1);
      envelope(gain.gain, t0 + at, 0.05, 0.12);
      osc.connect(gain).connect(a.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + 0.14);
    }
  } catch {}
}

// three short "ha-ha-ha" notes as they walk away
export function laugh() {
  try {
    const a = audio(), t0 = a.currentTime;
    for (const [at, f] of [[0, 240], [0.14, 215], [0.28, 190]]) {
      const osc = a.createOscillator(), gain = a.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t0 + at);
      osc.frequency.exponentialRampToValueAtTime(f * 0.72, t0 + at + 0.11);
      envelope(gain.gain, t0 + at, 0.07, 0.13);
      osc.connect(gain).connect(a.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + 0.15);
    }
  } catch {}
}

// the door creaking open
export function doorOpen() {
  try {
    const a = audio(), t0 = a.currentTime;
    const osc = a.createOscillator(), band = a.createBiquadFilter(), gain = a.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t0);
    osc.frequency.linearRampToValueAtTime(220, t0 + 0.25);
    osc.frequency.linearRampToValueAtTime(160, t0 + 0.6);
    const wobble = a.createOscillator(), depth = a.createGain();
    wobble.frequency.value = 9;
    depth.gain.value = 18;
    wobble.connect(depth).connect(osc.frequency);
    band.type = 'bandpass';
    band.frequency.value = 900;
    band.Q.value = 3;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.07, t0 + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.65);
    osc.connect(band).connect(gain).connect(a.destination);
    osc.start(t0);
    wobble.start(t0);
    osc.stop(t0 + 0.7);
    wobble.stop(t0 + 0.7);
  } catch {}
}

// the door shutting: a wooden thud and a latch
export function doorClose() {
  try {
    const a = audio(), t0 = a.currentTime;
    const src = noise(), low = a.createBiquadFilter(), gain = a.createGain();
    low.type = 'lowpass';
    low.frequency.setValueAtTime(900, t0);
    low.frequency.exponentialRampToValueAtTime(180, t0 + 0.18);
    envelope(gain.gain, t0, 0.32, 0.22);
    src.connect(low).connect(gain).connect(a.destination);
    src.start(t0);
    src.stop(t0 + 0.24);
    const osc = a.createOscillator(), thudGain = a.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, t0);
    osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.18);
    envelope(thudGain.gain, t0, 0.28, 0.22);
    osc.connect(thudGain).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + 0.24);
  } catch {}
}

// a short karate shout
export function kiai() {
  try {
    const a = audio(), t0 = a.currentTime;
    const osc = a.createOscillator(), band = a.createBiquadFilter(), gain = a.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, t0);
    osc.frequency.exponentialRampToValueAtTime(150, t0 + 0.18);
    band.type = 'bandpass';
    band.frequency.value = 900;
    band.Q.value = 2;
    envelope(gain.gain, t0, 0.09, 0.2);
    osc.connect(band).connect(gain).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + 0.22);
  } catch {}
}

// the flag pole driven into the ground, with the cloth snapping
export function flagPlant() {
  try {
    const a = audio(), t0 = a.currentTime;
    const osc = a.createOscillator(), gain = a.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, t0);
    osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.2);
    envelope(gain.gain, t0, 0.4, 0.25);
    osc.connect(gain).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + 0.26);
    const src = noise(), band = a.createBiquadFilter(), cloth = a.createGain();
    band.type = 'bandpass';
    band.frequency.value = 1200;
    band.Q.value = 0.7;
    envelope(cloth.gain, t0, 0.18, 0.18);
    src.connect(band).connect(cloth).connect(a.destination);
    src.start(t0);
    src.stop(t0 + 0.2);
  } catch {}
}

// a piece of cloth flapping
// helicopter rotor: low, chopped noise
export function heli() {
  try {
    const a = audio(), t0 = a.currentTime;
    const src = noise(), low = a.createBiquadFilter(), gain = a.createGain();
    low.type = 'lowpass';
    low.frequency.value = 260;
    gain.gain.setValueAtTime(0.0001, t0);
    for (let i = 0; i < 12; i++) {
      const t = t0 + i * 0.12;
      gain.gain.exponentialRampToValueAtTime(i % 2 ? 0.12 : 0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.04, t + 0.07);
    }
    src.connect(low).connect(gain).connect(a.destination);
    src.start(t0);
    src.stop(t0 + 1.5);
  } catch {}
}

// a bite of the burger
export function chomp() {
  try {
    const a = audio(), t0 = a.currentTime;
    const src = noise(), band = a.createBiquadFilter(), gain = a.createGain();
    band.type = 'bandpass';
    band.Q.value = 1.4;
    band.frequency.value = 420;
    envelope(gain.gain, t0, 0.22, 0.1);
    src.connect(band).connect(gain).connect(a.destination);
    src.start(t0);
    src.stop(t0 + 0.12);
  } catch {}
}

// a swallow
export function gulp() {
  try {
    const a = audio(), t0 = a.currentTime;
    const osc = a.createOscillator(), gain = a.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, t0);
    osc.frequency.exponentialRampToValueAtTime(120, t0 + 0.18);
    envelope(gain.gain, t0, 0.18, 0.22);
    osc.connect(gain).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + 0.24);
  } catch {}
}

// the delivery is finished: three short microwave-style beeps
export function beep() {
  try {
    const a = audio(), t0 = a.currentTime;
    for (let i = 0; i < 3; i++) {
      const at = t0 + i * 0.16;
      const osc = a.createOscillator(), gain = a.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1046;
      envelope(gain.gain, at, 0.16, 0.1);
      osc.connect(gain).connect(a.destination);
      osc.start(at);
      osc.stop(at + 0.12);
    }
  } catch {}
}

export function cloth() {
  try {
    const a = audio(), t0 = a.currentTime;
    const src = noise(), band = a.createBiquadFilter(), gain = a.createGain();
    band.type = 'bandpass';
    band.Q.value = 0.6;
    band.frequency.setValueAtTime(1100, t0);
    band.frequency.exponentialRampToValueAtTime(350, t0 + 0.3);
    envelope(gain.gain, t0, 0.16, 0.3);
    src.connect(band).connect(gain).connect(a.destination);
    src.start(t0);
    src.stop(t0 + 0.32);
  } catch {}
}
