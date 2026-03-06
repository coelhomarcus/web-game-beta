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

export function playAwpSound() {
  if (audioCtx.state === "suspended") audioCtx.resume();
  // Deep, sharp sniper crack
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(90, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);
  gain.gain.setValueAtTime(0.55, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.18);
  // High-frequency crack layer
  const crack = audioCtx.createOscillator();
  const crackGain = audioCtx.createGain();
  crack.type = "square";
  crack.frequency.setValueAtTime(1800, audioCtx.currentTime);
  crack.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.06);
  crackGain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  crackGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
  crack.connect(crackGain);
  crackGain.connect(audioCtx.destination);
  crack.start();
  crack.stop(audioCtx.currentTime + 0.06);
}

export function playReloadSound() {
  if (audioCtx.state === "suspended") audioCtx.resume();
  // Two short mechanical clicks simulate a reload
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

