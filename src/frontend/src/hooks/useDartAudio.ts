import * as Tone from "tone";

let audioStarted = false;

async function ensureAudio(): Promise<void> {
  if (!audioStarted) {
    await Tone.start();
    audioStarted = true;
  }
}

export function useDartAudio() {
  const playThrow = async () => {
    try {
      await ensureAudio();
      // Sawtooth whoosh sweep downward — 100ms
      const synth = new Tone.Synth({
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.002, decay: 0.09, sustain: 0, release: 0.02 },
      }).toDestination();
      synth.volume.value = -8;

      const noiseSynth = new Tone.NoiseSynth({
        noise: { type: "pink" },
        envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.01 },
      }).toDestination();
      noiseSynth.volume.value = -22;

      const now = Tone.now();
      synth.frequency.setValueAtTime(320, now);
      synth.frequency.exponentialRampToValueAtTime(72, now + 0.1);
      synth.triggerAttackRelease("E4", "32n", now);
      noiseSynth.triggerAttackRelease("16n", now);

      setTimeout(() => {
        synth.dispose();
        noiseSynth.dispose();
      }, 600);
    } catch (_) {}
  };

  const playImpact = async () => {
    try {
      await ensureAudio();

      // Deep bass thud — low sine 60hz
      const bass = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.06 },
      }).toDestination();
      bass.volume.value = -4;

      // High crackle — short white noise burst
      const crackle = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.01 },
      }).toDestination();
      crackle.volume.value = -14;

      // Sub body knock
      const knock = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.04 },
      }).toDestination();
      knock.volume.value = -10;

      const now = Tone.now();
      bass.frequency.setValueAtTime(58, now);
      bass.frequency.exponentialRampToValueAtTime(30, now + 0.2);
      bass.triggerAttackRelease("C1", "8n", now);
      crackle.triggerAttackRelease("16n", now);
      knock.triggerAttackRelease("G1", "16n", now + 0.01);

      setTimeout(() => {
        bass.dispose();
        crackle.dispose();
        knock.dispose();
      }, 1200);
    } catch (_) {}
  };

  return { playThrow, playImpact };
}
