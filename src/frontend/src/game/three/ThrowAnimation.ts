import * as THREE from "three";
import type { PlannedThrow } from "../core/ArcPlanner";
import type { ZoneResult } from "../core/ScoringGrid";

// ── Flight constants ─────────────────────────────────────────────────────────
const YAW_WOBBLE_AMPLITUDE = 0.12; // ±7° — organic side-to-side feel
const YAW_WOBBLE_FREQUENCY = Math.PI * 4; // 4 cycles across full flight
const YAW_WOBBLE_DAMPEN = 0.1; // very gentle dampening — wobble persists
const BARREL_ROLL_SPEED = Math.PI * 8; // 4 full rotations — tight but not tumble-like

// Tangent smoothing buffer size — averages last N tangents to eliminate snaps
const SMOOTH_BUFFER_SIZE = 3;

// ── Cubic ease-in: slow departure, fast arrival ───────────────────────────────
// Creates "dart leaving the hand slowly and accelerating toward the board"
// x = raw linear [0,1] → output is heavily weighted toward the end
function easeInCubic(x: number): number {
  return x * x * x;
}

export interface AnimFrame {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  t: number;
  complete: boolean;
  landingZone: ZoneResult;
  tangentY: number;
  /** True when descending — barrel roll should ONLY fire when this is true */
  isDescending: boolean;
}

export class ThrowAnimation {
  readonly plannedThrow: PlannedThrow;
  private readonly curve: THREE.CubicBezierCurve3;
  private readonly startTime: number;
  impactFired = false;

  // Pre-allocated — no GC in render loop
  private readonly _pos = new THREE.Vector3();
  private readonly _tan = new THREE.Vector3();
  private readonly _quat = new THREE.Quaternion();

  // CRITICAL: dart tip points toward -Z in local space (tip faces board)
  // During flight the tangent always points roughly toward the board (negative Z world)
  private readonly _dartTipAxis = new THREE.Vector3(0, 0, -1);

  private readonly _wobbleQuat = new THREE.Quaternion();
  private readonly _wobbleAxis = new THREE.Vector3(0, 1, 0);
  private readonly _embedQuat = new THREE.Quaternion();
  private readonly _embedAxis = new THREE.Vector3(1, 0, 0);
  // Z-axis roll for embed: skews flights diagonally up-right on impact
  private readonly _embedZQuat = new THREE.Quaternion();
  private readonly _embedZAxis = new THREE.Vector3(0, 0, 1);

  // Tangent smoothing: rolling buffer of last N tangents
  private readonly _tangentBuffer: THREE.Vector3[] = [];
  private readonly _smoothedTan = new THREE.Vector3();

  constructor(plannedThrow: PlannedThrow, startTime: number) {
    this.plannedThrow = plannedThrow;
    this.curve = new THREE.CubicBezierCurve3(
      plannedThrow.p0,
      plannedThrow.p1,
      plannedThrow.p2,
      plannedThrow.p3,
    );
    this.startTime = startTime;
    // Seed buffer with forward-facing tangent so first frame is stable
    for (let i = 0; i < SMOOTH_BUFFER_SIZE; i++) {
      this._tangentBuffer.push(new THREE.Vector3(0, 0, -1));
    }
    // Pre-set the Z embed roll — fixed +0.35 rad so flights always skew up-right
    this._embedZQuat.setFromAxisAngle(this._embedZAxis, 0.35);
  }

  update(nowMs: number): AnimFrame {
    // rawT: linear progress [0,1] used for logic gates (embed, descending, complete)
    const rawT = Math.min(
      1,
      (nowMs - this.startTime) / this.plannedThrow.flightMs,
    );

    // easedT: cubic ease-in applied to bezier sampling
    // Dart leaves hand slowly and ACCELERATES toward the board
    const t = easeInCubic(rawT);

    this._pos.copy(this.curve.getPoint(t));

    const rawTan = this.curve.getTangent(t);
    this._tan.copy(rawTan).normalize();

    // ── ANTI-TUMBLE GUARD 1: Ensure tangent always points toward board ──────
    // Tangent Z should be negative (toward board). If it's pointing away (+Z),
    // something has gone wrong with the bezier — flip it.
    if (this._tan.z > 0.3) {
      this._tan.negate();
    }

    // ── ANTI-TUMBLE GUARD 2: Clamp extreme downward angles ──────────────────
    // Pure downward pointing (tangentY near -1.0) causes the dart to visually
    // flip because setFromUnitVectors struggles at pole alignment.
    // Clamp Y so we never exceed 85° downward.
    if (this._tan.y < -0.96) {
      this._tan.y = -0.96;
      this._tan.normalize();
    }

    // ── TANGENT SMOOTHING: Rolling buffer of last N tangents ────────────────
    // Eliminates sudden orientation snaps at the arc apex where bezier tangent
    // direction changes fastest. Slerp-average the buffer.
    this._tangentBuffer.shift();
    this._tangentBuffer.push(this._tan.clone());

    // Average the buffered tangents
    this._smoothedTan.set(0, 0, 0);
    for (const bt of this._tangentBuffer) {
      this._smoothedTan.add(bt);
    }
    this._smoothedTan.normalize();

    // Final safety: ensure smoothed tangent still points toward board
    if (this._smoothedTan.z > 0.1) {
      this._smoothedTan.z = -0.1;
      this._smoothedTan.normalize();
    }

    // ── BUILD ORIENTATION QUATERNION — PITCH-GATED ──────────────────────────
    // Dart must NOT nose-down before rawT = 0.5.
    // Smoothstep blend from t=0.5 to t=0.85 for a smooth, non-lurching pitch.
    // At t=0.5: pitchBlend=0 (dart stays flat). At t=0.85+: pitchBlend=1 (full tangent pitch).
    let pitchBlend = 0;
    if (rawT >= 0.5) {
      // smoothstep(0.5, 0.85, rawT)
      const x = Math.min(1, Math.max(0, (rawT - 0.5) / (0.85 - 0.5)));
      pitchBlend = x * x * (3 - 2 * x);
    }

    // Build a pitch-limited version of smoothedTan:
    // Keep the XZ (yaw) direction from smoothedTan, but lerp its Y from 0 → real Y
    const pitchedTan = this._smoothedTan.clone();
    pitchedTan.y = this._smoothedTan.y * pitchBlend;
    // Re-normalize so length is preserved — but ensure Z stays negative (toward board)
    if (pitchedTan.lengthSq() < 0.0001) pitchedTan.set(0, 0, -1);
    pitchedTan.normalize();
    if (pitchedTan.z > 0.1) {
      pitchedTan.z = -0.1;
      pitchedTan.normalize();
    }
    // Clamp extreme downward on the pitched version too
    if (pitchedTan.y < -0.96) {
      pitchedTan.y = -0.96;
      pitchedTan.normalize();
    }

    // Align dart tip axis (0,0,-1) with the pitch-gated tangent
    this._quat.setFromUnitVectors(this._dartTipAxis, pitchedTan);

    // ── YAW WOBBLE — side-to-side organic motion ────────────────────────────
    // Applied AFTER base orientation so it wobbles relative to flight direction
    // Use rawT for wobble frequency so it stays consistent with real elapsed time
    const wobble =
      Math.sin(rawT * YAW_WOBBLE_FREQUENCY) *
      YAW_WOBBLE_AMPLITUDE *
      (1 - rawT * YAW_WOBBLE_DAMPEN);
    this._wobbleQuat.setFromAxisAngle(this._wobbleAxis, wobble);
    this._quat.premultiply(this._wobbleQuat);

    // ── IMPACT EMBED TILT + Z-ROLL ──────────────────────────────────────────
    // BUG 2 FIX: Start blending at rawT >= 0.90 (was 0.95) for smooth embed —
    // no snap. Blend 0→1 over the last 10% of flight.
    // PLUS a fixed Z-axis roll of +0.35 rad so flights point diagonally up-right.
    if (rawT >= 0.9) {
      const embedBlend = (rawT - 0.9) / 0.1;
      // Forward tilt: tip into board at ~15-20° below horizontal
      const embedTilt = embedBlend * 0.27;
      this._embedQuat.setFromAxisAngle(this._embedAxis, embedTilt);
      this._quat.multiply(this._embedQuat);
      // Z-axis diagonal roll: flights skew up-right consistently
      // Blend in from 0 to full +0.35 rad over the last 10%
      const zRoll = embedBlend * 0.35;
      this._embedZQuat.setFromAxisAngle(this._embedZAxis, zRoll);
      this._quat.multiply(this._embedZQuat);
    }

    // Barrel roll fires only during descent (tangentY < -0.1)
    // Use smoothedTan which is based on eased t — this is intentional:
    // the dart visually descends when eased position descends
    const isDescending = this._smoothedTan.y < -0.1;

    return {
      position: this._pos,
      quaternion: this._quat,
      t: rawT, // expose rawT so callers (complete check, ring shrink) use real progress
      complete: rawT >= 1,
      landingZone: this.plannedThrow.landingZone,
      tangentY: this._smoothedTan.y,
      isDescending,
    };
  }
}

export { BARREL_ROLL_SPEED };
