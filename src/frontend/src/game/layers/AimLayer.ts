/**
 * AIM LAYER
 * ---------
 * Single responsibility: convert structured input data into a normalised
 * launch direction vector.
 *
 * Reads:  RawInputData.dirX / dirY  (pre-normalised by InputLayer)
 * Emits:  AimData { normX, normY, aimAngleDeg }
 *
 * Rules:
 *  - Launch direction is the INVERSE of the swipe direction.
 *  - Vertical component is clamped so darts always travel toward the board.
 *  - No physics, no power, no UI here.
 *
 * Tuning knobs:
 *   MIN_UPWARD_Y  — minimum upward bias on the Y component.
 *                   -0.10 = fairly permissive; -0.50 = forces more upward arc.
 */

import type { RawInputData } from "./InputLayer";

// ── Tuning ─────────────────────────────────────────────────────────────────
export const AIM_CONFIG = {
  /**
   * Vertical launch component is clamped to at most this value.
   * Negative = upward. -0.10 allows nearly horizontal shots before forcing up.
   */
  MIN_UPWARD_Y: -0.1,
} as const;

// ── Output type ───────────────────────────────────────────────────────────────

export interface AimData {
  /** Normalised X component of launch direction (-1 left … +1 right) */
  normX: number;
  /** Normalised Y component of launch direction (always ≤ MIN_UPWARD_Y) */
  normY: number;
  /** Angle in degrees of launch direction (0 = right, -90 = straight up) */
  aimAngleDeg: number;
}

// ── Layer ─────────────────────────────────────────────────────────────────────

export class AimLayer {
  /**
   * Derive a clean aim direction from the completed gesture.
   *
   * InputLayer already normalised dirX/dirY to unit-length swipe direction.
   * This layer inverts it (swipe down = aim up) and clamps the vertical
   * component so the dart always travels toward the board.
   */
  calculate(input: RawInputData): AimData {
    // Invert swipe direction to get launch direction
    const launchX = -input.dirX;
    const launchY = -input.dirY;

    // Clamp: vertical must be sufficiently upward
    const clampedY = Math.min(launchY, AIM_CONFIG.MIN_UPWARD_Y);
    const clampedLen = Math.sqrt(launchX * launchX + clampedY * clampedY) || 1;

    const normX = launchX / clampedLen;
    const normY = clampedY / clampedLen;
    const aimAngleDeg = Math.atan2(normY, normX) * (180 / Math.PI);

    return { normX, normY, aimAngleDeg };
  }
}
