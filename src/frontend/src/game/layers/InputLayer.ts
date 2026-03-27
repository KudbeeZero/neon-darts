/**
 * INPUT LAYER
 * -----------
 * Single responsibility: capture raw touch input and emit structured data.
 * Does NOT move the dart, apply physics, or calculate aim/power.
 *
 * Implementation notes:
 *   - Uses native document-level touch handlers (NOT Phaser pointer events)
 *   - Registered with { capture: true, passive: false } for maximum priority
 *   - Calls preventDefault() on every event to block scroll / zoom / gestures
 *   - Tracks a SINGLE active touch by identifier — all other touches ignored
 *
 * VELOCITY CALCULATION (improved):
 *   - Stores a rolling history of pointer samples (capped at HISTORY_LIMIT)
 *   - On release, derives velocity from the most recent VELOCITY_TAIL frames
 *     weighted toward the LAST sample (recency weighting) so a sharp flick
 *     at the end of a slow drag is captured correctly.
 *   - EMA smoothing during drag reduces noise without adding lag.
 *
 * Output event (RawInputData) contains:
 *   - Direction vector (from total swipe)
 *   - Velocity magnitude (recency-weighted at release)
 *   - Swipe distance, duration
 *   - Start / end positions
 *   - Full position history
 *
 * Tuning knobs:
 *   HISTORY_LIMIT      — max pointer samples stored
 *   MIN_DRAG_PX        — minimum movement to register as a throw
 *   VELOCITY_TAIL      — tail samples used for velocity calculation at release
 *   VELOCITY_SMOOTH    — 0–1 EMA smoothing during drag (0 = no smooth, 1 = frozen)
 *   RECENCY_WEIGHT     — how strongly the last frame is weighted (1 = flat, 3 = 3x)
 */

import type Phaser from "phaser";

// ── Tuning ─────────────────────────────────────────────────────────────────
export const INPUT_CONFIG = {
  HISTORY_LIMIT: 10, // max pointer samples stored per gesture
  MIN_DRAG_PX: 12, // minimum drag distance to count as a throw
  VELOCITY_TAIL: 5, // tail samples used for release velocity
  VELOCITY_SMOOTH: 0.28, // EMA alpha during drag (lower = smoother)
  RECENCY_WEIGHT: 2.5, // final sample weight multiplier (recency bias)
} as const;

// ── Output types ────────────────────────────────────────────────────────────

export interface PointerSample {
  x: number;
  y: number;
  t: number;
}

/**
 * Fully structured throw-input event.
 * Every downstream layer reads from this — nothing else reaches them.
 */
export interface RawInputData {
  startX: number;
  startY: number;
  endX: number;
  endY: number;

  // Direction vector (normalised, raw — AimLayer will invert/clamp)
  dirX: number;
  dirY: number;

  // Velocity (recency-weighted, px/s)
  velocityX: number;
  velocityY: number;
  velocityMag: number;

  swipeDistance: number;
  swipeDuration: number;

  history: PointerSample[];
  isValidThrow: boolean;
}

// ── Layer ───────────────────────────────────────────────────────────────────

export class InputLayer {
  private scene: Phaser.Scene;

  private activeTouchId: number | null = null;
  private active = false;

  private startX = 0;
  private startY = 0;
  private startT = 0;
  private history: PointerSample[] = [];

  // EMA-smoothed velocity (used during drag for preview)
  private smoothVX = 0;
  private smoothVY = 0;

  private _boundStart!: (e: TouchEvent) => void;
  private _boundMove!: (e: TouchEvent) => void;
  private _boundEnd!: (e: TouchEvent) => void;

  onDown: ((x: number, y: number) => void) | null = null;
  onMove: ((x: number, y: number) => void) | null = null;
  onCancel: (() => void) | null = null;
  onThrow: ((data: RawInputData) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this._bindHandlers();
  }

  enable() {
    document.addEventListener("touchstart", this._boundStart, {
      capture: true,
      passive: false,
    });
    document.addEventListener("touchmove", this._boundMove, {
      capture: true,
      passive: false,
    });
    document.addEventListener("touchend", this._boundEnd, {
      capture: true,
      passive: false,
    });
    document.addEventListener("touchcancel", this._boundEnd, {
      capture: true,
      passive: false,
    });
  }

  disable() {
    document.removeEventListener("touchstart", this._boundStart, {
      capture: true,
    });
    document.removeEventListener("touchmove", this._boundMove, {
      capture: true,
    });
    document.removeEventListener("touchend", this._boundEnd, { capture: true });
    document.removeEventListener("touchcancel", this._boundEnd, {
      capture: true,
    });
    this.active = false;
    this.activeTouchId = null;
  }

  private _bindHandlers() {
    this._boundStart = (e: TouchEvent) => {
      e.preventDefault();
      if (this.activeTouchId !== null) return;

      const touch = e.changedTouches[0];
      if (!touch) return;

      this.activeTouchId = touch.identifier;
      this.active = true;
      this.startX = touch.clientX;
      this.startY = touch.clientY;
      this.startT = Date.now();
      this.history = [{ x: touch.clientX, y: touch.clientY, t: this.startT }];
      this.smoothVX = 0;
      this.smoothVY = 0;

      this.onDown?.(touch.clientX, touch.clientY);
    };

    this._boundMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!this.active || this.activeTouchId === null) return;

      const touch = this._findTouch(e.changedTouches, this.activeTouchId);
      if (!touch) return;

      const now = Date.now();
      const prev = this.history[this.history.length - 1];

      this.history.push({ x: touch.clientX, y: touch.clientY, t: now });
      if (this.history.length > INPUT_CONFIG.HISTORY_LIMIT)
        this.history.shift();

      // EMA smoothing during drag (for aim indicator preview)
      const dt = Math.max(1, now - prev.t);
      const instVX = ((touch.clientX - prev.x) / dt) * 1000;
      const instVY = ((touch.clientY - prev.y) / dt) * 1000;
      const a = INPUT_CONFIG.VELOCITY_SMOOTH;
      this.smoothVX = a * instVX + (1 - a) * this.smoothVX;
      this.smoothVY = a * instVY + (1 - a) * this.smoothVY;

      this.onMove?.(touch.clientX, touch.clientY);
    };

    this._boundEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (!this.active || this.activeTouchId === null) return;

      const touch = this._findTouch(e.changedTouches, this.activeTouchId);
      if (!touch) return;

      this.activeTouchId = null;
      this.active = false;

      const endT = Date.now();
      const dx = touch.clientX - this.startX;
      const dy = touch.clientY - this.startY;
      const swipeDistance = Math.sqrt(dx * dx + dy * dy);
      const swipeDuration = endT - this.startT;

      if (swipeDistance < INPUT_CONFIG.MIN_DRAG_PX || this.history.length < 2) {
        this.onCancel?.();
        return;
      }

      // ── Recency-weighted velocity at release ──────────────────────────────
      // The last VELOCITY_TAIL samples are used. The MOST RECENT interval is
      // weighted by RECENCY_WEIGHT so a sharp flick at the end of a slow drag
      // is captured accurately rather than diluted by earlier slow movement.
      const tail = this.history.slice(-INPUT_CONFIG.VELOCITY_TAIL);
      let wVX = 0;
      let wVY = 0;
      let wTotal = 0;

      for (let i = 1; i < tail.length; i++) {
        const segDt = Math.max(1, tail[i].t - tail[i - 1].t);
        const segVX = ((tail[i].x - tail[i - 1].x) / segDt) * 1000;
        const segVY = ((tail[i].y - tail[i - 1].y) / segDt) * 1000;
        // Linear ramp: weight increases toward the final segment
        const rawW = i / (tail.length - 1);
        // Apply recency boost to the last segment
        const w =
          i === tail.length - 1 ? rawW * INPUT_CONFIG.RECENCY_WEIGHT : rawW;
        wVX += segVX * w;
        wVY += segVY * w;
        wTotal += w;
      }

      const finalVX = wTotal > 0 ? wVX / wTotal : this.smoothVX;
      const finalVY = wTotal > 0 ? wVY / wTotal : this.smoothVY;
      const velocityMag = Math.sqrt(finalVX * finalVX + finalVY * finalVY);

      const dirLen = swipeDistance || 1;
      const dirX = dx / dirLen;
      const dirY = dy / dirLen;

      const data: RawInputData = {
        startX: this.startX,
        startY: this.startY,
        endX: touch.clientX,
        endY: touch.clientY,
        dirX,
        dirY,
        velocityX: finalVX,
        velocityY: finalVY,
        velocityMag,
        swipeDistance,
        swipeDuration,
        history: [...this.history],
        isValidThrow: true,
      };

      this.onThrow?.(data);
    };
  }

  private _findTouch(list: TouchList, id: number): Touch | null {
    for (let i = 0; i < list.length; i++) {
      if (list[i].identifier === id) return list[i];
    }
    return null;
  }
}
