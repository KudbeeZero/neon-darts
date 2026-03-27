/**
 * SPIN LAYER
 * ----------
 * Single responsibility: manage dart rotation and visual spin during flight.
 *
 * The dart must always point toward the board (tip-first).
 * During flight the dart does a tight barrel twirl on its own axis
 * (scaleX flip → looks like a natural forward spin, NOT a side-to-side flip).
 *
 * Inputs:  Phaser.GameObjects.Image (the dart sprite), flight duration
 * Outputs: Phaser tweens that modify the sprite's transform only.
 *          No position, no physics, no scoring.
 *
 * Tuning knobs:
 *   BASE_ANGLE_DEG   — resting angle when dart points at board (tip up)
 *   TWIRL_CYCLES     — full scaleX oscillations per throw
 *   TWIRL_SCALE      — base sprite scale
 */

import type Phaser from "phaser";

// ── Tuning ───────────────────────────────────────────────────────────────────
export const SPIN_CONFIG = {
  /** Degrees: -90 means sprite points upward (tip toward board) */
  BASE_ANGLE_DEG: -90,
  /** How many twirl cycles during the full flight */
  TWIRL_CYCLES: 2,
  /** Default sprite display scale */
  TWIRL_SCALE: 0.28,
} as const;

// ── Layer ─────────────────────────────────────────────────────────────────────

export class SpinLayer {
  private sprite: Phaser.GameObjects.Image;
  private twirling = false;

  constructor(sprite: Phaser.GameObjects.Image) {
    this.sprite = sprite;
  }

  /** Reset to resting state at the throw origin */
  reset() {
    this.sprite.setAngle(SPIN_CONFIG.BASE_ANGLE_DEG);
    this.sprite.setScale(SPIN_CONFIG.TWIRL_SCALE);
    this.twirling = false;
  }

  /**
   * Start barrel-twirl animation that lasts exactly flightDurationMs.
   * The dart angle stays fixed at BASE_ANGLE_DEG — only scaleX oscillates
   * to create the impression of a tight forward spin.
   */
  startFlight(scene: Phaser.Scene, flightDurationMs: number) {
    if (this.twirling) return;
    this.twirling = true;

    const cycleDuration = flightDurationMs / SPIN_CONFIG.TWIRL_CYCLES;

    scene.tweens.add({
      targets: this.sprite,
      scaleX: { from: SPIN_CONFIG.TWIRL_SCALE, to: -SPIN_CONFIG.TWIRL_SCALE },
      duration: cycleDuration * 0.5,
      yoyo: true,
      repeat: SPIN_CONFIG.TWIRL_CYCLES - 1,
      ease: "Sine.easeInOut",
    });
  }

  /** Called on landing: lock scale back, stop any ongoing tweens */
  settleOnImpact(scene: Phaser.Scene) {
    scene.tweens.killTweensOf(this.sprite);
    this.sprite.setScale(SPIN_CONFIG.TWIRL_SCALE);
    this.sprite.setAngle(SPIN_CONFIG.BASE_ANGLE_DEG);
    this.twirling = false;
  }

  /** Update sprite position each frame (called from ThrowArcLayer onUpdate) */
  updatePosition(x: number, y: number) {
    this.sprite.setPosition(x, y);
  }

  show() {
    this.sprite.setVisible(true);
  }

  hide() {
    this.sprite.setVisible(false);
  }
}
