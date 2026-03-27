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
 *   - Phaser's input system is left running but is never the source of truth
 *
 * Output event (RawInputData) contains:
 *   - Direction vector
 *   - Velocity magnitude (smoothed)
 *   - Swipe distance
 *   - Swipe duration
 *   - Start / end positions
 *   - Full position history
 *
 * Tuning knobs:
 *   HISTORY_LIMIT      — max pointer samples stored
 *   MIN_DRAG_PX        — minimum movement to register as a throw
 *   VELOCITY_TAIL      — tail samples used for velocity calculation
 *   VELOCITY_SMOOTH    — 0–1 EMA smoothing (0 = no smoothing, 1 = frozen)
 */

import type Phaser from "phaser";

// ── Tuning ─────────────────────────────────────────────────────────────────
export const INPUT_CONFIG = {
  HISTORY_LIMIT: 8, // max pointer samples stored per gesture
  MIN_DRAG_PX: 15, // minimum drag distance to count as a throw
  VELOCITY_TAIL: 4, // how many tail samples drive velocity calculation
  VELOCITY_SMOOTH: 0.25, // EMA alpha — lower = more smoothing
} as const;

// ── Output types ────────────────────────────────────────────────────────────

export interface PointerSample {
  x: number;
  y: number;
  t: number; // timestamp ms
}

/**
 * Fully structured throw-input event.
 * Every downstream layer reads from this — nothing else reaches them.
 */
export interface RawInputData {
  // Positions
  startX: number;
  startY: number;
  endX: number;
  endY: number;

  // Direction vector (normalised, raw — AimLayer will invert/clamp)
  dirX: number;
  dirY: number;

  // Velocity (smoothed, px/s)
  velocityX: number;
  velocityY: number;
  velocityMag: number;

  // Swipe summary
  swipeDistance: number;
  swipeDuration: number; // ms from touchstart → touchend

  // Full history for PowerLayer tail sampling
  history: PointerSample[];

  // Gate: did the gesture travel far enough to be a real throw?
  isValidThrow: boolean;
}

// ── Layer ───────────────────────────────────────────────────────────────────

export class InputLayer {
  // scene is kept for future use (e.g. coordinate transform if needed)
  private scene: Phaser.Scene;

  // Single-touch gate
  private activeTouchId: number | null = null;
  private active = false;

  // Gesture state
  private startX = 0;
  private startY = 0;
  private startT = 0;
  private history: PointerSample[] = [];

  // EMA-smoothed velocity
  private smoothVX = 0;
  private smoothVY = 0;

  // Bound handlers (stored so we can remove them)
  private _boundStart!: (e: TouchEvent) => void;
  private _boundMove!: (e: TouchEvent) => void;
  private _boundEnd!: (e: TouchEvent) => void;

  // ── Callbacks ─────────────────────────────────────────────────────────────
  /** Pointer pressed — use for camera engage, haptic, etc. */
  onDown: ((x: number, y: number) => void) | null = null;
  /** Pointer moving — use for aim indicator updates. */
  onMove: ((x: number, y: number) => void) | null = null;
  /** Gesture was too short; no throw emitted. */
  onCancel: (() => void) | null = null;
  /** Valid throw gesture completed — downstream pipeline starts here. */
  onThrow: ((data: RawInputData) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this._bindHandlers();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  enable() {
    // Document-level, capture phase, non-passive → maximum priority
    // These fire before ANY element (including Phaser canvas) can handle them
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
    document.removeEventListener("touchend", this._boundEnd, {
      capture: true,
    });
    document.removeEventListener("touchcancel", this._boundEnd, {
      capture: true,
    });
    this.active = false;
    this.activeTouchId = null;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _bindHandlers() {
    this._boundStart = (e: TouchEvent) => {
      // ALWAYS prevent default — blocks scroll, zoom, magnifier, gestures
      e.preventDefault();

      // Single-touch gate: ignore if we already have an active touch
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
      e.preventDefault(); // block scroll / momentum scroll during drag

      if (!this.active || this.activeTouchId === null) return;

      // Find OUR touch — ignore any additional fingers
      const touch = this._findTouch(e.changedTouches, this.activeTouchId);
      if (!touch) return;

      const now = Date.now();
      const prev = this.history[this.history.length - 1];

      this.history.push({ x: touch.clientX, y: touch.clientY, t: now });
      if (this.history.length > INPUT_CONFIG.HISTORY_LIMIT)
        this.history.shift();

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

      // Release the lock immediately so the next touch can be registered
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

      // Final velocity — recalculate from tail for accuracy
      const tail = this.history.slice(-INPUT_CONFIG.VELOCITY_TAIL);
      let finalVX = this.smoothVX;
      let finalVY = this.smoothVY;
      if (tail.length >= 2) {
        const tailDt = Math.max(10, tail[tail.length - 1].t - tail[0].t);
        finalVX = ((tail[tail.length - 1].x - tail[0].x) / tailDt) * 1000;
        finalVY = ((tail[tail.length - 1].y - tail[0].y) / tailDt) * 1000;
      }
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

  /** Find a touch with a specific identifier in a TouchList */
  private _findTouch(list: TouchList, id: number): Touch | null {
    for (let i = 0; i < list.length; i++) {
      if (list[i].identifier === id) return list[i];
    }
    return null;
  }
}
