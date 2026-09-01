// Sound utility for web notifications using Web Audio API & optional audio elements.

const SOUND_STORAGE_KEY = 'hivago_admin_sound_enabled';

let audioCtx: AudioContext | null = null;
let audioUnlocked = false;

export function isAudioUnlocked(): boolean {
  return audioUnlocked;
}

/**
 * Initializes and unlocks the Web Audio API AudioContext on user interaction.
 * Web browsers block audio until the user interacts with the document.
 */
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Unlock audio context on initial user interaction
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'running') {
      audioUnlocked = true;
    }
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };

  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
}

/**
 * Check if sound notifications are enabled by user.
 */
export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(SOUND_STORAGE_KEY);
  return stored !== 'false';
}

/**
 * Toggle sound notifications state.
 */
export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'true' : 'false');
}

export function toggleSound(): boolean {
  const newState = !isSoundEnabled();
  setSoundEnabled(newState);
  return newState;
}

/**
 * Synthesizes a clean dual-tone notification chime using Web Audio API.
 * Tone 1: D5 (587.33 Hz) -> Tone 2: A5 (880.00 Hz) with soft exponential decay.
 */
export function playNotificationSound(): void {
  if (!isSoundEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Resume if suspended
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Master Gain
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.25, now);
    masterGain.connect(ctx.destination);

    // --- First Tone (High D5 - 587.33Hz) ---
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);

    // Envelope for Osc 1
    gain1.gain.setValueAtTime(0.01, now);
    gain1.gain.exponentialRampToValueAtTime(0.4, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc1.connect(gain1);
    gain1.connect(masterGain);

    osc1.start(now);
    osc1.stop(now + 0.2);

    // --- Second Tone (Bright A5 - 880.00Hz) ---
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.0, now + 0.1);

    // Envelope for Osc 2
    gain2.gain.setValueAtTime(0.01, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.5, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc2.connect(gain2);
    gain2.connect(masterGain);

    osc2.start(now + 0.1);
    osc2.stop(now + 0.5);

  } catch (err) {
    console.warn('Could not play notification sound:', err);
  }
}

/**
 * Triggers test chime regardless of current mute state (forces playback to test sound output).
 */
export function testNotificationSound(): void {
  const currentState = isSoundEnabled();
  setSoundEnabled(true);
  playNotificationSound();
  if (!currentState) {
    // Restore muted state if it was originally muted
    setTimeout(() => setSoundEnabled(false), 600);
  }
}
