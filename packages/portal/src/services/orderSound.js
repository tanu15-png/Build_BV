let audio;

// Called only from normal staff interactions; no separate audio controls are needed.
export function unlockOrderSound() {
  try {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) return;
    if (!audio || audio.state === 'closed') audio = new Audio();
    if (audio.state !== 'running') void audio.resume().catch(() => {});
  } catch { /* Audio restrictions must never interrupt staff actions. */ }
}

export function playOrderChime() {
  if (!audio || audio.state !== 'running') return false;
  try {
    const start = audio.currentTime;
    for (const [offset, frequency] of [[0, 740], [0.19, 988]]) {
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start + offset);
      gain.gain.linearRampToValueAtTime(0.16, start + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + offset + 0.22);
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(start + offset); oscillator.stop(start + offset + 0.24);
    }
    return true;
  } catch { return false; }
}
