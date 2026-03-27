/**
 * POWER LAYER
 * -----------
 * Single responsibility: derive throw strength from input velocity.
 *
 * Reads:  velocityMag   (pre-calculated by InputLayer or GameScene)
 * Emits:  PowerData { speed, power, flightDurationMs }
 *
 * POWER CURVE (non-linear):
 *   Raw speed is normalised 0→1 then passed through an ease curve:
 *     power = t^CURVE_EXPONENT
 *   With exponent < 1 (e.g. 0.60):
 *     - Small flicks (t ≈ 0.1–0.2) map to a wider output range → precise control
 *     - Medium flicks (t ≈ 0.5)   map naturally → standard throws
 *     - Hard flicks  (t ≈ 0.9–1)  compress slightly → high power, never spikes
 *
 * Tuning knobs:
 *   MIN_SPEED        — floor velocity so weak throws still register
 *   MAX_SPEED        — ceiling for 0–1 normalisation
 *   CURVE_EXPONENT   — < 1 = more control at low end (0.55–0.70 is ideal)
 *   MIN_FLIGHT_MS    — fastest possible flight (hard throw)
 *   MAX_FLIGHT_MS    — slowest possible flight (gentle lob)
 *   MIN_POWER_GATE   — discard taps below this normalised threshold
 */

import Phaser from "phaser";

// ── Tuning ───────────────────────────────────────────────────────────────────
export const POWER_CONFIG = {
  MIN_SPEED: 180, // px/s — floor so slow deliberate throws register
  MAX_SPEED: 1600, // px/s — ceiling; anything faster maps to power 1.0
  CURVE_EXPONENT: 0.6, // non-linear curve — lower = more low-end precision
  MIN_FLIGHT_MS: 280, // ms at full power
  MAX_FLIGHT_MS: 620, // ms at minimum power
  MIN_POWER_GATE: 0.04, // normalised — below this is treated as cancelled
} as const;

// ── Output type ───────────────────────────────────────────────────────────────────
export interface PowerData {
  /** Raw pointer speed in px/s (floored at MIN_SPEED) */
  speed: number;
  /** Normalised throw strength after curve, 0 = weakest, 1 = strongest */
  power: number;
  /** Dart flight duration in ms; higher power = shorter flight */
  flightDurationMs: number;
}

// ── Layer ───────────────────────────────────────────────────────────────────────
export class PowerLayer {
  calculate(input: { velocityMag: number }): PowerData {
    const speed = Math.max(POWER_CONFIG.MIN_SPEED, input.velocityMag);
    const tLinear =
      Math.min(speed, POWER_CONFIG.MAX_SPEED) / POWER_CONFIG.MAX_SPEED;
    const power = tLinear ** POWER_CONFIG.CURVE_EXPONENT;
    const flightDurationMs = Phaser.Math.Linear(
      POWER_CONFIG.MAX_FLIGHT_MS,
      POWER_CONFIG.MIN_FLIGHT_MS,
      power,
    );
    return { speed, power, flightDurationMs };
  }
}
