/**
 * THROW / ARC LAYER
 * -----------------
 * Single responsibility: compute the dart's parabolic flight trajectory
 * and drive the Phaser tween that moves it.
 *
 * Inputs:  AimData, PowerData, board geometry, dart stability
 * Outputs: ThrowArcResult { targetX, targetY }
 *          Fires onUpdate(x, y) every frame, onComplete(x, y) at landing.
 *
 * No spin logic, no impact effects, no score logic here.
 *
 * Tuning knobs:
 *   LAUNCH_SPEED_BASE   — multiplier on (power × boardRadius) for range
 *   SCATTER_FACTOR      — how much dart stability affects spread
 *   WEIGHT_DROP_FACTOR  — heavier darts drop slightly more
 *   ARC_GRAVITY         — downward pull used for trajectory preview
 */

import type Phaser from "phaser";
import type { AimData } from "./AimLayer";
import type { PowerData } from "./PowerLayer";

// ── Tuning ───────────────────────────────────────────────────────────────────
export const ARC_CONFIG = {
  LAUNCH_SPEED_BASE: 1.4, // fraction of boardRadius for horizontal range
  SCATTER_FACTOR: 0.22, // spread multiplier relative to board radius
  WEIGHT_DROP_FACTOR: 0.1, // drop per gram over 18g baseline
  ARC_GRAVITY: 280, // pixels/s² used in dot preview
} as const;

// ── Output types ──────────────────────────────────────────────────────────────

export interface ThrowArcResult {
  targetX: number;
  targetY: number;
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
  /** 0-100 stability stat from DartConfig */
  stability: number;
  /** Dart weight in grams */
  weight: number;
  onUpdate: (x: number, y: number) => void;
  onComplete: (x: number, y: number) => void;
}

// ── Layer ─────────────────────────────────────────────────────────────────────

export class ThrowArcLayer {
  private tween: Phaser.Tweens.Tween | null = null;

  /**
   * Compute landing position, then animate the dart along a parabolic path.
   * The proxy object is only position data — no rendering happens here.
   */
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
      onUpdate,
      onComplete,
    } = opts;

    // Gaussian scatter for realism
    const scatter =
      ((100 - stability) / 100) * boardRadius * ARC_CONFIG.SCATTER_FACTOR;
    const gauss = () => {
      const u = Math.random() || 1e-9;
      return (
        Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random())
      );
    };

    const targetX =
      boardCX +
      aim.normX * boardRadius * ARC_CONFIG.LAUNCH_SPEED_BASE +
      gauss() * scatter;
    const rawTargetY =
      boardCY + (1 + aim.normY) * boardRadius * 1.15 + gauss() * scatter;
    const weightDrop =
      ((weight - 18) / 10) * boardRadius * ARC_CONFIG.WEIGHT_DROP_FACTOR;
    const targetY = rawTargetY + weightDrop;

    const proxy = { x: startX, y: startY };

    this.tween = scene.tweens.add({
      targets: proxy,
      x: targetX,
      y: targetY,
      duration: power.flightDurationMs,
      ease: "Power2.easeIn",
      onUpdate: () => onUpdate(proxy.x, proxy.y),
      onComplete: () => onComplete(targetX, targetY),
    });

    return { targetX, targetY };
  }

  /** Build trajectory preview dot positions for the aim indicator */
  previewDots(
    startX: number,
    startY: number,
    aim: AimData,
    power: PowerData,
    count = 10,
  ): Array<{ x: number; y: number; alpha: number; radius: number }> {
    const launchSpeed = power.power * 900;
    const dots: Array<{ x: number; y: number; alpha: number; radius: number }> =
      [];
    for (let i = 1; i <= count; i++) {
      const tt = (i / count) * 0.7;
      dots.push({
        x: startX + aim.normX * launchSpeed * tt,
        y:
          startY +
          aim.normY * launchSpeed * tt +
          0.5 * ARC_CONFIG.ARC_GRAVITY * tt * tt,
        alpha: (1 - (i - 1) / count) * 0.55,
        radius: Math.max(1, 3.5 - i * 0.25),
      });
    }
    return dots;
  }

  stop(scene: Phaser.Scene) {
    if (this.tween) {
      scene.tweens.remove(this.tween);
      this.tween = null;
    }
  }
}
