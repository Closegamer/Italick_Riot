// Always-on listening for his name: cuts phrases out of the microphone stream with an energy gate that adapts to the
// room's noise, and hands each phrase (16 kHz mono float32) to `send`. The main process transcribes it locally.
const BLOCK = 4096; // samples per callback = 0.256 s at 16 kHz

function rms(x) {
  let s = 0;
  for (const v of x) s += v * v;
  return Math.sqrt(s / x.length);
}

// onSpeech(true) when someone starts talking, onSpeech(false) when that turned out too short to send
export async function startWake(send, onSpeech = () => {}) {
  let stream;
  try {
    // no noise suppression: it treats soft consonants like the "Шп" in a name as noise and mutes them; keep gain control
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
  } catch (e) {
    console.warn('wake word: no microphone', e);
    return () => {};
  }
  const ac = new AudioContext({ sampleRate: 16000 });
  const node = ac.createScriptProcessor(BLOCK, 1, 1); // ponytail: deprecated but needs no worklet file
  let floor = 0.003, pre = [], phrase = null, quiet = 0;
  node.onaudioprocess = (e) => {
    const x = new Float32Array(e.inputBuffer.getChannelData(0));
    const level = rms(x), loud = level > Math.max(0.004, floor * 2.5); // relative to the room's noise
    if (!loud) floor = floor * 0.95 + level * 0.05; // track the background noise
    if (!phrase) {
      pre.push(x); // keep ~0.5 s before the onset so the first syllable isn't clipped
      if (pre.length > 2) pre.shift();
      if (loud) { phrase = [...pre]; quiet = 0; onSpeech(true); }
      return;
    }
    phrase.push(x);
    quiet = loud ? 0 : quiet + 1;
    if (quiet >= 3 || phrase.length > 40) { // ~0.75 s pause ends a phrase; cap at ~10 s
      if (phrase.length > 4) {
        const all = new Float32Array(phrase.length * BLOCK);
        phrase.forEach((c, i) => all.set(c, i * BLOCK));
        send(all);
      } else onSpeech(false);
      phrase = null;
      pre = [];
    }
  };
  ac.createMediaStreamSource(stream).connect(node);
  node.connect(ac.destination); // a ScriptProcessor only runs while connected
  return () => { stream.getTracks().forEach((t) => t.stop()); ac.close(); };
}
