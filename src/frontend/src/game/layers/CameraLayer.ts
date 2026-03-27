/**
 * CAMERA LAYER
 * ------------
 * Single responsibility: manage all camera state transitions and motion.
 *
 * Camera States:
 *   idle    — stable, default zoom, no movement
 *   aim     — slight zoom-in, subtle micro-follow of aim indicator
 *   throw   — push forward + impulse shake on release
 *   flight  — smooth follow of dart position with damping
 *   impact  — shake + snap settle, then return to idle
 *
 * All motion uses tweens or Phaser camera methods — no raw state mutation.
 * All transitions are smoothed and predictable.
 *
 * Tuning knobs:
 *   AIM_ZOOM          — zoom level during aim state
 *   THROW_ZOOM        — zoom level immediately on throw (slight zoom out)
 *   THROW_SHAKE_INT   — shake intensity on throw release
 *   FLIGHT_FOLLOW_X   — how much camera follows dart horizontally (0–1)
 *   FLIGHT_FOLLOW_Y   — how much camera follows dart vertically (0–1)
 *   FLIGHT_SMOOTH     — EMA factor for flight follow (lower = smoother)
 *   IMPACT_SHAKE_INT  — shake intensity on dart impact
 *   IMPACT_SHAKE_DUR  — shake duration ms on impact
 *   SLOW_MO_FACTOR    — time scale applied just before impact (1 = off)
 *   SLOW_MO_WINDOW    — ms before impact to apply slow-mo
 */

import type Phaser from "phaser";

// ── Tuning ───────────────────────────────────────────────────────────────────
export const CAMERA_CONFIG = {
  // Aim
  AIM_ZOOM: 1.06,
  AIM_ZOOM_DURATION: 150,
  AIM_MICRO_FOLLOW: 0.012, // fraction of aim delta applied to scroll

  // Throw release
  THROW_ZOOM: 0.97,
  THROW_ZOOM_DURATION: 120,
  THROW_SHAKE_INT: 0.004,
  THROW_SHAKE_DUR: 180,
  THROW_PUSH_Y: 6, // pixels of downward push on release

  // Flight follow
  FLIGHT_FOLLOW_X: 0.08, // how far camera tracks dart horizontally
  FLIGHT_FOLLOW_Y: 0.14, // how far camera tracks dart vertically
  FLIGHT_SMOOTH: 0.07, // EMA alpha — lower = more damping
  FLIGHT_LEAD_Y: -0.04, // slight upward lead ahead of dart (fraction of screen H)

  // Impact
  IMPACT_SHAKE_INT: 0.008,
  IMPACT_SHAKE_DUR: 280,
  IMPACT_SNAP_DURATION: 320, // ms to snap back to resting position

  // Micro slow-mo on approach (set SLOW_MO_FACTOR to 1.0 to disable)
  SLOW_MO_FACTOR: 0.72,
  SLOW_MO_WINDOW: 160, // ms before impact to start slow-mo

  // Return to idle
  IDLE_ZOOM: 1.0,
  IDLE_RETURN_DURATION: 260,
} as const;

export type CameraState = "idle" | "aim" | "throw" | "flight" | "impact";

export class CameraLayer {
  private scene: Phaser.Scene;
  private cam: Phaser.Cameras.Scene2D.Camera;
  private state: CameraState = "idle";

  // Flight follow state
  private flightTargetScrollX = 0;
  private flightTargetScrollY = 0;
  private flightCurrentScrollX = 0;
  private flightCurrentScrollY = 0;
  private flightEnabled = false;
  private baseScrollX = 0;
  private baseScrollY = 0;

  // Aim micro-follow state
  private aimBaseScrollX = 0;
  private aimBaseScrollY = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.cam = scene.cameras.main;
    this.baseScrollX = this.cam.scrollX;
    this.baseScrollY = this.cam.scrollY;
    this.flightCurrentScrollX = this.cam.scrollX;
    this.flightCurrentScrollY = this.cam.scrollY;
  }

  // ── State transitions ────────────────────────────────────────────────────

  enterIdle() {
    if (this.state === "idle") return;
    this.state = "idle";
    this.flightEnabled = false;
    this._killTweens();
    this._tweenZoomTo(
      CAMERA_CONFIG.IDLE_ZOOM,
      CAMERA_CONFIG.IDLE_RETURN_DURATION,
      "Power2.easeOut",
    );
    this._panToBase(CAMERA_CONFIG.IDLE_RETURN_DURATION);
  }

  /**
   * Called when finger touches down (aim state begins).
   * @param aimX  Current aim indicator X (board-space)
   * @param aimY  Current aim indicator Y
   */
  enterAim() {
    this.state = "aim";
    this.flightEnabled = false;
    this.aimBaseScrollX = this.cam.scrollX;
    this.aimBaseScrollY = this.cam.scrollY;
    this._killTweens();
    this._tweenZoomTo(
      CAMERA_CONFIG.AIM_ZOOM,
      CAMERA_CONFIG.AIM_ZOOM_DURATION,
      "Power2.easeOut",
    );
  }

  /**
   * Called on each pointer move during aim — applies subtle micro-follow.
   * @param dx Delta from aim start X
   * @param dy Delta from aim start Y
   */
  updateAimFollow(dx: number, dy: number) {
    if (this.state !== "aim") return;
    const targetScrollX =
      this.aimBaseScrollX + dx * CAMERA_CONFIG.AIM_MICRO_FOLLOW;
    const targetScrollY =
      this.aimBaseScrollY + dy * CAMERA_CONFIG.AIM_MICRO_FOLLOW;
    // Smooth scroll toward target
    this.cam.scrollX += (targetScrollX - this.cam.scrollX) * 0.15;
    this.cam.scrollY += (targetScrollY - this.cam.scrollY) * 0.15;
  }

  /**
   * Called the moment the dart is released.
   * @param power  0–1 throw power (affects zoom-out magnitude)
   */
  enterThrow(power: number) {
    this.state = "throw";
    this.flightEnabled = false;
    this._killTweens();

    const zoomOut = CAMERA_CONFIG.THROW_ZOOM - power * 0.03; // more zoom-out for hard throws

    // Quick zoom out
    this._tweenZoomTo(
      zoomOut,
      CAMERA_CONFIG.THROW_ZOOM_DURATION,
      "Power2.easeOut",
    );

    // Forward push (subtle downward impulse in 2D/first-person)
    this.scene.tweens.add({
      targets: this.cam,
      scrollY: this.cam.scrollY + CAMERA_CONFIG.THROW_PUSH_Y,
      duration: 80,
      ease: "Power2.easeOut",
      yoyo: false,
    });

    // Subtle shake on release
    this.cam.shake(
      CAMERA_CONFIG.THROW_SHAKE_DUR,
      CAMERA_CONFIG.THROW_SHAKE_INT * (0.5 + power * 0.5),
    );
  }

  /**
   * Called right after throw state — camera now follows the dart.
   * @param dartStartX  Starting dart world X
   * @param dartStartY  Starting dart world Y
   */
  enterFlight(dartStartX: number, dartStartY: number) {
    this.state = "flight";
    this.flightTargetScrollX = this.baseScrollX;
    this.flightTargetScrollY = this.baseScrollY;
    this.flightCurrentScrollX = this.cam.scrollX;
    this.flightCurrentScrollY = this.cam.scrollY;
    this.flightEnabled = true;
    this._trackDart(dartStartX, dartStartY);
  }

  /**
   * Called every frame during dart flight.
   * @param dartX  Current dart world X
   * @param dartY  Current dart world Y
   */
  updateFlight(dartX: number, dartY: number) {
    if (!this.flightEnabled || this.state !== "flight") return;
    this._trackDart(dartX, dartY);

    // Apply EMA smoothing to scroll
    const alpha = CAMERA_CONFIG.FLIGHT_SMOOTH;
    this.flightCurrentScrollX +=
      (this.flightTargetScrollX - this.flightCurrentScrollX) * alpha;
    this.flightCurrentScrollY +=
      (this.flightTargetScrollY - this.flightCurrentScrollY) * alpha;

    this.cam.scrollX = this.flightCurrentScrollX;
    this.cam.scrollY = this.flightCurrentScrollY;
  }

  /**
   * Called when dart impact is detected.
   * @param power  0–1 power of the throw (affects shake intensity)
   */
  enterImpact(power = 0.5) {
    this.state = "impact";
    this.flightEnabled = false;

    // Impact shake
    this.cam.shake(
      CAMERA_CONFIG.IMPACT_SHAKE_DUR,
      CAMERA_CONFIG.IMPACT_SHAKE_INT * (0.6 + power * 0.4),
    );

    // Snap back to base + idle zoom
    this.scene.time.delayedCall(CAMERA_CONFIG.IMPACT_SHAKE_DUR * 0.5, () => {
      this._killTweens();
      this._tweenZoomTo(
        CAMERA_CONFIG.IDLE_ZOOM,
        CAMERA_CONFIG.IMPACT_SNAP_DURATION,
        "Power2.easeOut",
      );
      this._panToBase(CAMERA_CONFIG.IMPACT_SNAP_DURATION);
    });
  }

  /**
   * Apply micro slow-mo just before impact.
   * Call this from ThrowArcLayer when dart is close to landing.
   */
  applySlowMo() {
    if (CAMERA_CONFIG.SLOW_MO_FACTOR >= 1.0) return;
    this.scene.time.timeScale = CAMERA_CONFIG.SLOW_MO_FACTOR;
    // Restore after window expires
    this.scene.time.delayedCall(
      CAMERA_CONFIG.SLOW_MO_WINDOW * CAMERA_CONFIG.SLOW_MO_FACTOR,
      () => {
        this.scene.time.timeScale = 1.0;
      },
    );
  }

  get currentState(): CameraState {
    return this.state;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private _trackDart(dartX: number, dartY: number) {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    // Compute how far the dart is from screen center
    const centerX = W / 2;
    const centerY = H / 2;
    const offsetX = (dartX - centerX) * CAMERA_CONFIG.FLIGHT_FOLLOW_X;
    const offsetY =
      (dartY - centerY) * CAMERA_CONFIG.FLIGHT_FOLLOW_Y +
      H * CAMERA_CONFIG.FLIGHT_LEAD_Y; // slight upward lead

    this.flightTargetScrollX = this.baseScrollX + offsetX;
    this.flightTargetScrollY = this.baseScrollY + offsetY;
  }

  private _tweenZoomTo(zoom: number, duration: number, ease: string) {
    this.scene.tweens.add({
      targets: this.cam,
      zoom,
      duration,
      ease,
    });
  }

  private _panToBase(duration: number) {
    this.scene.tweens.add({
      targets: this.cam,
      scrollX: this.baseScrollX,
      scrollY: this.baseScrollY,
      duration,
      ease: "Power2.easeOut",
    });
    this.flightCurrentScrollX = this.cam.scrollX;
    this.flightCurrentScrollY = this.cam.scrollY;
  }

  private _killTweens() {
    this.scene.tweens.killTweensOf(this.cam);
  }
}
