/**
 * IMPACT LAYER
 * ------------
 * Single responsibility: determine where the dart lands on the board,
 * compute the score, and fire the corresponding visual/audio effects.
 *
 * Inputs:  Landing coordinates, board geometry
 * Outputs: ImpactResult { score, multiplier, segment, label }
 *
 * Side effects handled here (and nowhere else):
 *  - Haptic feedback
 *  - Camera shake
 *  - Spark particles
 *  - Multiplier flash effects (double/triple/bullseye)
 *  - Impact audio
 *
 * Tuning knobs:
 *   BULL_EYE_R    — radius fraction for bullseye
 *   BULL_R        — radius fraction for outer bull
 *   MISS_R        — radius fraction beyond which = miss
 *   TRIPLE_IN_R   — inner edge of triple ring (fraction)
 *   TRIPLE_OUT_R  — outer edge of triple ring
 *   DOUBLE_IN_R   — inner edge of double ring
 *   DOUBLE_OUT_R  — outer edge of double ring
 */

import type Phaser from "phaser";
import {
  playBullseyeSound,
  playDoubleSound,
  playImpactSound,
  playTripleSound,
} from "../audio";

// ── Tuning ───────────────────────────────────────────────────────────────────
export const IMPACT_CONFIG = {
  BULL_EYE_R: 0.05,
  BULL_R: 0.12,
  MISS_R: 0.955,
  TRIPLE_IN_R: 0.535,
  TRIPLE_OUT_R: 0.622,
  DOUBLE_IN_R: 0.855,
  DOUBLE_OUT_R: 0.955,
  SPARK_COUNT: 9,
  SHAKE_DURATION: 200,
  SHAKE_INTENSITY: 0.007,
} as const;

const SEGMENT_ORDER = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
];

// ── Output type ───────────────────────────────────────────────────────────────

export interface ImpactResult {
  score: number;
  multiplier: number;
  segment: number;
  label: string;
  isMiss: boolean;
}

// ── Layer ─────────────────────────────────────────────────────────────────────

export class ImpactLayer {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Score the hit and trigger all impact effects.
   * @param wx World X of dart tip
   * @param wy World Y of dart tip
   * @param boardCX Board centre X
   * @param boardCY Board centre Y
   * @param boardRadius Board radius in pixels
   * @param dartColor Hex colour string for sparks
   */
  process(
    wx: number,
    wy: number,
    boardCX: number,
    boardCY: number,
    boardRadius: number,
    dartColor: string,
  ): ImpactResult {
    const result = this._computeScore(wx - boardCX, wy - boardCY, boardRadius);

    // Haptic
    if (navigator.vibrate) navigator.vibrate([50, 20, 50]);

    // Camera shake
    this.scene.cameras.main.shake(
      IMPACT_CONFIG.SHAKE_DURATION,
      IMPACT_CONFIG.SHAKE_INTENSITY,
    );

    // Sparks
    this._spawnSparks(wx, wy, dartColor);

    // Multiplier effects + audio
    if (result.segment === 25 && result.multiplier === 2) {
      this._fxBullseye();
      playBullseyeSound();
    } else if (result.multiplier === 3) {
      this._fxTriple(wx, wy);
      playTripleSound();
    } else if (result.multiplier === 2) {
      this._fxDouble();
      playDoubleSound();
    } else {
      playImpactSound();
    }

    return result;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _computeScore(
    hitX: number,
    hitY: number,
    boardRadius: number,
  ): ImpactResult {
    const dist = Math.sqrt(hitX * hitX + hitY * hitY);
    const r = dist / boardRadius;

    if (r <= IMPACT_CONFIG.BULL_EYE_R)
      return {
        score: 50,
        multiplier: 2,
        segment: 25,
        label: "BULLSEYE!",
        isMiss: false,
      };
    if (r <= IMPACT_CONFIG.BULL_R)
      return {
        score: 25,
        multiplier: 1,
        segment: 25,
        label: "BULL",
        isMiss: false,
      };
    if (r > IMPACT_CONFIG.MISS_R)
      return {
        score: 0,
        multiplier: 0,
        segment: 0,
        label: "MISS",
        isMiss: true,
      };

    let angle = Math.atan2(hitX, -hitY) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    const segIndex = Math.floor(((angle + 9) % 360) / 18);
    const segment = SEGMENT_ORDER[segIndex];

    let multiplier = 1;
    let label = String(segment);

    if (r >= IMPACT_CONFIG.TRIPLE_IN_R && r <= IMPACT_CONFIG.TRIPLE_OUT_R) {
      multiplier = 3;
      label = `T${segment}`;
    } else if (
      r >= IMPACT_CONFIG.DOUBLE_IN_R &&
      r <= IMPACT_CONFIG.DOUBLE_OUT_R
    ) {
      multiplier = 2;
      label = `D${segment}`;
    }

    return {
      score: segment * multiplier,
      multiplier,
      segment,
      label,
      isMiss: false,
    };
  }

  private _spawnSparks(wx: number, wy: number, color: string) {
    const col = Number.parseInt(color.replace("#", ""), 16);
    for (let i = 0; i < IMPACT_CONFIG.SPARK_COUNT; i++) {
      const angle =
        (i / IMPACT_CONFIG.SPARK_COUNT) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 18 + Math.random() * 44;
      const spark = this.scene.add.arc(wx, wy, 3, 0, 360, false, col, 1);
      this.scene.tweens.add({
        targets: spark,
        x: wx + Math.cos(angle) * dist,
        y: wy + Math.sin(angle) * dist,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 230 + Math.random() * 170,
        ease: "Power2.easeOut",
        onComplete: () => spark.destroy(),
      });
    }
  }

  private _fxDouble() {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const overlay = this.scene.add.rectangle(
      W / 2,
      H / 2,
      W,
      H,
      0x0044ff,
      0.32,
    );
    this.scene.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 500,
      ease: "Power2.easeOut",
      onComplete: () => overlay.destroy(),
    });
  }

  private _fxTriple(wx: number, wy: number) {
    for (let i = 0; i < 3; i++) {
      this.scene.time.delayedCall(i * 100, () => {
        const ring = this.scene.add.arc(wx, wy, 22, 0, 360, false, 0, 0);
        ring.setStrokeStyle(4, 0xff00ff, 1);
        this.scene.tweens.add({
          targets: ring,
          scaleX: 5.5,
          scaleY: 5.5,
          alpha: 0,
          duration: 520,
          ease: "Power2.easeOut",
          onComplete: () => ring.destroy(),
        });
      });
    }
  }

  private _fxBullseye() {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const overlay = this.scene.add.rectangle(
      W / 2,
      H / 2,
      W,
      H,
      0xffaa00,
      0.52,
    );
    this.scene.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 900,
      ease: "Power2.easeOut",
      onComplete: () => overlay.destroy(),
    });
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const spark = this.scene.add.arc(
        W / 2,
        H / 2,
        12,
        0,
        360,
        false,
        0xffdd00,
        1,
      );
      this.scene.tweens.add({
        targets: spark,
        x: W / 2 + Math.cos(angle) * 220,
        y: H / 2 + Math.sin(angle) * 220,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 700,
        ease: "Power2.easeOut",
        onComplete: () => spark.destroy(),
      });
    }
  }
}
