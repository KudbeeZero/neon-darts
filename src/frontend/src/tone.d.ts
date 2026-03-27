// tone is not installed — suppress type errors for the legacy useDartAudio hook
declare module "tone" {
  export const start: () => Promise<void>;
  export const now: () => number;
  export class Synth {
    constructor(opts?: object);
    volume: { value: number };
    frequency: {
      setValueAtTime: (v: number, t: number) => void;
      exponentialRampToValueAtTime: (v: number, t: number) => void;
    };
    toDestination(): this;
    triggerAttackRelease(note: string, duration: string, time?: number): void;
    dispose(): void;
  }
  export class NoiseSynth {
    constructor(opts?: object);
    volume: { value: number };
    toDestination(): this;
    triggerAttackRelease(duration: string, time?: number): void;
    dispose(): void;
  }
}
