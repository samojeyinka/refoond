/**
 * Short notification tones for chat activity, synthesised with the Web Audio API
 * so there are no audio assets to ship or cache.
 *
 * Browsers refuse to start audio until the user has interacted with the page, so
 * the context is created lazily and resumed on demand. Muting is persisted
 * because an alert that cannot be turned off is a bug, not a feature.
 */

const STORAGE_KEY = 'refoond.sound';

type Tone = { frequency: number; startOffset: number; duration: number; peak: number };

let context: AudioContext | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'off';
  } catch {
    return false;
  }
}

function persistMuted(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, muted ? 'off' : 'on');
  } catch {
    /* private mode, nothing to do */
  }
}

function audioContext(): AudioContext | null {
  if (muted) return null;
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!context) {
    try {
      context = new Ctor();
    } catch {
      return null;
    }
  }
  if (context.state === 'suspended') void context.resume();
  return context;
}

function play(tones: Tone[]): void {
  const ctx = audioContext();
  if (!ctx) return;
  // `resume()` is async, so on the first play after a user gesture the context
  // is still reported as suspended. A dead context is the only real blocker:
  // tones scheduled on a suspended context play once it resumes, so waiting
  // for `running` here would silently swallow the first notification.
  if (ctx.state === 'closed' || ctx.state === 'interrupted') return;

  const now = ctx.currentTime;
  for (const tone of tones) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + tone.startOffset;
    const end = start + tone.duration;

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(tone.frequency, start);

    // Ramp rather than switch, otherwise the tone ends on an audible click.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(tone.peak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  }
}

/** Someone else's message arrived. Two rising notes so it reads as an arrival. */
function receive(): void {
  play([
    { frequency: 784, startOffset: 0, duration: 0.11, peak: 0.07 },
    { frequency: 1046.5, startOffset: 0.09, duration: 0.15, peak: 0.06 },
  ]);
}

/** The local user sent something. One short, lower blip. */
function send(): void {
  play([{ frequency: 523.25, startOffset: 0, duration: 0.09, peak: 0.05 }]);
}

/**
 * The assistant replied. Three quick notes a semitone apart, so it is
 * distinguishable from a human arriving without needing a second audio style.
 */
function assistant(): void {
  play([
    { frequency: 659.25, startOffset: 0, duration: 0.07, peak: 0.05 },
    { frequency: 698.46, startOffset: 0.07, duration: 0.07, peak: 0.05 },
    { frequency: 783.99, startOffset: 0.14, duration: 0.11, peak: 0.055 },
  ]);
}

export const chatSound = {
  receive,
  send,
  assistant,
  isMuted: (): boolean => muted,
  setMuted(next: boolean): void {
    muted = next;
    persistMuted();
  },
  toggle(): boolean {
    muted = !muted;
    persistMuted();
    return muted;
  },
};
