"use client";

import { useCallback, useEffect, useRef } from "react";

type SoundStep = {
  frequency: number;
  duration: number;
  gain: number;
  delay?: number;
  type?: OscillatorType;
};

type BrowserWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

const SELECT_CUE: SoundStep[] = [
  { frequency: 540, duration: 0.06, gain: 0.018, type: "sine" },
];

const LOCK_CUE: SoundStep[] = [
  { frequency: 360, duration: 0.09, gain: 0.03, type: "triangle" },
  { frequency: 640, duration: 0.11, gain: 0.022, delay: 0.05, type: "sine" },
];

const REMOTE_LOCK_CUE: SoundStep[] = [
  { frequency: 190, duration: 0.12, gain: 0.032, type: "sawtooth" },
];

function scheduleCue(audioContext: AudioContext, cue: SoundStep[]) {
  const startTime = audioContext.currentTime + 0.01;

  for (const step of cue) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const offset = step.delay ?? 0;

    oscillator.type = step.type ?? "sine";
    oscillator.frequency.setValueAtTime(step.frequency, startTime + offset);

    gainNode.gain.setValueAtTime(0.0001, startTime + offset);
    gainNode.gain.exponentialRampToValueAtTime(step.gain, startTime + offset + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + offset + step.duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start(startTime + offset);
    oscillator.stop(startTime + offset + step.duration + 0.02);
  }
}

export function useQuizSounds() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(async () => {
    if (typeof window === "undefined") {
      return null;
    }

    const AudioContextConstructor =
      window.AudioContext ?? (window as BrowserWindow).webkitAudioContext;

    if (!AudioContextConstructor) {
      return null;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextConstructor();
    }

    if (audioContextRef.current.state === "suspended") {
      try {
        await audioContextRef.current.resume();
      } catch {
        return null;
      }
    }

    return audioContextRef.current;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const unlockAudio = () => {
      void getAudioContext();
    };

    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio);

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, [getAudioContext]);

  const playCue = useCallback(
    (cue: SoundStep[]) => {
      void getAudioContext().then((audioContext) => {
        if (!audioContext || audioContext.state !== "running") {
          return;
        }

        scheduleCue(audioContext, cue);
      });
    },
    [getAudioContext],
  );

  return {
    playSelectSound: () => playCue(SELECT_CUE),
    playLockSound: () => playCue(LOCK_CUE),
    playOtherLockSound: () => playCue(REMOTE_LOCK_CUE),
  };
}
