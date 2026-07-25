// =====================================================================
// audio.js — seluruh efek suara disintesis dengan WebAudio API,
// jadi tidak ada satu pun file audio di repo ini.
// =====================================================================

let ctx = null;
let master = null;
export let muted = false;

export function initAudio() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);
}

export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.35;
  return muted;
}

// derau pendek — dasar untuk suara langkah, pecah blok, dll.
function noise(duration, filterType, freq, gain, sweepTo) {
  if (!ctx || muted) return;
  const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(freq, ctx.currentTime);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + duration);

  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  src.connect(filter); filter.connect(g); g.connect(master);
  src.start();
}

// nada sederhana — untuk UI, mob, makan
function tone(freq, duration, type = 'square', gain = 0.18, slideTo) {
  if (!ctx || muted) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(g); g.connect(master);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export const SFX = {
  step()    { noise(0.09, 'lowpass', 620 + Math.random() * 260, 0.16); },
  dig()     { noise(0.07, 'bandpass', 900 + Math.random() * 500, 0.10); },
  break_()  { noise(0.20, 'lowpass', 1500, 0.32, 320); },
  place()   { noise(0.11, 'lowpass', 900, 0.26, 420); },
  splash()  { noise(0.35, 'lowpass', 1800, 0.30, 260); },
  swim()    { noise(0.18, 'lowpass', 700, 0.12); },
  hurt()    { tone(320, 0.18, 'sawtooth', 0.20, 140); },
  death()   { tone(240, 0.7, 'sawtooth', 0.24, 70); },
  eat()     { noise(0.13, 'bandpass', 480, 0.18); },
  craft()   { tone(660, 0.09, 'triangle', 0.16); setTimeout(() => tone(880, 0.11, 'triangle', 0.16), 70); },
  click()   { tone(1000, 0.04, 'square', 0.10); },
  hit()     { noise(0.09, 'lowpass', 380, 0.26); },
  pop()     { tone(760, 0.07, 'sine', 0.16, 1200); },
  pig()     { tone(190, 0.16, 'sawtooth', 0.14, 260); },
  cow()     { tone(150, 0.45, 'sawtooth', 0.14, 110); },
  zombie()  { tone(110, 0.5, 'sawtooth', 0.16, 78); },
  furnace() { noise(0.5, 'lowpass', 300, 0.06); },
  levelup() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.14, 'triangle', 0.16), i * 90)); },
};
