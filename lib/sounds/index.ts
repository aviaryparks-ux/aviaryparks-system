/**
 * Central sound manager for the web app.
 * Uses the Web Audio API to generate sounds without external files.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

/** Short "ding" sound for new messages */
export function playMessageSound() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    console.warn("Sound error:", e);
  }
}

/** Classic phone ringtone pattern for incoming calls */
let ringtoneInterval: ReturnType<typeof setInterval> | null = null;

function playRingBeep() {
  try {
    const ctx = getAudioContext();
    const freqs = [880, 1100];

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.value = freq;

      const start = ctx.currentTime + i * 0.15;
      const end = start + 0.13;

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.4, start + 0.02);
      gain.gain.setValueAtTime(0.4, end - 0.02);
      gain.gain.linearRampToValueAtTime(0, end);

      osc.start(start);
      osc.stop(end + 0.01);
    });
  } catch (e) {
    console.warn("Sound error:", e);
  }
}

export function startRingtone() {
  stopRingtone(); // Ensure no duplicate
  playRingBeep();
  ringtoneInterval = setInterval(() => {
    playRingBeep();
  }, 1800);
}

export function stopRingtone() {
  if (ringtoneInterval !== null) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
}

/** Short "pop" sound for system notifications */
export function playNotificationSound() {
  try {
    const ctx = getAudioContext();

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(600, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.15);

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(900, ctx.currentTime + 0.15);
    osc2.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.2);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.warn("Sound error:", e);
  }
}
