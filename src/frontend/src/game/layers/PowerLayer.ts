/**
 * POWER LAYER
 * -----------
 * Single responsibility: derive throw strength from input velocity.
 *
 * Reads:  RawInputData.velocityMag   (pre-calculated by InputLayer)
 *         RawInputData.history       (for tail-based override if needed)
 * Emits:  PowerData { speed, power, flightDurationMs }
 *
 * - "power"           is 0–1 normalised strength passed to other layers.
 * - "speed"           is raw px/s; useful for debugging.
 * - "flightDurationMs"is the dart's travel time, inversely proportional to power.
 *
 * Tuning knobs:
 *   MIN_SPEED     — floor velocity so weak throws still register
 *   MAX_SPEED     — ceiling used to normalise 0-1 power
 *   MIN_FLIGHT_MS — fastest possible flight (hard, fast throw)
 *   MAX_FLIGHT_MS — slowest possible flight (gentle lob)
 */

import Phaser from "phaser";
import type { RawInputData } from "./InputLayer";

// ── Tuning ─────────────────────────────────────────────────────────────────
export const POWER_CONFIG = {
  MIN_SPEED: 200, // px/s — floor so even slow gestures throw
  MAX_SPEED: 1500, // px/s — ceiling for 0–1 power normalisation
  MIN_FLIGHT_MS: 300, // ms — dart travel time at full power
  MAX_FLIGHT_MS: 600, // ms — dart travel time at minimum power
} as const;

// ── Output type ───────────────────────────────────────────────────────────────

export interface PowerData {
  /** Raw pointer speed in px/s (from InputLayer, floored at MIN_SPEED) */
  speed: number;
  /** Normalised throw strength, 0 = weakest, 1 = strongest */
  power: number;
  /** Dart flight duration in ms; higher power = shorter flight */
  flightDurationMs: number;
}

// ── Layer ─────────────────────────────────────────────────────────────────────

export class PowerLayer {
  /**
   * InputLayer already computed velocityMag with EMA smoothing.
   * Apply floor, normalise to [0,1], then map to flight duration.
   */
  calculate(input: RawInputData): PowerData {
    const speed = Math.max(POWER_CONFIG.MIN_SPEED, input.velocityMag);
    const power =
      Math.min(speed, POWER_CONFIG.MAX_SPEED) / POWER_CONFIG.MAX_SPEED;
    const flightDurationMs = Phaser.Math.Linear(
      POWER_CONFIG.MAX_FLIGHT_MS,
      POWER_CONFIG.MIN_FLIGHT_MS,
      power,
    );

    return { speed, power, flightDurationMs };
  }
}
