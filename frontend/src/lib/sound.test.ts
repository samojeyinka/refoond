import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The tones are synthesised through Web Audio, which jsdom does not implement.
 * A stub is enough to prove the module creates a context, schedules oscillators,
 * and honours the mute flag, all of which is where the real defects were.
 */
class FakeAudioParam {
  value = 0;
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}

class FakeNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class FakeOscillator extends FakeNode {
  type = 'sine';
  frequency = new FakeAudioParam();
  start = vi.fn();
  stop = vi.fn();
}

class FakeGain extends FakeNode {
  gain = new FakeAudioParam();
}

let oscillators: FakeOscillator[] = [];
let state: AudioContextState = 'running';

class FakeAudioContext {
  currentTime = 0;
  destination = new FakeNode();
  resume = vi.fn(async () => {
    state = 'running';
  });
  /** Mirrors the module-level flag the tests drive. */
  get state(): AudioContextState {
    return state;
  }
  createOscillator() {
    const osc = new FakeOscillator();
    oscillators.push(osc);
    return osc;
  }
  createGain() {
    return new FakeGain();
  }
}

async function loadModule() {
  vi.resetModules();
  oscillators = [];
  state = 'running';
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
  return import('./sound');
}

describe('chatSound', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('plays a tone for a received message', async () => {
    const { chatSound } = await loadModule();
    chatSound.receive();
    expect(oscillators.length).toBeGreaterThan(0);
    expect(oscillators.every((osc) => osc.start.mock.calls.length === 1)).toBe(true);
  });

  it('plays a distinct multi-note pattern for the assistant', async () => {
    const { chatSound } = await loadModule();
    chatSound.assistant();
    expect(oscillators).toHaveLength(3);
  });

  it('plays nothing while muted', async () => {
    const { chatSound } = await loadModule();
    chatSound.setMuted(true);
    chatSound.receive();
    chatSound.send();
    chatSound.assistant();
    expect(oscillators).toHaveLength(0);
  });

  it('persists the mute choice across reloads', async () => {
    const first = await loadModule();
    first.chatSound.setMuted(true);
    expect(window.localStorage.getItem('refoond.sound')).toBe('off');

    const second = await loadModule();
    expect(second.chatSound.isMuted()).toBe(true);
  });

  it('toggles and returns the new state', async () => {
    const { chatSound } = await loadModule();
    expect(chatSound.isMuted()).toBe(false);
    expect(chatSound.toggle()).toBe(true);
    expect(chatSound.toggle()).toBe(false);
  });

  /**
   * Regression: `resume()` is async, so the old guard bailed whenever the
   * context was not already running, silently dropping the first notification
   * after a user gesture.
   */
  it('still schedules a tone when the context is suspended and resuming', async () => {
    const { chatSound } = await loadModule();
    state = 'suspended';
    chatSound.receive();
    expect(oscillators.length).toBeGreaterThan(0);
  });

  it('does nothing once the context is closed', async () => {
    const { chatSound } = await loadModule();
    state = 'closed';
    chatSound.receive();
    expect(oscillators).toHaveLength(0);
  });
});
