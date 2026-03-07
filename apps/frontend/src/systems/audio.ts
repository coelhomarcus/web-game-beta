const audioCtx = new (
  window.AudioContext || (window as any).webkitAudioContext
)();

export function playShootSound() {
  if (audioCtx.state === "suspended") audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(150, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.1);
}

/** AWP — deep, percussive bang + high-freq crack */
export function playAwpSound() {
  if (audioCtx.state === "suspended") audioCtx.resume();
  const t = audioCtx.currentTime;

  // Low boom
  const boom = audioCtx.createOscillator();
  const boomGain = audioCtx.createGain();
  boom.type = "sine";
  boom.frequency.setValueAtTime(80, t);
  boom.frequency.exponentialRampToValueAtTime(20, t + 0.35);
  boomGain.gain.setValueAtTime(0.9, t);
  boomGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  boom.connect(boomGain);
  boomGain.connect(audioCtx.destination);
  boom.start(t);
  boom.stop(t + 0.35);

  // High-frequency crack
  const crack = audioCtx.createOscillator();
  const crackGain = audioCtx.createGain();
  crack.type = "sawtooth";
  crack.frequency.setValueAtTime(1800, t);
  crack.frequency.exponentialRampToValueAtTime(200, t + 0.08);
  crackGain.gain.setValueAtTime(0.5, t);
  crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  crack.connect(crackGain);
  crackGain.connect(audioCtx.destination);
  crack.start(t);
  crack.stop(t + 0.08);
}

export function playGrenadeThrowSound() {
  if (audioCtx.state === "suspended") audioCtx.resume();
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(400, t);
  osc.frequency.exponentialRampToValueAtTime(150, t + 0.12);
  gain.gain.setValueAtTime(0.18, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.15);
}

export function playExplosionSound() {
  if (audioCtx.state === "suspended") audioCtx.resume();
  const t = audioCtx.currentTime;

  // Deep impact boom
  const boom = audioCtx.createOscillator();
  const boomGain = audioCtx.createGain();
  boom.type = "sine";
  boom.frequency.setValueAtTime(120, t);
  boom.frequency.exponentialRampToValueAtTime(15, t + 0.7);
  boomGain.gain.setValueAtTime(1.0, t);
  boomGain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
  boom.connect(boomGain);
  boomGain.connect(audioCtx.destination);
  boom.start(t);
  boom.stop(t + 0.7);

  // Noise burst (white-noise-like via many oscillators)
  for (let i = 0; i < 6; i++) {
    const n = audioCtx.createOscillator();
    const ng = audioCtx.createGain();
    n.type = "sawtooth";
    n.frequency.setValueAtTime(300 + Math.random() * 800, t);
    n.frequency.exponentialRampToValueAtTime(50, t + 0.4);
    ng.gain.setValueAtTime(0.15, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    n.connect(ng);
    ng.connect(audioCtx.destination);
    n.start(t);
    n.stop(t + 0.4);
  }
}

export function playReloadSound() {
  if (audioCtx.state === "suspended") audioCtx.resume();
  [0, 0.18].forEach((offset) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(600, audioCtx.currentTime + offset);
    osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + offset + 0.08);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + offset + 0.08);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime + offset);
    osc.stop(audioCtx.currentTime + offset + 0.08);
  });
}

/** Plays FUSRODAH at the start of the shout charge (when Z is pressed). */
export function playShoutChargeSound() {
  if (audioCtx.state === "suspended") audioCtx.resume();
  _fusrodahAudio.currentTime = 0;
  _fusrodahAudio.play().catch(() => { /* autoplay blocked */ });
}

/** Powerful dragon-shout roar that plays when the shout fires. */
const _fusrodahAudio = new Audio("/audio/FUSRODAH!.mp3");
_fusrodahAudio.volume = 0.3;

/** No-op: audio is already started during the charge phase. */
export function playShoutSound() {
  // Audio was triggered by playShoutChargeSound on Z press — nothing to do here.
}

/** Sharp metallic slash sound for katana normal attack. */
export function playKatanaSlashSound() {
  if (audioCtx.state === "suspended") audioCtx.resume();
  const t = audioCtx.currentTime;

  // High-pitched metallic swish
  const swish = audioCtx.createOscillator();
  const swishGain = audioCtx.createGain();
  swish.type = "sawtooth";
  swish.frequency.setValueAtTime(2200, t);
  swish.frequency.exponentialRampToValueAtTime(400, t + 0.12);
  swishGain.gain.setValueAtTime(0.35, t);
  swishGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  swish.connect(swishGain);
  swishGain.connect(audioCtx.destination);
  swish.start(t);
  swish.stop(t + 0.15);

  // Low body thud
  const thud = audioCtx.createOscillator();
  const thudGain = audioCtx.createGain();
  thud.type = "sine";
  thud.frequency.setValueAtTime(120, t);
  thud.frequency.exponentialRampToValueAtTime(40, t + 0.1);
  thudGain.gain.setValueAtTime(0.25, t);
  thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  thud.connect(thudGain);
  thudGain.connect(audioCtx.destination);
  thud.start(t);
  thud.stop(t + 0.1);
}

/** Rising charge sound for katana leap attack (right-click hold). */
export function playKatanaChargeSound() {
  if (audioCtx.state === "suspended") audioCtx.resume();
  const t = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(200, t);
  osc.frequency.exponentialRampToValueAtTime(800, t + 0.6);
  gain.gain.setValueAtTime(0.2, t);
  gain.gain.linearRampToValueAtTime(0.4, t + 0.5);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.65);
}
