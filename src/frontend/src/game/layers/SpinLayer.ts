/**
 * SPIN LAYER
 * ----------
 * Manages dart rotation during real-time physics flight.
 *
 * New vertical sprite orientation (160×500, tip at BOTTOM when angle=0):
 *   - setAngle(180) → tip points UP into board, flights trail toward viewer
 *   - velocity tracking: setAngle(velocityAngleDeg - 90 + yawWobble)
 *     because the sprite's natural tip direction is 90° (down), so we subtract
 *     90° to align tip with the velocity vector.
 *
 * A scaleX oscillation simulates the dart spinning on its long axis (barrel roll).
 *
 * Tuning knobs (SPIN_CONFIG):
 *   WOBBLE_DEGREES    — side-to-side tip sway in degrees
 *   WOBBLE_FREQUENCY  — yaw oscillation cycles per second
 *   ROLL_FREQUENCY    — barrel roll cycles per second
 *   ROLL_DEPTH        — 0–1 compression at peak roll (0 = off)
 *   TWIRL_SCALE       — sprite scale during flight
 *   REST_SCALE        — sprite scale at rest before throw
 */

import type Phaser from "phaser";

export const SPIN_CONFIG = {
  /**
   * Max side-to-side wobble around the velocity angle (degrees).
   * Set to 0 for clean velocity-aligned orientation.
   * Raise to ~7 to add organic barrel sway.
   */
  WOBBLE_DEGREES: 8,
  /** Yaw oscillation cycles per second (only visible if WOBBLE_DEGREES > 0) */
  WOBBLE_FREQUENCY: 3.0,
  /** Barrel roll (scaleX) cycles per second — independent from yaw */
  ROLL_FREQUENCY: 8.0,
  /** How much scaleX compresses at peak roll (0 = none, 0.4 = visible spin) */
  ROLL_DEPTH: 0.55,
  /** Sprite scale in flight */
  TWIRL_SCALE: 0.2,
  /** Sprite scale at rest */
  REST_SCALE: 0.22,
} as const;

export class SpinLayer {
  private sprite: Phaser.GameObjects.Image;
  private flightStartTime = 0;
  private inFlight = false;
  private impactAngleDeg = 180;

  constructor(sprite: Phaser.GameObjects.Image) {
    this.sprite = sprite;
  }

  reset() {
    this.sprite.setAngle(180); // new vertical sprite: 180 = tip pointing up toward board
    this.sprite.setScale(SPIN_CONFIG.REST_SCALE);
    this.sprite.setAlpha(1);
    this.inFlight = false;
  }

  startFlight(
    _scene: Phaser.Scene,
    _flightDurationMs: number,
    impactAngleDeg: number,
  ) {
    this.inFlight = true;
    this.impactAngleDeg = impactAngleDeg;
    this.flightStartTime = performance.now();
    this.sprite.setScale(SPIN_CONFIG.TWIRL_SCALE);
  }

  /**
   * Called every frame from ThrowArcLayer.onUpdate with the ACTUAL
   * physics velocity. The dart tip orients along the velocity vector.
   *
   * For the new vertical sprite (tip at bottom, angle=0):
   *   velocityAngleDeg - 90 aligns the tip with the velocity direction.
   *
   * velX and velY are OPTIONAL for backwards compatibility.
   */
  updatePosition(x: number, y: number, velX?: number, velY?: number) {
    this.sprite.setPosition(x, y);
    if (!this.inFlight) return;

    const elapsed = (performance.now() - this.flightStartTime) / 1000;

    // ── Barrel roll (scaleX oscillation) ──────────────────────────────────────
    const rollPhase = elapsed * SPIN_CONFIG.ROLL_FREQUENCY * 2 * Math.PI;
    const rollFactor =
      1 - SPIN_CONFIG.ROLL_DEPTH * (1 - Math.abs(Math.cos(rollPhase)));
    this.sprite.setScale(
      SPIN_CONFIG.TWIRL_SCALE * rollFactor,
      SPIN_CONFIG.TWIRL_SCALE,
    );

    // ── Tip orientation: follows velocity vector ──────────────────────────────
    if (velX !== undefined && velY !== undefined) {
      const speed = Math.sqrt(velX * velX + velY * velY);
      if (speed > 5) {
        const velocityAngleDeg = (Math.atan2(velY, velX) * 180) / Math.PI;

        // Optional yaw wobble (0 by default for clean orientation)
        const yawWobble =
          SPIN_CONFIG.WOBBLE_DEGREES > 0
            ? Math.sin(elapsed * SPIN_CONFIG.WOBBLE_FREQUENCY * 2 * Math.PI) *
              SPIN_CONFIG.WOBBLE_DEGREES
            : 0;

        // -90 offset because new sprite tip is at bottom (90° from right)
        this.sprite.setAngle(velocityAngleDeg - 90 + yawWobble);
      }
    }
  }

  /**
   * Embed dart at rest angle: tip into board (pointing up), flights toward viewer.
   * For new vertical sprite: angle 180 = tip up = embedded look.
   */
  settleOnImpact(scene: Phaser.Scene, _impactAngleDeg?: number) {
    scene.tweens.killTweensOf(this.sprite);
    this.inFlight = false;
    this.sprite.setScale(SPIN_CONFIG.TWIRL_SCALE);
    this.sprite.setAngle(180); // tip up into board, flights trail toward viewer
  }

  show() {
    this.sprite.setVisible(true);
  }

  hide() {
    this.sprite.setVisible(false);
  }
}
