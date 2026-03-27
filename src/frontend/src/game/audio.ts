// Standalone audio using Web Audio API (no external dependency)
let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    )();
  }
  if (ctx.state === "suspended") {
    ctx.resume();
  }
  return ctx;
}

function createGain(volume: number): GainNode {
  const g = getCtx().createGain();
  g.gain.value = volume;
  g.connect(getCtx().destination);
  return g;
}

export function playThrowSound(): void {
  try {
    const c = getCtx();
    const gain = createGain(0.25);
    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(320, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(72, c.currentTime + 0.12);
    osc.connect(gain);
    osc.start();
    osc.stop(c.currentTime + 0.14);

    // noise burst
    const buf = c.createBuffer(1, c.sampleRate * 0.08, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const ng = createGain(0.06);
    src.connect(ng);
    src.start();
  } catch (_) {}
}

export function playImpactSound(): void {
  try {
    const c = getCtx();
    const gain = createGain(0.4);
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(58, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(28, c.currentTime + 0.22);
    osc.connect(gain);
    osc.start();
    osc.stop(c.currentTime + 0.25);

    const knock = c.createOscillator();
    knock.type = "sine";
    knock.frequency.value = 180;
    const kg = createGain(0.15);
    knock.connect(kg);
    knock.start();
    knock.stop(c.currentTime + 0.08);

    const buf = c.createBuffer(1, c.sampleRate * 0.07, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++)
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const ns = c.createBufferSource();
    ns.buffer = buf;
    const ng = createGain(0.12);
    ns.connect(ng);
    ns.start();
  } catch (_) {}
}

export function playDoubleSound(): void {
  try {
    const c = getCtx();
    const gain = createGain(0.2);
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 523;
    osc.connect(gain);
    osc.start();
    osc.stop(c.currentTime + 0.35);
  } catch (_) {}
}

export function playTripleSound(): void {
  try {
    const c = getCtx();
    const freqs = [523, 659, 784];
    freqs.forEach((f, i) => {
      const gain = createGain(0.18);
      const osc = c.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = f;
      osc.connect(gain);
      osc.start(c.currentTime + i * 0.08);
      osc.stop(c.currentTime + i * 0.08 + 0.25);
    });
  } catch (_) {}
}

export function playBullseyeSound(): void {
  try {
    const c = getCtx();
    // Low boom
    const boom = createGain(0.5);
    const bOsc = c.createOscillator();
    bOsc.type = "sine";
    bOsc.frequency.setValueAtTime(55, c.currentTime);
    bOsc.frequency.exponentialRampToValueAtTime(28, c.currentTime + 0.4);
    bOsc.connect(boom);
    bOsc.start();
    bOsc.stop(c.currentTime + 0.45);
    // Sweep
    const sweep = createGain(0.2);
    const sOsc = c.createOscillator();
    sOsc.type = "sine";
    sOsc.frequency.setValueAtTime(300, c.currentTime);
    sOsc.frequency.exponentialRampToValueAtTime(900, c.currentTime + 0.7);
    sOsc.connect(sweep);
    sOsc.start();
    sOsc.stop(c.currentTime + 0.75);
    // Chime
    [523, 659, 784, 1047].forEach((f, i) => {
      const g = createGain(0.12);
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      o.connect(g);
      o.start(c.currentTime + 0.1 + i * 0.07);
      o.stop(c.currentTime + 0.1 + i * 0.07 + 0.3);
    });
  } catch (_) {}
}
