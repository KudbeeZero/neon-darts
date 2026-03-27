/**
 * POWER LAYER — no Phaser dependency
 */

export const POWER_CONFIG = {
  MIN_SPEED: 180,
  MAX_SPEED: 1600,
  CURVE_EXPONENT: 0.6,
  MIN_FLIGHT_MS: 280,
  MAX_FLIGHT_MS: 620,
  MIN_POWER_GATE: 0.04,
} as const;

export interface PowerData {
  speed: number;
  power: number;
  flightDurationMs: number;
}

export class PowerLayer {
  calculate(input: { velocityMag: number }): PowerData {
    const speed = Math.max(POWER_CONFIG.MIN_SPEED, input.velocityMag);
    const tLinear =
      Math.min(speed, POWER_CONFIG.MAX_SPEED) / POWER_CONFIG.MAX_SPEED;
    const power = tLinear ** POWER_CONFIG.CURVE_EXPONENT;
    const flightDurationMs =
      POWER_CONFIG.MAX_FLIGHT_MS +
      (POWER_CONFIG.MIN_FLIGHT_MS - POWER_CONFIG.MAX_FLIGHT_MS) * power;
    return { speed, power, flightDurationMs };
  }
}
