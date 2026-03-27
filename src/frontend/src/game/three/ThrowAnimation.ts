import * as THREE from "three";
import type { PlannedThrow } from "../core/ArcPlanner";
import type { ZoneResult } from "../core/ScoringGrid";

export interface AnimFrame {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  t: number;
  complete: boolean;
  landingZone: ZoneResult;
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
    // Tangent points in the direction of travel (generally -Z toward board)
    this._quat.setFromUnitVectors(this._dartTip, this._tan);

    // Side-to-side yaw wobble — dampens on approach
    const wobble = Math.sin(t * Math.PI * 5) * 0.09 * (1 - t * 0.65);
    this._wobbleQuat.setFromAxisAngle(this._wobbleAxis, wobble);
    this._quat.premultiply(this._wobbleQuat);

    return {
      position: this._pos,
      quaternion: this._quat,
      t,
      complete: t >= 1,
      landingZone: this.plannedThrow.landingZone,
    };
  }
}
