/**
 * Play a short two-tone notification beep using Web Audio API.
 * Used to alert the user when Claude is waiting for input.
 * No audio files needed — synthesised on the fly.
 */
export function playNotificationBeep(): void {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.value = 0.25;

    // Two ascending tones: 660Hz then 880Hz
    const freqs = [660, 880];
    const toneDuration = 0.1; // seconds each

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);

      const start = ctx.currentTime + i * toneDuration;
      osc.start(start);
      osc.stop(start + toneDuration);
    });

    // Clean up after both tones finish
    const totalDuration = freqs.length * toneDuration;
    setTimeout(() => ctx.close().catch(() => {}), totalDuration * 1000 + 100);
  } catch {
    // Audio not available (e.g. no audio device) — silently ignore
  }
}
