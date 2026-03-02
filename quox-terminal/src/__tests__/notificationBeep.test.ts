import { describe, it, expect, vi, beforeEach } from "vitest";
import { playNotificationBeep } from "../utils/notificationBeep";

// Mock Web Audio API
const mockStop = vi.fn();
const mockStart = vi.fn();
const mockConnect = vi.fn();
const mockClose = vi.fn(() => Promise.resolve());

const mockOscillator = {
  type: "sine",
  frequency: { value: 0 },
  connect: mockConnect,
  start: mockStart,
  stop: mockStop,
};

const mockGain = {
  gain: { value: 1 },
  connect: mockConnect,
};

const mockAudioContext = {
  currentTime: 0,
  createOscillator: vi.fn(() => ({ ...mockOscillator })),
  createGain: vi.fn(() => ({ ...mockGain })),
  destination: {},
  close: mockClose,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.useFakeTimers();
  // @ts-expect-error — partial mock of AudioContext
  globalThis.AudioContext = vi.fn(() => mockAudioContext);
});

describe("playNotificationBeep", () => {
  it("creates an AudioContext and two oscillators (660Hz, 880Hz)", () => {
    playNotificationBeep();

    expect(mockAudioContext.createGain).toHaveBeenCalledOnce();
    expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(2);
  });

  it("sets the correct frequencies", () => {
    const oscillators: Array<{ frequency: { value: number } }> = [];
    mockAudioContext.createOscillator.mockImplementation(() => {
      const osc = { ...mockOscillator, frequency: { value: 0 } };
      oscillators.push(osc);
      return osc;
    });

    playNotificationBeep();

    expect(oscillators[0].frequency.value).toBe(660);
    expect(oscillators[1].frequency.value).toBe(880);
  });

  it("cleans up AudioContext after tones finish", () => {
    mockClose.mockClear();
    playNotificationBeep();

    expect(mockClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300); // 200ms tones + 100ms buffer
    expect(mockClose).toHaveBeenCalledOnce();
  });

  it("does not throw when AudioContext is unavailable", () => {
    // @ts-expect-error — simulating missing API
    globalThis.AudioContext = undefined;
    expect(() => playNotificationBeep()).not.toThrow();
  });
});
