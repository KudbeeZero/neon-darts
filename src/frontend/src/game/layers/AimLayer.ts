/**
 * AIM LAYER
 * ---------
 * Single responsibility: convert structured input data into a normalised
 * launch direction vector.
 *
 * SEPARATION FROM POWER:
 *   This layer outputs direction ONLY — it has no knowledge of velocity or
 *   power. The two must never interfere. AimLayer reads dirX/dirY (normalised
 *   swipe direction from InputLayer). PowerLayer reads velocityMag.
 *   Neither touches the other's input.
 *
 * FORWARD BIAS:
 *   A small horizontal bias nudges the dart toward the board center so that
 *   a perfectly vertical flick always hits the intended zone rather than
 *   drifting. This corrects for the natural tendency to flick slightly left
 *   or right without realising.
 *
 * Tuning knobs:
 *   MIN_UPWARD_Y    — vertical floor (negative = upward); keeps dart on-board
 *   HORIZONTAL_BIAS — subtle centering pull (0 = none, 0.12 = gentle nudge)
 *   MAX_HORIZONTAL  — clamps extreme left/right angles for arcade consistency
 */

import type { RawInputData } from "./InputLayer";

// ── Tuning ─────────────────────────────────────────────────────────────────
export const AIM_CONFIG = {
  /**
   * Vertical launch component is clamped to at most this value.
   * Negative = upward. -0.12 allows nearly horizontal shots before forcing up.
   */
  MIN_UPWARD_Y: -0.12,

  /**
   * Gentle centering pull. Reduces the X component by this fraction toward
   * zero, preventing extreme side angles without removing horizontal control.
   * 0 = disabled, 0.10 = 10% pull toward center.
   */
  HORIZONTAL_BIAS: 0.08,

  /**
   * Maximum absolute X component of the normalised aim vector.
   * Prevents unreachable side shots on small screens.
   */
  MAX_HORIZONTAL: 0.85,
} as const;

// ── Output type ───────────────────────────────────────────────────────────────

export interface AimData {
  /** Normalised X component of launch direction (-1 left … +1 right) */
  normX: number;
  /** Normalised Y component of launch direction (always ≤ MIN_UPWARD_Y) */
  normY: number;
  /** Angle in degrees (0 = right, -90 = straight up) */
  aimAngleDeg: number;
}

// ── Layer ─────────────────────────────────────────────────────────────────────

export class AimLayer {
  /**
   * 1. Invert swipe direction to get launch direction.
   * 2. Apply forward (centering) bias to X.
   * 3. Clamp X to MAX_HORIZONTAL.
   * 4. Clamp Y so dart always travels upward toward board.
   * 5. Re-normalise to unit length.
   */
  calculate(input: RawInputData): AimData {
    // Invert swipe → launch direction
    let launchX = -input.dirX;
    let launchY = -input.dirY;

    // Forward bias: pull X slightly toward center
    launchX = launchX * (1 - AIM_CONFIG.HORIZONTAL_BIAS);

    // Clamp horizontal extremes
    launchX = Math.max(
      -AIM_CONFIG.MAX_HORIZONTAL,
      Math.min(AIM_CONFIG.MAX_HORIZONTAL, launchX),
    );

    // Clamp vertical: must be sufficiently upward
    const clampedY = Math.min(launchY, AIM_CONFIG.MIN_UPWARD_Y);

    // Re-normalise
    const len = Math.sqrt(launchX * launchX + clampedY * clampedY) || 1;
    const normX = launchX / len;
    const normY = clampedY / len;
    const aimAngleDeg = Math.atan2(normY, normX) * (180 / Math.PI);

    return { normX, normY, aimAngleDeg };
  }
}
