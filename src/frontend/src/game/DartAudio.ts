/**
 * DART AUDIO MANAGER
 * Loads ElevenLabs-generated dart impact sounds and intro music.
 * Audio context is unlocked on first user interaction to satisfy browser autoplay policy.
 * Sounds are pre-loaded once and reused — no per-throw network requests.
 *
 * iOS Safari compatibility:
 *  - Web Audio API requires user gesture to resume context
 *  - HTMLAudioElement used for intro music (looping background track)
 *  - All AudioContext operations gated behind unlock()
 */

import type { ZoneResult } from "./core/ScoringGrid";

const SOUNDS = {
  impact: "/assets/audio/dart-impact.mp3",
  bullseye: "/assets/audio/dart-bullseye.mp3",
  wire: "/assets/audio/dart-wire.mp3",
} as const;

const INTRO_MUSIC_SRC = "/assets/audio/intro-music.mp3";

class DartAudioManager {
  private ctx: AudioContext | null = null;
  private buffers: Partial<Record<keyof typeof SOUNDS, AudioBuffer>> = {};
  private unlocked = false;

  // HTMLAudioElement for intro music — works reliably on iOS Safari for looping BG audio
  private introEl: HTMLAudioElement | null = null;
  private introFadeTimer: ReturnType<typeof setInterval> | null = null;

  /** Call once on first user interaction to unlock the AudioContext */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;

    try {
      this.ctx = new AudioContext();
    } catch {
      return;
    }

    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }

    void this._preload();
    this._prepareIntro();
  }

  private _prepareIntro(): void {
    if (this.introEl) return;
    const el = new Audio(INTRO_MUSIC_SRC);
    el.loop = true;
    el.volume = 0;
    el.preload = "auto";
    // iOS: must load() after setting src to allow play() without gesture requirement
    el.load();
    this.introEl = el;
  }

  private async _preload(): Promise<void> {
    if (!this.ctx) return;
    const entries = Object.entries(SOUNDS) as [keyof typeof SOUNDS, string][];
    await Promise.all(
      entries.map(async ([key, url]) => {
        try {
          const resp = await fetch(url);
          const ab = await resp.arrayBuffer();
          this.buffers[key] = await this.ctx!.decodeAudioData(ab);
        } catch {
          // Silently skip — game works without sound
        }
      }),
    );
  }

  /**
   * Play intro music on the menu screen.
   * Fades in over 1.5s. Safe to call multiple times — won't restart if already playing.
   */
  playIntro(): void {
    // Ensure audio element is ready (in case unlock() hasn't been called yet)
    if (!this.introEl) {
      this._prepareIntro();
    }

    const el = this.introEl;
    if (!el) return;

    // Cancel any in-progress fade
    if (this.introFadeTimer !== null) {
      clearInterval(this.introFadeTimer);
      this.introFadeTimer = null;
    }

    if (!el.paused) return; // Already playing

    el.currentTime = 0;
    el.volume = 0;

    const playPromise = el.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay blocked — will play on next user gesture (unlock handles this)
      });
    }

    // Fade in: 0 → 0.55 over 1.5s (30 steps × 50ms)
    const targetVol = 0.55;
    const steps = 30;
    let step = 0;
    this.introFadeTimer = setInterval(() => {
      step++;
      if (el) el.volume = Math.min(targetVol, (step / steps) * targetVol);
      if (step >= steps && this.introFadeTimer !== null) {
        clearInterval(this.introFadeTimer);
        this.introFadeTimer = null;
      }
    }, 50);
  }

  /**
   * Stop intro music when the player starts a game.
   * Fades out over 0.8s then pauses.
   */
  stopIntro(): void {
    const el = this.introEl;
    if (!el || el.paused) return;

    // Cancel any in-progress fade
    if (this.introFadeTimer !== null) {
      clearInterval(this.introFadeTimer);
      this.introFadeTimer = null;
    }

    // Fade out: current → 0 over 0.8s (16 steps × 50ms)
    const startVol = el.volume;
    const steps = 16;
    let step = 0;
    this.introFadeTimer = setInterval(() => {
      step++;
      if (el) el.volume = Math.max(0, startVol * (1 - step / steps));
      if (step >= steps) {
        if (el) {
          el.pause();
          el.currentTime = 0;
          el.volume = 0;
        }
        if (this.introFadeTimer !== null) {
          clearInterval(this.introFadeTimer);
          this.introFadeTimer = null;
        }
      }
    }, 50);
  }

  /** Play the appropriate dart impact sound for a given landing zone */
  playImpact(zone: ZoneResult): void {
    if (!this.ctx || this.ctx.state === "suspended") return;

    let key: keyof typeof SOUNDS = "impact";
    if (zone.ring === "bullseye" || zone.ring === "bull") {
      key = "bullseye";
    } else if (zone.ring === "double" || zone.ring === "triple") {
      key = "wire";
    }

    const buffer = this.buffers[key] ?? this.buffers.impact;
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    // Slight pitch variation for variety — ±3% random detune
    source.detune.value = (Math.random() - 0.5) * 60;

    // Gain: bullseye is louder for drama
    const gain = this.ctx.createGain();
    gain.gain.value = zone.ring === "bullseye" ? 1.0 : 0.75;

    source.connect(gain);
    gain.connect(this.ctx.destination);
    source.start(0);
  }
}

// Singleton — import and call dartAudio.unlock() on first touch,
// dartAudio.playIntro() on menu show, dartAudio.stopIntro() on game start,
// and dartAudio.playImpact(zone) on dart hit.
export const dartAudio = new DartAudioManager();
