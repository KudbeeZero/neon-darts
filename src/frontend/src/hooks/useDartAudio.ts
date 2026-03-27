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

      const bass = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.06 },
      }).toDestination();
      bass.volume.value = -4;

      const crackle = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.01 },
      }).toDestination();
      crackle.volume.value = -14;

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

  const playDouble = async () => {
    try {
      await ensureAudio();
      const synth = new Tone.Synth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.2 },
      }).toDestination();
      synth.volume.value = -10;
      const now = Tone.now();
      synth.triggerAttackRelease("C5", "8n", now);
      setTimeout(() => synth.dispose(), 800);
    } catch (_) {}
  };

  const playTriple = async () => {
    try {
      await ensureAudio();
      const notes = ["C5", "E5", "G5"];
      const now = Tone.now();
      for (let i = 0; i < notes.length; i++) {
        const synth = new Tone.Synth({
          oscillator: { type: "triangle" },
          envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.1 },
        }).toDestination();
        synth.volume.value = -10;
        synth.triggerAttackRelease(notes[i], "16n", now + i * 0.08);
        setTimeout(() => synth.dispose(), 1200);
      }
    } catch (_) {}
  };

  const playBullseye = async () => {
    try {
      await ensureAudio();

      const bass = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 },
      }).toDestination();
      bass.volume.value = -2;

      const sweep = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.02, decay: 0.6, sustain: 0.2, release: 0.4 },
      }).toDestination();
      sweep.volume.value = -8;

      const choir = new Tone.NoiseSynth({
        noise: { type: "pink" },
        envelope: { attack: 0.05, decay: 0.4, sustain: 0.1, release: 0.3 },
      }).toDestination();
      choir.volume.value = -20;

      const now = Tone.now();
      bass.frequency.setValueAtTime(50, now);
      bass.frequency.exponentialRampToValueAtTime(25, now + 0.35);
      bass.triggerAttackRelease("C1", "4n", now);

      sweep.frequency.setValueAtTime(300, now);
      sweep.frequency.exponentialRampToValueAtTime(900, now + 0.6);
      sweep.triggerAttackRelease("D5", "2n", now);

      choir.triggerAttackRelease("4n", now + 0.05);

      setTimeout(() => {
        bass.dispose();
        sweep.dispose();
        choir.dispose();
      }, 2000);
    } catch (_) {}
  };

  return { playThrow, playImpact, playDouble, playTriple, playBullseye };
}
