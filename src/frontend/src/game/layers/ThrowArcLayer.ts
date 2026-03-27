/**
 * THROW / ARC LAYER  ─  Real-time projectile physics
 * ──────────────────────────────────────────────────
 *
 * Physics model (screen coords: +Y = down, −Y = up toward board):
 *
 *   posX += velX * dt
 *   posY += velY * dt
 *   velY += g_effective * dt
 *
 * The dart always travels toward the pre-calculated target in
 * exactly flightDurationMs milliseconds. The parabolic arc above
 * the straight-line path is controlled by upwardBias and gravityScale.
 *
 * MATHEMATICAL GUARANTEE
 * ───────────────────────────────────────────────────────────────────────
 * Given target position (tx, ty), flight time T, and a desired
 * upward boost, we compensate gravity so the dart still arrives
 * at (tx, ty) in exactly T seconds:
 *
 *   velY_launch  = velY_straight − upwardBoost
 *   g_effective  = g_base + 2 × upwardBoost / T
 *
 * This means any value of upwardBias / gravityScale is valid and the
 * dart will ALWAYS land on the board — the only change is arc shape.
 *
 * ──────────────────────────────────────────────────────────────────────
 * TUNING GUIDE  (ARC_CONFIG constants)
 *
 *   gravityScale  600 – 1800  (pixels / second²)
 *     Base gravity before upwardBias compensation.
 *     Higher = steeper drop overall, flatter arc on hard throws.
 *
 *   upwardBias  0.10 – 0.60
 *     Default extra upward impulse as a fraction of base vertical speed.
 *     Overridden per-throw by GameScene based on dart hover position
 *     (higher dart = larger override = more arc = hits top of board).
 *
 *   powerMultiplier  0.8 – 1.4
 *     Scales horizontal aim spread across the board.
 * ──────────────────────────────────────────────────────────────────────
 */

import type Phaser from "phaser";
import type { AimData } from "./AimLayer";
import type { PowerData } from "./PowerLayer";
import { getZoneCenters, snapToPremiumZone } from "./ZoneSnap";

// ── Exposed tuning constants ────────────────────────────────────────────────
export const ARC_CONFIG = {
  /** Gravity in px/s² before upwardBias compensation. Range: 600–1800. */
  gravityScale: 1200,

  /**
   * Default extra upward impulse at launch (fraction of base vertical speed × power).
   * GameScene OVERRIDES this per-throw with a value derived from dart hover Y:
   *   HIGH dart position → override ≈ 0.55 (dramatic arc, hits top of board)
   *   LOW  dart position → override ≈ 0.10 (flat arc, hits bottom/center)
   * This default is used only if no override is passed.
   */
  upwardBias: 0.58,

  /**
   * Horizontal aim spread multiplier. 1.0 = board-width natural.
   * Increased to 1.2 for better left/right reach across board.
   */
  powerMultiplier: 1.2,

  SCATTER_FACTOR: 0.18,
  WEIGHT_DROP_FACTOR: 0.1,
  FORWARD_BOARD_PULL: 0.0,

  /** Snap radius in px — dart sticks when this close to target point. */
  COLLISION_DIST: 32,
} as const;

// ── Public types ─────────────────────────────────────────────────────────────
export interface ThrowArcResult {
  targetX: number;
  targetY: number;
  impactAngleDeg: number;
}

interface ArcOptions {
  scene: Phaser.Scene;
  startX: number;
  startY: number;
  aim: AimData;
  power: PowerData;
  boardCX: number;
  boardCY: number;
  boardRadius: number;
  stability: number;
  weight: number;
  /**
   * Optional per-throw upward bias override.
   * GameScene sets this based on the dart's hover Y position so that
   * dragging UP gives a stronger upward kick (more arc, hits top of board)
   * and dragging DOWN reduces arc (hits bottom/center).
   * Falls back to ARC_CONFIG.upwardBias if not provided.
   */
  upwardBiasOverride?: number;
  /**
   * Called every frame with current dart position AND velocity vector.
   * SpinLayer uses velX/velY to orient the dart tip along the flight path.
   */
  onUpdate: (x: number, y: number, velX: number, velY: number) => void;
  onComplete: (x: number, y: number, impactAngleDeg: number) => void;
}

// ── Layer ────────────────────────────────────────────────────────────────────
export class ThrowArcLayer {
  private updateFn: ((time: number, delta: number) => void) | null = null;
  private currentScene: Phaser.Scene | null = null;

  launch(opts: ArcOptions): ThrowArcResult {
    const {
      scene,
      startX,
      startY,
      aim,
      power,
      boardCX,
      boardCY,
      boardRadius,
      stability,
      weight,
      upwardBiasOverride,
      onUpdate,
      onComplete,
    } = opts;

    // ── 1. Calculate landing position (with stability scatter) ───────────────────
    const scatter =
      ((100 - stability) / 100) * boardRadius * ARC_CONFIG.SCATTER_FACTOR;
    const gauss = () => {
      const u = Math.random() || 1e-9;
      return (
        Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random())
      );
    };

    const aimOffsetX =
      aim.normX * boardRadius * ARC_CONFIG.powerMultiplier * 1.35;
    const boardPullX = (boardCX - startX) * ARC_CONFIG.FORWARD_BOARD_PULL;
    const rawTargetX = boardCX + aimOffsetX + boardPullX + gauss() * scatter;

    const rawTargetY =
      boardCY + (1 + aim.normY) * boardRadius * 1.15 + gauss() * scatter;
    const weightDrop =
      ((weight - 18) / 10) * boardRadius * ARC_CONFIG.WEIGHT_DROP_FACTOR;
    const rawTargetYFinal = rawTargetY + weightDrop;

    // ── Zone snap — autocorrect near premium zones ────────────────────────────
    const _zoneCenters = getZoneCenters(boardCX, boardCY, boardRadius);
    const _snapped = snapToPremiumZone(
      rawTargetX,
      rawTargetYFinal,
      _zoneCenters,
    );
    const finalTargetX = _snapped.x;
    const finalTargetY = _snapped.y;

    // ── 2. Derive initial velocities ──────────────────────────────────────────────
    const T = power.flightDurationMs / 1000;
    const g = ARC_CONFIG.gravityScale;

    const velX_s = (finalTargetX - startX) / T;
    const velY_s = (finalTargetY - startY - 0.5 * g * T * T) / T;

    // Use per-throw override if provided, else fallback to config default
    const upwardBias = upwardBiasOverride ?? ARC_CONFIG.upwardBias;
    const upwardBoost = upwardBias * Math.abs(velY_s) * power.power;
    const g_eff = g + (2 * upwardBoost) / T;

    let velX = velX_s;
    let velY = velY_s - upwardBoost;

    let posX = startX;
    let posY = startY;
    let landed = false;

    // ── 3. Real-time physics loop ────────────────────────────────────────────────
    const updateFn = (_time: number, delta: number) => {
      if (landed) return;

      const dt = Math.min(delta, 50) / 1000;

      velY += g_eff * dt;
      posX += velX * dt;
      posY += velY * dt;

      onUpdate(posX, posY, velX, velY);

      // Collision: dart entered target sphere
      const dx = posX - finalTargetX;
      const dy = posY - finalTargetY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < ARC_CONFIG.COLLISION_DIST) {
        landed = true;
        this._cleanup(scene);
        const impactAngleDeg = (Math.atan2(velY, velX) * 180) / Math.PI;
        onComplete(posX, posY, impactAngleDeg);
        return;
      }

      // Fallback: dart flew off screen
      if (
        posY > scene.scale.height + 150 ||
        posX < -300 ||
        posX > scene.scale.width + 300
      ) {
        landed = true;
        this._cleanup(scene);
        const distBoard = Math.sqrt(
          (posX - boardCX) ** 2 + (posY - boardCY) ** 2,
        );
        const clampX =
          boardCX +
          ((posX - boardCX) * boardRadius * 0.7) / Math.max(distBoard, 1);
        const clampY =
          boardCY +
          ((posY - boardCY) * boardRadius * 0.7) / Math.max(distBoard, 1);
        const impactAngleDeg = (Math.atan2(velY, velX) * 180) / Math.PI;
        onComplete(clampX, clampY, impactAngleDeg);
      }
    };

    this.updateFn = updateFn;
    this.currentScene = scene;
    scene.events.on("update", updateFn);
    scene.events.once("shutdown", () => this._cleanup(scene));
    scene.events.once("destroy", () => this._cleanup(scene));

    return {
      targetX: finalTargetX,
      targetY: finalTargetY,
      impactAngleDeg: -90,
    };
  }

  /**
   * Aim-indicator preview dots — uses same physics equations as launch().
   * upwardBiasOverride: pass the same value GameScene uses for the actual throw.
   */
  previewDots(
    startX: number,
    startY: number,
    aim: AimData,
    power: PowerData,
    boardCX: number,
    boardCY: number,
    boardRadius: number,
    count = 10,
    upwardBiasOverride?: number,
  ): Array<{ x: number; y: number; alpha: number; radius: number }> {
    const T = power.flightDurationMs / 1000;
    const g = ARC_CONFIG.gravityScale;

    const aimOffsetX =
      aim.normX * boardRadius * ARC_CONFIG.powerMultiplier * 1.35;
    const tX = boardCX + aimOffsetX;
    const tY = boardCY + (1 + aim.normY) * boardRadius * 1.15;

    const velX_s = (tX - startX) / T;
    const velY_s = (tY - startY - 0.5 * g * T * T) / T;

    const upwardBias = upwardBiasOverride ?? ARC_CONFIG.upwardBias;
    const upwardBoost = upwardBias * Math.abs(velY_s) * power.power;
    const g_eff = g + (2 * upwardBoost) / T;

    const vx0 = velX_s;
    const vy0 = velY_s - upwardBoost;

    const dots: Array<{ x: number; y: number; alpha: number; radius: number }> =
      [];
    for (let i = 1; i <= count; i++) {
      const t = (i / count) * T * 0.88;
      dots.push({
        x: startX + vx0 * t,
        y: startY + vy0 * t + 0.5 * g_eff * t * t,
        alpha: (1 - (i - 1) / count) * 0.55,
        radius: Math.max(1, 3.5 - i * 0.25),
      });
    }
    return dots;
  }

  stop() {
    if (this.currentScene) this._cleanup(this.currentScene);
  }

  private _cleanup(scene: Phaser.Scene) {
    if (this.updateFn) {
      scene.events.off("update", this.updateFn);
      this.updateFn = null;
    }
    this.currentScene = null;
  }
}
