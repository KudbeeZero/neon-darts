import * as THREE from "three";
import type { PlannedThrow } from "../core/ArcPlanner";
import type { ZoneResult } from "../core/ScoringGrid";

// ── Flight constants (early production values) ──────────────────────────────
const YAW_WOBBLE_AMPLITUDE = 0.14; // ±8° in radians
const YAW_WOBBLE_FREQUENCY = Math.PI * 5; // 5 full cycles per flight
const YAW_WOBBLE_DAMPEN = 0.45; // dampening: (1 - t * 0.45)
const BARREL_ROLL_SPEED = Math.PI * 12; // 12π rad = 6 full rotations per flight

export interface AnimFrame {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  t: number;
  complete: boolean;
  landingZone: ZoneResult;
  tangentY: number;
}

export class ThrowAnimation {
  readonly plannedThrow: PlannedThrow;
  private readonly curve: THREE.CubicBezierCurve3;
  private readonly startTime: number;
  impactFired = false;

  // Pre-allocated to avoid GC pressure in render loop
  private readonly _pos = new THREE.Vector3();
  private readonly _tan = new THREE.Vector3();
  private readonly _quat = new THREE.Quaternion();
  private readonly _dartTip = new THREE.Vector3(0, 0, -1); // tip faces -Z by default
  private readonly _wobbleQuat = new THREE.Quaternion();
  private readonly _wobbleAxis = new THREE.Vector3(0, 1, 0);
  private readonly _embedQuat = new THREE.Quaternion();
  private readonly _embedAxis = new THREE.Vector3(1, 0, 0); // X-axis tilt for tip-down embed

  constructor(plannedThrow: PlannedThrow, startTime: number) {
    this.plannedThrow = plannedThrow;
    this.curve = new THREE.CubicBezierCurve3(
      plannedThrow.p0,
      plannedThrow.p1,
      plannedThrow.p2,
      plannedThrow.p3,
    );
    this.startTime = startTime;
  }

  update(nowMs: number): AnimFrame {
    const t = Math.min(
      1,
      (nowMs - this.startTime) / this.plannedThrow.flightMs,
    );

    const posRaw = this.curve.getPoint(t);
    this._pos.copy(posRaw);

    const tanRaw = this.curve.getTangent(t);
    this._tan.copy(tanRaw).normalize();

    // Align dart tip with flight direction
    // _dartTip is (0,0,-1): dart tip points toward -Z by default
    this._quat.setFromUnitVectors(this._dartTip, this._tan);

    // Side-to-side yaw wobble — alive feel throughout flight, gentle dampening
    // Early production values: ±0.14 rad (±8°), dampening factor 0.45
    const wobble =
      Math.sin(t * YAW_WOBBLE_FREQUENCY) *
      YAW_WOBBLE_AMPLITUDE *
      (1 - t * YAW_WOBBLE_DAMPEN);
    this._wobbleQuat.setFromAxisAngle(this._wobbleAxis, wobble);
    this._quat.premultiply(this._wobbleQuat);

    // Barrel roll active throughout ENTIRE flight (no tangentY guard).
    // Caller reads plannedThrow.t and calls setFlightRoll(t) in the render loop.
    // The BARREL_ROLL_SPEED constant is used by R3FGame useFrame directly:
    // angle = t * BARREL_ROLL_SPEED
    // Exported for use in R3FGame.

    // At impact (t near 1): tilt dart so tip embeds ~75-80° into board
    // Blend 0.27 rad (≈15.5°) forward tilt smoothly over last 5%
    if (t >= 0.95) {
      const embedBlend = (t - 0.95) / 0.05; // 0→1 over last 5%
      const embedTilt = embedBlend * 0.27;
      this._embedQuat.setFromAxisAngle(this._embedAxis, embedTilt);
      this._quat.multiply(this._embedQuat);
    }

    return {
      position: this._pos,
      quaternion: this._quat,
      t,
      complete: t >= 1,
      landingZone: this.plannedThrow.landingZone,
      tangentY: this._tan.y,
    };
  }
}

// Export the barrel roll speed so R3FGame useFrame can compute the angle
export { BARREL_ROLL_SPEED };
