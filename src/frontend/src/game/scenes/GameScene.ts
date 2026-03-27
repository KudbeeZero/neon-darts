/**
 * GAME SCENE
 * ----------
 * Orchestrates the throw pipeline. Each layer has one job:
 *
 *   InputLayer    →  RawInputData
 *   AimLayer      →  AimData
 *   PowerLayer    →  PowerData
 *   ThrowArcLayer →  drives real-time physics, fires onUpdate / onComplete
 *   SpinLayer     →  dart sprite rotation
 *   ImpactLayer   →  ImpactResult + effects
 *   CameraLayer   →  all camera state / motion
 *
 * HOVER + DRAG MECHANIC (Darts of Fury style)
 * ────────────────────────────────────────────
 * 1. Touch anywhere → dart snaps/animates to finger position (clamped to throw zone).
 * 2. Drag UP/DOWN → dart follows finger; vertical position maps to aim height on board.
 * 3. Drag DOWN past neutral → pull-back zone → adds bonus forward power.
 * 4. Release (finger lift or fling) → dart launches from its current hover position.
 *    - upwardBias derived from dart Y (higher dart = more upward launch velocity).
 *    - Forward power from swipe velocity + pull-back bonus.
 *    - normX/normY computed from dart position so aim matches physics target.
 */

import Phaser from "phaser";
import { DART_CONFIGS, type DartConfig } from "../../types/dart";
import { playThrowSound } from "../audio";

import { type AimData, AimLayer } from "../layers/AimLayer";
import { CameraLayer } from "../layers/CameraLayer";
import { ImpactLayer } from "../layers/ImpactLayer";
import { InputLayer } from "../layers/InputLayer";
import { POWER_CONFIG, type PowerData, PowerLayer } from "../layers/PowerLayer";
import { SpinLayer } from "../layers/SpinLayer";
import { ARC_CONFIG, ThrowArcLayer } from "../layers/ThrowArcLayer";

// ── Hover / drag aim configuration ────────────────────────────────────────
//
// All Y fractions are relative to screen height.
// Adjust these to tune how vertical drag controls aim height.
//
const HOVER_CFG = {
  /** Highest allowed dart Y (top of throw zone) — fraction of screen H */
  MIN_Y_FRAC: 0.48,
  /** Lowest allowed dart Y (maximum pull-back depth) — fraction of screen H */
  MAX_Y_FRAC: 0.88,
  /** Neutral hover position (no pull-back bonus) — fraction of screen H */
  NEUTRAL_Y_FRAC: 0.72,

  /**
   * Exponential follow speed (units: 1/s).
   * 12 = reaches ~95% of finger position in ~250ms — smooth but responsive.
   * User's requested value of 0.85 (per-frame) would be ~100/s here — very snappy.
   * Tune higher for more snap, lower for more float/animation.
   */
  FOLLOW_SPEED: 12.0,

  /**
   * Board hit zone extents as a fraction of boardRadius.
   * TOP_FRAC: when dart is at MIN_Y_FRAC, the target lands this far above boardCY.
   * BOT_FRAC: when dart is at MAX_Y_FRAC, the target lands this far below boardCY.
   */
  BOARD_HIT_TOP_FRAC: 1.0,
  BOARD_HIT_BOT_FRAC: 1.0,

  /** Horizontal aim spread: fraction of dart's X offset mapped to board target X */
  H_SPREAD: 1.0,

  /**
   * upwardBias range: higher dart = more upward initial velocity = higher arc.
   * Maps linearly: MIN_Y_FRAC → UPWARD_BIAS_HIGH, MAX_Y_FRAC → UPWARD_BIAS_LOW.
   * User requested upwardBiasBase = 0.30; we use a range for vertical control.
   */
  UPWARD_BIAS_HIGH: 0.82,
  UPWARD_BIAS_LOW: 0.1,

  /** Maximum power bonus added by pulling dart below NEUTRAL_Y_FRAC (0–1 fraction) */
  PULL_BACK_MAX_BONUS: 0.22,
  /** Screen H fraction that corresponds to a full pull-back (bonus = max) */
  PULL_BACK_RANGE: 0.14,
} as const;

// ─────────────────────────────────────────────────────────────────────────────

const SEGMENT_ORDER = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
];

function hexColor(cssColor: string): number {
  return Number.parseInt(cssColor.replace("#", ""), 16);
}

interface LandedDart {
  wx: number;
  wy: number;
  color: number;
  label: string;
}

export default class GameScene extends Phaser.Scene {
  // Board geometry
  private boardCX = 0;
  private boardCY = 0;
  private boardRadius = 0;

  // Graphics layers
  private boardContainer!: Phaser.GameObjects.Container;
  private boardGfx!: Phaser.GameObjects.Graphics;
  private highlightGfx!: Phaser.GameObjects.Graphics;
  private blocksGfx!: Phaser.GameObjects.Graphics;
  private trailGfx!: Phaser.GameObjects.Graphics;
  private aimGfx!: Phaser.GameObjects.Graphics;
  private targetRingGfx!: Phaser.GameObjects.Graphics;
  private currentRingTween: Phaser.Tweens.Tween | null = null;
  private _starGfx!: Phaser.GameObjects.Graphics;
  private _stars: Array<{
    x: number;
    y: number;
    r: number;
    baseAlpha: number;
    phase: number;
    speed: number;
  }> = [];

  // Dart sprite
  private dartSprite!: Phaser.GameObjects.Image;
  /** Fixed resting position — dart returns here between throws */
  private dartStartX = 0;
  private dartStartY = 0;
  /** Current physics-tracked dart position (during flight) */
  private dartX = 0;
  private dartY = 0;
  private dartFlying = false;
  private dartSettled = false;
  private trailPoints: Array<{ x: number; y: number }> = [];

  // ── Hover / drag aim state ────────────────────────────────────────────────
  /** True while finger is down and dart is hovering in aim position */
  private isAiming = false;
  /** Raw finger position (clamped in update loop) */
  private fingerX = 0;
  private fingerY = 0;
  /** Smooth animated dart hover position — set by update() easing */
  private dartHoverX = 0;
  private dartHoverY = 0;

  // Landed dart images
  private landedDartImages: Phaser.GameObjects.Image[] = [];
  private landings: LandedDart[] = [];

  // Game data
  private selectedDart: DartConfig = DART_CONFIGS[0];
  private gameMode = "301";
  private score301 = 301;
  private turnStartScore = 301;
  private dartScoresThisTurn: number[] = [];
  private practiceTarget = 1;
  private gameOver = false;
  private currentDartInTurn = 0;

  // HUD
  private scoreText!: Phaser.GameObjects.Text;
  private dartIndicatorText!: Phaser.GameObjects.Text;
  private lastScoresText!: Phaser.GameObjects.Text;
  private labelText!: Phaser.GameObjects.Text;

  // ── Pipeline layers ───────────────────────────────────────────────────────
  private inputLayer!: InputLayer;
  private aimLayer!: AimLayer;
  private powerLayer!: PowerLayer;
  private throwArcLayer!: ThrowArcLayer;
  private spinLayer!: SpinLayer;
  private impactLayer!: ImpactLayer;
  private cameraLayer!: CameraLayer;

  // Used for camera following during aim drag
  private intentStartX = 0;
  private intentStartY = 0;

  // Track last throw power for camera impact response
  private lastThrowPower = 0.5;

  constructor() {
    super("GameScene");
  }

  init(data: { dart?: DartConfig; mode?: string }) {
    this.selectedDart = data.dart ?? DART_CONFIGS[0];
    this.gameMode = data.mode ?? "301";
    this.score301 = 301;
    this.turnStartScore = 301;
    this.currentDartInTurn = 0;
    this.landings = [];
    this.dartScoresThisTurn = [];
    this.practiceTarget = 1;
    this.gameOver = false;
    this.trailPoints = [];
    this.dartFlying = false;
    this.dartSettled = false;
    this.landedDartImages = [];
    this.lastThrowPower = 0.5;
    this.isAiming = false;
    this.fingerX = 0;
    this.fingerY = 0;
    this.dartHoverX = 0;
    this.dartHoverY = 0;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // Board positioned further back — smaller radius, higher on screen
    this.boardCX = W / 2;
    this.boardCY = H * 0.24;
    this.boardRadius = Math.min(W, H) * 0.28;

    // Dart resting position — low foreground, first-person feel
    this.dartStartX = W / 2;
    this.dartStartY = H * 0.82;
    this.dartX = this.dartStartX;
    this.dartY = this.dartStartY;
    this.dartHoverX = this.dartStartX;
    this.dartHoverY = this.dartStartY;

    this._buildScene();
    this._initLayers();
  }

  // ── Per-frame update (hover easing + aim indicator) ───────────────────────

  update(_time: number, delta: number) {
    if (!this.isAiming || this.dartFlying || this.dartSettled || this.gameOver)
      return;

    const H = this.scale.height;
    const W = this.scale.width;
    const minY = H * HOVER_CFG.MIN_Y_FRAC;
    const maxY = H * HOVER_CFG.MAX_Y_FRAC;

    // Clamp finger to throw zone
    const targetX = Math.max(W * 0.05, Math.min(W * 0.95, this.fingerX));
    const targetY = Math.max(minY, Math.min(maxY, this.fingerY));

    // Frame-rate independent exponential easing toward finger position
    const dtSec = Math.min(delta, 50) / 1000;
    const lerpFactor = 1 - Math.exp(-HOVER_CFG.FOLLOW_SPEED * dtSec);

    this.dartHoverX += (targetX - this.dartHoverX) * lerpFactor;
    this.dartHoverY += (targetY - this.dartHoverY) * lerpFactor;

    // Move dart sprite to hover position
    this.dartSprite.setPosition(this.dartHoverX, this.dartHoverY);
    this.dartX = this.dartHoverX;
    this.dartY = this.dartHoverY;

    // Angle dart tip toward board while hovering
    const dxToBoard = this.boardCX - this.dartHoverX;
    const dyToBoard = this.boardCY - this.dartHoverY;
    const angleToBoard = (Math.atan2(dyToBoard, dxToBoard) * 180) / Math.PI;
    this.dartSprite.setAngle(angleToBoard - 90); // -90 offset for vertical sprite (tip at bottom)

    // Live aim indicator
    this._drawHoverAimIndicator();
    this._updateStars(delta);
  }

  // ── Scene construction ─────────────────────────────────────────────────────

  private _buildScene() {
    const W = this.scale.width;
    const H = this.scale.height;

    // ── Deep space background ────────────────────────────────────────────────
    const baseBg = this.add.graphics().setDepth(-10);
    baseBg.fillStyle(0x000008, 1);
    baseBg.fillRect(0, 0, W, H);

    // Nebula blobs
    const nebula = this.add.graphics().setDepth(-9);
    const blobs = [
      { x: W * 0.15, y: H * 0.2, rx: 120, ry: 80, color: 0x1a0044 },
      { x: W * 0.85, y: H * 0.15, rx: 100, ry: 70, color: 0x001a44 },
      { x: W * 0.1, y: H * 0.7, rx: 90, ry: 60, color: 0x0d0033 },
      { x: W * 0.9, y: H * 0.6, rx: 110, ry: 75, color: 0x00102a },
      { x: W * 0.5, y: H * 0.05, rx: 160, ry: 50, color: 0x0a0020 },
    ];
    for (const b of blobs) {
      for (let i = 5; i >= 1; i--) {
        nebula.fillStyle(b.color, 0.06 * i);
        nebula.fillEllipse(b.x, b.y, b.rx * 2 * (i / 5), b.ry * 2 * (i / 5));
      }
    }

    // ── Perspective throwing lane — recedes from viewer toward board ──────────
    const lane = this.add.graphics().setDepth(-9);
    const laneTopW = this.boardRadius * 1.2;
    const laneBotW = W * 0.85;
    const laneTopY = this.boardCY + this.boardRadius * 1.1;
    const laneBotY = H * 0.92;
    lane.fillStyle(0x08101e, 0.9);
    lane.fillPoints(
      [
        { x: this.boardCX - laneTopW / 2, y: laneTopY },
        { x: this.boardCX + laneTopW / 2, y: laneTopY },
        { x: this.boardCX + laneBotW / 2, y: laneBotY },
        { x: this.boardCX - laneBotW / 2, y: laneBotY },
      ],
      true,
    );
    // Perspective edge lines receding toward board
    lane.lineStyle(1, 0x0a2040, 0.5);
    lane.beginPath();
    lane.moveTo(this.boardCX - laneTopW / 2, laneTopY);
    lane.lineTo(this.boardCX - laneBotW / 2, laneBotY);
    lane.strokePath();
    lane.beginPath();
    lane.moveTo(this.boardCX + laneTopW / 2, laneTopY);
    lane.lineTo(this.boardCX + laneBotW / 2, laneBotY);
    lane.strokePath();
    // Faint center line
    lane.lineStyle(1, 0x0a2040, 0.3);
    lane.beginPath();
    lane.moveTo(this.boardCX, laneTopY);
    lane.lineTo(this.boardCX, laneBotY);
    lane.strokePath();
    // Distance markings
    for (let i = 1; i <= 4; i++) {
      const frac = i / 5;
      const lineY = laneTopY + (laneBotY - laneTopY) * frac;
      const lineW = laneTopW + (laneBotW - laneTopW) * frac;
      lane.lineStyle(1, 0x0d2848, 0.25 + frac * 0.1);
      lane.beginPath();
      lane.moveTo(this.boardCX - lineW / 2, lineY);
      lane.lineTo(this.boardCX + lineW / 2, lineY);
      lane.strokePath();
    }

    // ── Wall surface behind cabinet ───────────────────────────────────────────
    const wall = this.add.graphics().setDepth(-8);
    const wallW = this.boardRadius * 2.8;
    const wallH = this.boardRadius * 2.4;
    wall.fillStyle(0x0a0e1a, 1);
    wall.fillRect(
      this.boardCX - wallW / 2,
      this.boardCY - wallH * 0.55,
      wallW,
      wallH,
    );
    // Wall edge highlight top
    wall.lineStyle(2, 0x1a2a4a, 0.8);
    wall.beginPath();
    wall.moveTo(this.boardCX - wallW / 2, this.boardCY - wallH * 0.55);
    wall.lineTo(this.boardCX + wallW / 2, this.boardCY - wallH * 0.55);
    wall.strokePath();

    // ── Cabinet depth surround ────────────────────────────────────────────────
    const cabinet = this.add.graphics().setDepth(-7);
    const cabR = this.boardRadius * 1.18;
    // Cabinet face dark ring
    cabinet.lineStyle(this.boardRadius * 0.16, 0x060a14, 1);
    cabinet.strokeCircle(
      this.boardCX,
      this.boardCY,
      cabR - this.boardRadius * 0.08,
    );
    // Cabinet rim highlight (top-left light)
    cabinet.lineStyle(3, 0x1a3a5a, 0.9);
    cabinet.beginPath();
    cabinet.arc(
      this.boardCX,
      this.boardCY,
      cabR,
      Math.PI * 1.1,
      Math.PI * 1.9,
      false,
    );
    cabinet.strokePath();
    // Cabinet shadow (bottom-right)
    cabinet.lineStyle(3, 0x000205, 1);
    cabinet.beginPath();
    cabinet.arc(
      this.boardCX,
      this.boardCY,
      cabR,
      Math.PI * -0.1,
      Math.PI * 0.9,
      false,
    );
    cabinet.strokePath();
    // 3D depth panels — left side
    const depthSize = this.boardRadius * 0.12;
    cabinet.fillStyle(0x040810, 1);
    cabinet.fillRect(
      this.boardCX - cabR - depthSize,
      this.boardCY - cabR * 0.85,
      depthSize,
      cabR * 1.7,
    );
    // Right side panel
    cabinet.fillStyle(0x080c18, 1);
    cabinet.fillRect(
      this.boardCX + cabR,
      this.boardCY - cabR * 0.85,
      depthSize,
      cabR * 1.7,
    );
    // Bottom panel
    cabinet.fillStyle(0x060a12, 1);
    cabinet.fillRect(
      this.boardCX - cabR,
      this.boardCY + cabR * 0.82,
      cabR * 2,
      depthSize,
    );

    // Board glow halo behind the board
    const halo = this.add.graphics().setDepth(-5);
    for (let i = 6; i >= 1; i--) {
      halo.fillStyle(0x0066ff, 0.025 * i);
      halo.fillCircle(this.boardCX, this.boardCY, this.boardRadius + i * 18);
    }

    // ── Board container — vertically squashed for perspective tilt ────────────
    // The container is positioned at boardCX, boardCY and squashes Y by 13%
    // to simulate the board angled slightly away from the viewer.
    // All board drawing uses local coords (0,0) relative to container center.
    this.boardContainer = this.add
      .container(this.boardCX, this.boardCY)
      .setDepth(-6);
    this.boardContainer.setScale(1, 0.87);

    this.boardGfx = this.add.graphics();
    this.boardContainer.add(this.boardGfx);
    this._drawBoard();

    // 3D dome shading overlay — dark rim, lighter center, top-left highlight
    // This is drawn at absolute coords (not in container) so it covers the squashed board
    const boardShadeGfx = this.add.graphics().setDepth(-4);
    for (let i = 1; i <= 5; i++) {
      boardShadeGfx.fillStyle(0x000000, 0.055);
      boardShadeGfx.fillCircle(
        this.boardCX,
        this.boardCY,
        this.boardRadius - (i - 1) * 7,
      );
    }
    // Top-left highlight (light source from upper-left)
    boardShadeGfx.fillStyle(0xffffff, 0.06);
    boardShadeGfx.fillCircle(
      this.boardCX - this.boardRadius * 0.2,
      this.boardCY - this.boardRadius * 0.2,
      this.boardRadius * 0.45,
    );

    // Practice highlight — in boardContainer so it squashes with the board
    this.highlightGfx = this.add.graphics();
    this.boardContainer.add(this.highlightGfx);
    this._drawPracticeHighlight();

    // Score blocks stay at scene level (side UI bar)
    this.blocksGfx = this.add.graphics();
    this._drawScoreBlocks();

    // ── Atmospheric distance haze over board ──────────────────────────────────
    const haze = this.add.graphics().setDepth(3);
    for (let i = 1; i <= 4; i++) {
      const hazeR = this.boardRadius * (0.7 + i * 0.2);
      haze.fillStyle(0x010818, 0.06);
      haze.fillEllipse(this.boardCX, this.boardCY, hazeR * 2, hazeR * 1.6);
    }
    // Subtle blue-grey tint for distance effect
    haze.fillStyle(0x082244, 0.08);
    haze.fillCircle(this.boardCX, this.boardCY, this.boardRadius * 1.0);

    // Dart layers
    this.trailGfx = this.add.graphics();
    this.aimGfx = this.add.graphics().setDepth(9);
    this.targetRingGfx = this.add.graphics().setDepth(8);

    // Dart sprite — reverted to original smaller size for correct perspective
    this.dartSprite = this.add.image(
      this.dartStartX,
      this.dartStartY,
      "dart-sprite",
    );
    this.dartSprite.setAngle(180); // vertical sprite: 180 = tip pointing up toward board
    this.dartSprite.setScale(0.21);
    this.dartSprite.setDepth(10);

    this._buildStarField();
    this._setupHUD();
  }

  // ── Pipeline initialisation ───────────────────────────────────────────────────

  private _initLayers() {
    // ── Camera Layer (initialised first — other layers may call it) ───────────
    this.cameraLayer = new CameraLayer(this);

    // ── Layer 1: Input ───────────────────────────────────────────────────────
    this.inputLayer = new InputLayer(this);

    // Touch DOWN → enter hover/aim mode
    this.inputLayer.onDown = (x: number, y: number) => {
      if (this.dartFlying || this.dartSettled || this.gameOver) return;

      this.isAiming = true;
      this.intentStartX = x;
      this.intentStartY = y;
      this.fingerX = x;
      this.fingerY = y;

      // Snap dart to finger on touch-down (animate from here via update())
      const H = this.scale.height;
      const W = this.scale.width;
      const snapY = Math.max(
        H * HOVER_CFG.MIN_Y_FRAC,
        Math.min(H * HOVER_CFG.MAX_Y_FRAC, y),
      );
      const snapX = Math.max(W * 0.05, Math.min(W * 0.95, x));
      this.dartHoverX = snapX;
      this.dartHoverY = snapY;
      this.dartSprite.setPosition(snapX, snapY);

      if (navigator.vibrate) navigator.vibrate(20);
      this.cameraLayer.enterAim();
    };

    // Touch MOVE → update finger position; update() handles the smooth follow
    this.inputLayer.onMove = (x: number, y: number) => {
      if (
        !this.isAiming ||
        this.dartFlying ||
        this.dartSettled ||
        this.gameOver
      )
        return;
      this.fingerX = x;
      this.fingerY = y;

      // Camera subtle aim follow
      const dx = x - this.intentStartX;
      const dy = y - this.intentStartY;
      this.cameraLayer.updateAimFollow(dx, dy);
    };

    // Touch CANCEL (no movement) → treat as a slow throw from hover position
    this.inputLayer.onCancel = () => {
      if (
        this.isAiming &&
        !this.dartFlying &&
        !this.dartSettled &&
        !this.gameOver
      ) {
        // Tap-and-release: throw with minimum power using current hover position
        this._launchFromHover(POWER_CONFIG.MIN_SPEED);
      } else {
        this.aimGfx.clear();
        this.cameraLayer.enterIdle();
      }
      this.isAiming = false;
    };

    // Touch END with swipe → throw using swipe velocity + hover position
    this.inputLayer.onThrow = (rawInput) => {
      if (
        !this.isAiming ||
        this.dartFlying ||
        this.dartSettled ||
        this.gameOver
      )
        return;
      this.isAiming = false;
      this.aimGfx.clear();
      this._launchFromHover(rawInput.velocityMag);
    };

    this.inputLayer.enable();

    this.aimLayer = new AimLayer();
    this.powerLayer = new PowerLayer();
    this.throwArcLayer = new ThrowArcLayer();
    this.spinLayer = new SpinLayer(this.dartSprite);
    this.impactLayer = new ImpactLayer(this);
  }

  // ── Core throw launcher ───────────────────────────────────────────────────
  //
  // Called on every throw — from swipe (velocityMag = actual speed) or
  // tap-release (velocityMag = MIN_SPEED floor).
  // Uses the dart's CURRENT hover position as the physical launch point.
  //
  private _launchFromHover(velocityMag: number) {
    const H = this.scale.height;
    const W = this.scale.width;

    // Kill any existing ring tween from a previous throw
    if (this.currentRingTween) {
      this.currentRingTween.stop();
      this.currentRingTween = null;
      this.targetRingGfx.clear();
    }

    // ── 1. Vertical aim from dart Y position ─────────────────────────────────
    //
    // t=0  → dart at MIN_Y_FRAC (highest) → aims at top of board
    // t=1  → dart at MAX_Y_FRAC (lowest)  → aims at bottom of board
    //
    const minY = H * HOVER_CFG.MIN_Y_FRAC;
    const maxY = H * HOVER_CFG.MAX_Y_FRAC;
    const t = Math.max(
      0,
      Math.min(1, (this.dartHoverY - minY) / (maxY - minY)),
    );

    // Desired board hit Y (absolute screen coords)
    const boardTopHit =
      this.boardCY - this.boardRadius * HOVER_CFG.BOARD_HIT_TOP_FRAC;
    const boardBotHit =
      this.boardCY + this.boardRadius * HOVER_CFG.BOARD_HIT_BOT_FRAC;
    const desiredTargetY = boardTopHit + t * (boardBotHit - boardTopHit);

    // Convert to normY (inverse of ThrowArcLayer's target formula)
    // ThrowArcLayer: rawTargetY = boardCY + (1 + normY) * boardRadius * 1.15
    const normY =
      (desiredTargetY - this.boardCY) / (this.boardRadius * 1.15) - 1;

    // ── 2. Horizontal aim from dart X offset ─────────────────────────────────
    const dartOffsetX = this.dartHoverX - W / 2;
    const desiredTargetX = this.boardCX + dartOffsetX * HOVER_CFG.H_SPREAD;
    const normX = Math.max(
      -0.85,
      Math.min(
        0.85,
        (desiredTargetX - this.boardCX) /
          (this.boardRadius * ARC_CONFIG.powerMultiplier * 1.35),
      ),
    );

    const aimData: AimData = {
      normX,
      normY,
      aimAngleDeg: (Math.atan2(normY, normX) * 180) / Math.PI,
    };

    // ── 3. Power from swipe velocity + pull-back bonus ────────────────────────
    //
    // Pull-back: dart dragged below NEUTRAL_Y_FRAC adds up to PULL_BACK_MAX_BONUS.
    //
    const neutralY = H * HOVER_CFG.NEUTRAL_Y_FRAC;
    const pullBackDepth = Math.max(0, this.dartHoverY - neutralY);
    const pullBackFrac = Math.min(
      1,
      pullBackDepth / (H * HOVER_CFG.PULL_BACK_RANGE),
    );
    const pullBackBonus = pullBackFrac * HOVER_CFG.PULL_BACK_MAX_BONUS;

    // Normalise velocity → power (PowerLayer curve)
    const speed = Math.max(POWER_CONFIG.MIN_SPEED, velocityMag);
    const tLinear =
      Math.min(speed, POWER_CONFIG.MAX_SPEED) / POWER_CONFIG.MAX_SPEED;
    const basePower = tLinear ** POWER_CONFIG.CURVE_EXPONENT;
    const finalPower = Math.min(1.0, basePower + pullBackBonus);
    const flightDurationMs = Phaser.Math.Linear(
      POWER_CONFIG.MAX_FLIGHT_MS,
      POWER_CONFIG.MIN_FLIGHT_MS,
      finalPower,
    );
    const powerData: PowerData = {
      speed,
      power: finalPower,
      flightDurationMs,
    };

    // ── 4. Vertical upward bias from dart position ────────────────────────────
    //
    // Higher dart (low t) = more upward kick at launch = hits top section.
    // This controls arc height independently of target position.
    //
    const upwardBias =
      HOVER_CFG.UPWARD_BIAS_HIGH +
      t * (HOVER_CFG.UPWARD_BIAS_LOW - HOVER_CFG.UPWARD_BIAS_HIGH);

    // ── 5. Launch ──────────────────────────────────────────────────────────────
    this.lastThrowPower = finalPower;
    this.dartFlying = true;
    this.trailPoints = [];
    playThrowSound();

    this.cameraLayer.enterThrow(finalPower);
    this.time.delayedCall(100, () => {
      this.cameraLayer.enterFlight(this.dartHoverX, this.dartHoverY);
    });

    this.spinLayer.reset();
    // Ensure dart sprite is at hover position before flight begins
    this.dartSprite.setPosition(this.dartHoverX, this.dartHoverY);

    const arcResult = this.throwArcLayer.launch({
      scene: this,
      startX: this.dartHoverX,
      startY: this.dartHoverY,
      aim: aimData,
      power: powerData,
      boardCX: this.boardCX,
      boardCY: this.boardCY,
      boardRadius: this.boardRadius,
      stability: this.selectedDart.stability,
      weight: this.selectedDart.weight,
      upwardBiasOverride: upwardBias,
      onUpdate: (x, y, vx, vy) => {
        this.dartX = x;
        this.dartY = y;
        this.trailPoints.unshift({ x, y });
        if (this.trailPoints.length > 9) this.trailPoints.pop();
        this._redrawTrail();
        this.spinLayer.updatePosition(x, y, vx, vy);
        this.cameraLayer.updateFlight(x, y);
      },
      onComplete: (tx, ty, impactAngleDeg) => {
        this.spinLayer.settleOnImpact(this, impactAngleDeg);
        this.spinLayer.hide();

        this.dartFlying = false;
        this.dartSettled = true;
        this.trailPoints = [];
        this.trailGfx.clear();

        this.cameraLayer.enterImpact(this.lastThrowPower);

        const result = this.impactLayer.process(
          tx,
          ty,
          this.boardCX,
          this.boardCY,
          this.boardRadius,
          this.selectedDart.color,
        );

        this._onDartLanded(tx, ty, result);
      },
    });

    this.spinLayer.startFlight(
      this,
      powerData.flightDurationMs,
      arcResult.impactAngleDeg,
    );

    // ── Shrinking target ring (Darts of Fury style) ───────────────────────
    const ringTargetX = arcResult.targetX;
    const ringTargetY = arcResult.targetY;
    this.currentRingTween = this.tweens.addCounter({
      from: 65,
      to: 4,
      duration: powerData.flightDurationMs * 0.9,
      ease: "Sine.easeIn",
      onUpdate: (tween) => {
        const ringRadius = tween.getValue() ?? 65;
        this.targetRingGfx.clear();
        const progress = (65 - ringRadius) / 61;
        this.targetRingGfx.lineStyle(2.5, 0xffffff, 0.85 - progress * 0.4);
        this.targetRingGfx.strokeCircle(ringTargetX, ringTargetY, ringRadius);
        // Inner glow dot
        this.targetRingGfx.fillStyle(0xffffff, 0.25);
        this.targetRingGfx.fillCircle(
          ringTargetX,
          ringTargetY,
          Math.max(2, ringRadius * 0.2),
        );
        // Cross-hair lines
        const cr = Math.max(4, ringRadius * 0.5);
        this.targetRingGfx.lineStyle(1, 0xffffff, 0.4 - progress * 0.3);
        this.targetRingGfx.beginPath();
        this.targetRingGfx.moveTo(ringTargetX - cr, ringTargetY);
        this.targetRingGfx.lineTo(ringTargetX + cr, ringTargetY);
        this.targetRingGfx.moveTo(ringTargetX, ringTargetY - cr);
        this.targetRingGfx.lineTo(ringTargetX, ringTargetY + cr);
        this.targetRingGfx.strokePath();
      },
      onComplete: () => {
        this.targetRingGfx.clear();
        // Brief impact flash
        this.targetRingGfx.fillStyle(0xffffff, 0.7);
        this.targetRingGfx.fillCircle(ringTargetX, ringTargetY, 16);
        this.time.delayedCall(100, () => this.targetRingGfx.clear());
        this.currentRingTween = null;
      },
    }) as Phaser.Tweens.Tween;
  }

  // ── Hover aim indicator ───────────────────────────────────────────────────
  //
  // Called every frame from update() while aiming.
  // Shows a parabolic arc from dart's current hover position to predicted hit.
  //
  private _drawHoverAimIndicator() {
    const g = this.aimGfx;
    g.clear();

    const H = this.scale.height;
    const W = this.scale.width;
    const minY = H * HOVER_CFG.MIN_Y_FRAC;
    const maxY = H * HOVER_CFG.MAX_Y_FRAC;
    const t = Math.max(
      0,
      Math.min(1, (this.dartHoverY - minY) / (maxY - minY)),
    );

    // Compute aim data (same logic as _launchFromHover)
    const boardTopHit =
      this.boardCY - this.boardRadius * HOVER_CFG.BOARD_HIT_TOP_FRAC;
    const boardBotHit =
      this.boardCY + this.boardRadius * HOVER_CFG.BOARD_HIT_BOT_FRAC;
    const desiredTargetY = boardTopHit + t * (boardBotHit - boardTopHit);
    const normY =
      (desiredTargetY - this.boardCY) / (this.boardRadius * 1.15) - 1;
    const dartOffsetX = this.dartHoverX - W / 2;
    const normX = Math.max(
      -0.85,
      Math.min(
        0.85,
        (this.boardCX + dartOffsetX * HOVER_CFG.H_SPREAD - this.boardCX) /
          (this.boardRadius * ARC_CONFIG.powerMultiplier * 1.35),
      ),
    );
    const aimData: AimData = { normX, normY, aimAngleDeg: 0 };

    // Pull-back bonus for preview power estimate
    const neutralY = H * HOVER_CFG.NEUTRAL_Y_FRAC;
    const pullBackBonus = Math.min(
      HOVER_CFG.PULL_BACK_MAX_BONUS,
      (Math.max(0, this.dartHoverY - neutralY) /
        (H * HOVER_CFG.PULL_BACK_RANGE)) *
        HOVER_CFG.PULL_BACK_MAX_BONUS,
    );

    // Medium power preview
    const previewPower: PowerData = {
      speed: 800,
      power: Math.max(0.35, Math.min(0.85, 0.5 + pullBackBonus)),
      flightDurationMs: 420,
    };

    const upwardBias =
      HOVER_CFG.UPWARD_BIAS_HIGH +
      t * (HOVER_CFG.UPWARD_BIAS_LOW - HOVER_CFG.UPWARD_BIAS_HIGH);

    // Preview arc dots
    const dots = this.throwArcLayer.previewDots(
      this.dartHoverX,
      this.dartHoverY,
      aimData,
      previewPower,
      this.boardCX,
      this.boardCY,
      this.boardRadius,
      10,
      upwardBias,
    );
    for (const dot of dots) {
      g.fillStyle(0x00e8ff, dot.alpha);
      g.fillCircle(dot.x, dot.y, dot.radius);
    }

    // Aim reticle on board showing predicted hit zone
    const boardAimX = this.boardCX + normX * this.boardRadius * 0.7;
    // Use (1 + normY) * 0.7 so the reticle maps within the board ring
    const boardAimY = this.boardCY + (1 + normY) * this.boardRadius * 0.55;
    g.fillStyle(0x00e8ff, 0.45);
    g.fillCircle(boardAimX, boardAimY, 7);
    g.lineStyle(1.5, 0x00e8ff, 0.6);
    g.strokeCircle(boardAimX, boardAimY, 12);

    // Pull-back power ring around dart
    if (this.dartHoverY > neutralY + 10) {
      const ringR = 20 + pullBackBonus * 30;
      const intensity = pullBackBonus / HOVER_CFG.PULL_BACK_MAX_BONUS;
      const r = Math.round(255 * intensity);
      const gb = Math.round(200 - intensity * 100);
      g.lineStyle(2, (r << 16) | (gb << 8) | gb, 0.7);
      g.strokeCircle(this.dartHoverX, this.dartHoverY, ringR);
    }
  }

  // ── Landing & scoring ─────────────────────────────────────────────────────

  private _onDartLanded(
    wx: number,
    wy: number,
    result: ReturnType<ImpactLayer["process"]>,
  ) {
    const col = hexColor(this.selectedDart.color);
    this.landings.push({ wx, wy, color: col, label: result.label });

    // Place a landed dart sprite at impact angle
    const landed = this.add.image(wx, wy, "dart-sprite");
    landed.setAngle(180); // tip up into board, flights toward viewer
    landed.setScale(0.21);
    landed.setDepth(8);
    landed.setTint(col);
    this.landedDartImages.push(landed);

    this.labelText.setText(result.label);
    this.labelText.setColor(
      result.multiplier === 3
        ? "#ff40b0"
        : result.multiplier === 2
          ? "#00e8ff"
          : "#ffffff",
    );

    this._applyScore(result);
    this.currentDartInTurn++;
    this._updateHUD();
    this._flashDartIndicator();

    if (this.currentDartInTurn >= 3) {
      this.time.delayedCall(1100, () => this._endTurn());
    } else {
      this.time.delayedCall(500, () => {
        this.dartSettled = false;
        this.isAiming = false;
        this.dartX = this.dartStartX;
        this.dartY = this.dartStartY;
        this.dartHoverX = this.dartStartX;
        this.dartHoverY = this.dartStartY;
        this.dartSprite.setPosition(this.dartStartX, this.dartStartY);
        this.dartSprite.setAngle(180);
        this.spinLayer.reset();
        this.spinLayer.show();
        this.cameraLayer.enterIdle();
      });
    }
  }

  private _applyScore(result: {
    score: number;
    multiplier: number;
    segment: number;
  }) {
    if (this.gameMode === "301" || this.gameMode === "practice-301") {
      this.dartScoresThisTurn.push(result.score);
    } else if (this.gameMode === "around-world") {
      if (result.segment === this.practiceTarget) {
        this.practiceTarget =
          this.practiceTarget >= 20 ? 1 : this.practiceTarget + 1;
        this._drawPracticeHighlight();
      }
      this.dartScoresThisTurn.push(result.score);
    } else {
      this.dartScoresThisTurn.push(result.score);
    }
  }

  private _endTurn() {
    if (this.gameMode === "301") {
      const total = this.dartScoresThisTurn.reduce((a, b) => a + b, 0);
      const next = this.turnStartScore - total;
      if (next < 0 || next === 1) {
        this.score301 = this.turnStartScore;
        this._showBust();
      } else if (next === 0) {
        const last = this.landings[this.landings.length - 1];
        if (
          last &&
          (last.label.startsWith("D") || last.label === "BULLSEYE!")
        ) {
          this.score301 = 0;
          this._showWin();
          return;
        }
        this.score301 = this.turnStartScore;
        this._showBust();
      } else {
        this.score301 = next;
      }
      this.turnStartScore = this.score301;
    } else if (this.gameMode === "practice-301") {
      const total = this.dartScoresThisTurn.reduce((a, b) => a + b, 0);
      this.score301 = Math.max(0, this.score301 - total);
      if (this.score301 === 0) {
        this.labelText.setText("FINISH!").setColor("#40ff80");
        this.time.delayedCall(1800, () => {
          this.score301 = 301;
          this.turnStartScore = 301;
          this._resetTurn();
        });
        return;
      }
      this.turnStartScore = this.score301;
    }
    this._resetTurn();
  }

  private _resetTurn() {
    this.currentDartInTurn = 0;
    this.dartScoresThisTurn = [];
    this.landings = [];
    for (const img of this.landedDartImages) img.destroy();
    this.landedDartImages = [];
    this.labelText.setText("");
    this.lastScoresText.setText("");
    this.dartSettled = false;
    this.isAiming = false;
    this.dartX = this.dartStartX;
    this.dartY = this.dartStartY;
    this.dartHoverX = this.dartStartX;
    this.dartHoverY = this.dartStartY;
    this.dartSprite.setPosition(this.dartStartX, this.dartStartY);
    this.targetRingGfx.clear();
    this.dartSprite.setAngle(180);
    this.spinLayer.reset();
    this.spinLayer.show();
    this.cameraLayer.enterIdle();
    this._updateHUD();
  }

  private _showBust() {
    this.cameras.main.shake(420, 0.012);
    this.labelText.setText("BUST!").setColor("#ff4400");
    this.time.delayedCall(900, () => this.labelText.setColor("#ffffff"));
  }

  private _showWin() {
    this.gameOver = true;
    const W = this.scale.width;
    const H = this.scale.height;
    const winOverlay = this.add
      .rectangle(W / 2, H / 2, W, H, 0x000000, 0.65)
      .setDepth(50);
    const win = this.add
      .text(W / 2, H / 2 - 44, "🎯  CHECKOUT!", {
        fontSize: `${Math.max(36, Math.round(H * 0.075))}px`,
        color: "#ffdd00",
        fontFamily: "Bricolage Grotesque, sans-serif",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(51);
    const sub = this.add
      .text(W / 2, H / 2 + 30, "TAP TO PLAY AGAIN", {
        fontSize: `${Math.max(16, Math.round(H * 0.028))}px`,
        color: "#9999ff",
        fontFamily: "Bricolage Grotesque, sans-serif",
      })
      .setOrigin(0.5)
      .setDepth(51);
    this.input.once("pointerdown", () => {
      winOverlay.destroy();
      win.destroy();
      sub.destroy();
      this.scene.start("DartSelectionScene");
    });
  }

  // ── Trail ─────────────────────────────────────────────────────────────────

  private _redrawTrail() {
    const g = this.trailGfx;
    g.clear();
    const col = hexColor(this.selectedDart.color);
    for (let i = 0; i < this.trailPoints.length; i++) {
      const pt = this.trailPoints[i];
      const alpha = (1 - i / this.trailPoints.length) * 0.65;
      const radius = Math.max(0.8, 4 - i * 0.45);
      g.fillStyle(col, alpha);
      g.fillCircle(pt.x, pt.y, radius);
    }
  }

  // ── Board drawing ─────────────────────────────────────────────────────────
  // All coords are LOCAL to boardContainer (0,0 = container center = boardCX, boardCY)

  private _drawBoard() {
    const g = this.boardGfx;
    g.clear();
    // Local coords — container is positioned at boardCX, boardCY
    const cx = 0;
    const cy = 0;
    const r = this.boardRadius;

    const R_BE = r * 0.05;
    const R_BL = r * 0.12;
    const R_TI = r * 0.535;
    const R_TO = r * 0.622;
    const R_DI = r * 0.855;
    const R_DO = r * 0.955;

    // Outer glow rings
    for (let i = 5; i >= 1; i--) {
      g.lineStyle(i * 7, 0x0088ff, 0.09 * (6 - i));
      g.strokeCircle(cx, cy, R_DO + i * 10);
    }

    // Dark board base
    g.fillStyle(0x020814, 1);
    g.fillCircle(cx, cy, R_DO);

    // Draw segments
    for (let i = 0; i < 20; i++) {
      const sA = (i * 18 - 9 - 90) * (Math.PI / 180);
      const eA = (i * 18 + 9 - 90) * (Math.PI / 180);
      const even = i % 2 === 0;

      this._fillSlice(
        g,
        cx,
        cy,
        R_BL,
        R_TI,
        sA,
        eA,
        even ? 0x0a1a3a : 0x060f24,
        0.9,
      );
      this._fillSlice(
        g,
        cx,
        cy,
        R_TO,
        R_DI,
        sA,
        eA,
        even ? 0x0a1a3a : 0x060f24,
        0.9,
      );
      this._fillSlice(
        g,
        cx,
        cy,
        R_TI,
        R_TO,
        sA,
        eA,
        even ? 0x00ccff : 0xff00cc,
        1.0,
      );
      this._fillSlice(
        g,
        cx,
        cy,
        R_DI,
        R_DO,
        sA,
        eA,
        even ? 0xff6600 : 0xff0033,
        1.0,
      );
    }

    // Bullseye
    g.fillStyle(0xff2200, 1.0);
    g.fillCircle(cx, cy, R_BL);
    g.fillStyle(0xff6600, 1.0);
    g.fillCircle(cx, cy, R_BE);
    g.fillStyle(0xffff00, 1);
    g.fillCircle(cx, cy, R_BE * 0.45);

    // Segment dividers
    g.lineStyle(1.5, 0x4499ee, 0.9);
    for (let i = 0; i < 20; i++) {
      const angle = (i * 18 - 9 - 90) * (Math.PI / 180);
      g.beginPath();
      g.moveTo(cx + Math.cos(angle) * R_BL, cy + Math.sin(angle) * R_BL);
      g.lineTo(cx + Math.cos(angle) * R_DO, cy + Math.sin(angle) * R_DO);
      g.strokePath();
    }

    // Ring outlines — neon glow two-pass
    // Triple rings glow pass
    g.lineStyle(6, 0x00eeff, 0.3);
    for (const ring of [R_TI, R_TO]) g.strokeCircle(cx, cy, ring);
    g.lineStyle(3, 0x00ffff, 1.0);
    for (const ring of [R_TI, R_TO]) g.strokeCircle(cx, cy, ring);
    // Double rings glow pass
    g.lineStyle(6, 0xff0088, 0.3);
    for (const ring of [R_DI, R_DO]) g.strokeCircle(cx, cy, ring);
    g.lineStyle(3, 0xff44aa, 1.0);
    for (const ring of [R_DI, R_DO]) g.strokeCircle(cx, cy, ring);
    g.lineStyle(1, 0x334466, 0.6);
    g.strokeCircle(cx, cy, R_BL);

    // Number labels — added to boardContainer so they squash with the board
    const labelR = R_DO + r * 0.075;
    const fontSize = Math.max(12, Math.round(r * 0.068));
    for (let i = 0; i < 20; i++) {
      const angle = (i * 18 - 90) * (Math.PI / 180);
      const t = this.add.text(
        cx + Math.cos(angle) * labelR,
        cy + Math.sin(angle) * labelR,
        String(SEGMENT_ORDER[i]),
        {
          fontSize: `${fontSize}px`,
          color: "#ffffff",
          fontFamily: "JetBrains Mono, monospace",
          fontStyle: "bold",
          stroke: "#000022",
          strokeThickness: 3,
        },
      );
      t.setOrigin(0.5, 0.5);
      this.boardContainer.add(t);
    }
  }

  private _buildStarField() {
    const W = this.scale.width;
    const H = this.scale.height;
    this._starGfx = this.add.graphics().setDepth(-8);
    const count = 250;
    for (let i = 0; i < count; i++) {
      this._stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r:
          Math.random() < 0.85
            ? 0.8 + Math.random() * 1.0
            : 1.5 + Math.random() * 1.5,
        baseAlpha: 0.3 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 1.5,
      });
    }
  }

  private _updateStars(_delta: number) {
    const g = this._starGfx;
    g.clear();
    const t = this.time.now / 1000;
    for (const s of this._stars) {
      const twinkle = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
      const alpha = s.baseAlpha * twinkle;
      const color = s.r > 1.8 ? 0x88ccff : 0xffffff;
      g.fillStyle(color, alpha);
      g.fillCircle(s.x, s.y, s.r);
    }
  }

  private _fillSlice(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    innerR: number,
    outerR: number,
    startA: number,
    endA: number,
    color: number,
    alpha: number,
  ) {
    const steps = 10;
    const pts: Phaser.Types.Math.Vector2Like[] = [];
    for (let s = 0; s <= steps; s++) {
      const a = startA + (endA - startA) * (s / steps);
      pts.push({ x: cx + Math.cos(a) * innerR, y: cy + Math.sin(a) * innerR });
    }
    for (let s = steps; s >= 0; s--) {
      const a = startA + (endA - startA) * (s / steps);
      pts.push({ x: cx + Math.cos(a) * outerR, y: cy + Math.sin(a) * outerR });
    }
    g.fillStyle(color, alpha);
    g.fillPoints(pts, true);
  }

  private _drawPracticeHighlight() {
    const g = this.highlightGfx;
    g.clear();
    // Local coords — highlightGfx is in boardContainer
    const cx = 0;
    const cy = 0;
    const r = this.boardRadius;

    if (this.gameMode === "around-world") {
      const segIdx = SEGMENT_ORDER.indexOf(this.practiceTarget);
      if (segIdx >= 0) {
        const sA = (segIdx * 18 - 9 - 90) * (Math.PI / 180);
        const eA = (segIdx * 18 + 9 - 90) * (Math.PI / 180);
        this._fillSlice(g, cx, cy, r * 0.12, r * 0.955, sA, eA, 0xffff00, 0.28);
      }
    } else if (this.gameMode === "doubles") {
      const mid = r * ((0.855 + 0.955) / 2);
      g.lineStyle(r * (0.955 - 0.855), 0x00ffff, 0.3);
      g.strokeCircle(cx, cy, mid);
    } else if (this.gameMode === "triples") {
      const mid = r * ((0.535 + 0.622) / 2);
      g.lineStyle(r * (0.622 - 0.535), 0xff00ff, 0.3);
      g.strokeCircle(cx, cy, mid);
    }
  }

  private _drawScoreBlocks() {
    const g = this.blocksGfx;
    g.clear();
    if (this.gameMode !== "301" && this.gameMode !== "practice-301") return;

    const W = this.scale.width;
    const H = this.scale.height;
    const bx = W - 34;
    const byBottom = H * 0.87;
    const totalH = H * 0.52;
    const count = 30;
    const bh = totalH / count - 1.5;
    const bw = 22;
    const fraction = this.score301 / 301;
    const filled = Math.ceil(fraction * count);

    g.fillStyle(0x010510, 0.55);
    g.fillRoundedRect(
      bx - bw / 2 - 7,
      byBottom - totalH - 8,
      bw + 14,
      totalH + 16,
      5,
    );

    for (let i = 0; i < count; i++) {
      const y = byBottom - (i + 1) * (bh + 1.5);
      if (i < filled) {
        const tBlock = i / count;
        const red = Math.round(255 * (1 - tBlock));
        const grn = Math.round(136 + 96 * tBlock);
        const blu = Math.round(255 * tBlock);
        g.fillStyle((red << 16) | (grn << 8) | blu, 1);
      } else {
        g.fillStyle(0x0a1020, 0.7);
      }
      g.fillRoundedRect(bx - bw / 2, y, bw, bh, 2);
    }
  }

  // ── HUD ───────────────────────────────────────────────────────────────────

  private _setupHUD() {
    const W = this.scale.width;
    const H = this.scale.height;
    const pad = 10;

    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x010510, 0.78);
    hudBg.fillRoundedRect(W * 0.04, pad, W * 0.92, H * 0.12, 10);
    hudBg.lineStyle(1, 0x1a3a6a, 1);
    hudBg.strokeRoundedRect(W * 0.04, pad, W * 0.92, H * 0.12, 10);

    const scoreSz = Math.max(28, Math.round(H * 0.058));
    this.scoreText = this.add
      .text(W / 2, pad + 4, this._getScoreLabel(), {
        fontSize: `${scoreSz}px`,
        color: "#00e8ff",
        fontFamily: "JetBrains Mono, monospace",
        stroke: "#001a22",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0);

    const smallSz = Math.max(12, Math.round(H * 0.021));
    this.dartIndicatorText = this.add
      .text(W / 2, pad + scoreSz + 8, "◆ DART 1 / 3", {
        fontSize: `${smallSz}px`,
        color: "#7788aa",
        fontFamily: "Bricolage Grotesque, sans-serif",
      })
      .setOrigin(0.5, 0);

    this.lastScoresText = this.add
      .text(W * 0.055, pad + 8, "", {
        fontSize: `${smallSz}px`,
        color: "#ffcc66",
        fontFamily: "JetBrains Mono, monospace",
      })
      .setOrigin(0, 0);

    this.labelText = this.add
      .text(W / 2, this.boardCY + this.boardRadius + 16, "", {
        fontSize: `${Math.max(18, Math.round(H * 0.038))}px`,
        color: "#ffffff",
        fontFamily: "Bricolage Grotesque, sans-serif",
        fontStyle: "bold",
        stroke: "#000033",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0);

    const modeNames: Record<string, string> = {
      "301": "301 · DOUBLE OUT",
      "around-world": "AROUND THE WORLD",
      doubles: "DOUBLES PRACTICE",
      triples: "TRIPLES PRACTICE",
      "practice-301": "PRACTICE 301",
    };
    this.add
      .text(W / 2, H - 10, modeNames[this.gameMode] ?? this.gameMode, {
        fontSize: `${Math.max(10, Math.round(H * 0.016))}px`,
        color: "#223344",
        fontFamily: "JetBrains Mono, monospace",
      })
      .setOrigin(0.5, 1);

    const menuBtn = this.add
      .text(W - 10, H - 10, "MENU", {
        fontSize: `${Math.max(11, Math.round(H * 0.018))}px`,
        color: "#334466",
        fontFamily: "JetBrains Mono, monospace",
      })
      .setOrigin(1, 1)
      .setInteractive({ useHandCursor: true });
    menuBtn.on("pointerdown", () => this.scene.start("DartSelectionScene"));
    menuBtn.on("pointerover", () => menuBtn.setColor("#6688cc"));
    menuBtn.on("pointerout", () => menuBtn.setColor("#334466"));
  }

  private _getScoreLabel(): string {
    if (this.gameMode === "301" || this.gameMode === "practice-301")
      return String(this.score301);
    if (this.gameMode === "around-world")
      return `TARGET  ${this.practiceTarget}`;
    return "PRACTICE";
  }

  private _updateHUD() {
    this.scoreText.setText(this._getScoreLabel());
    this.dartIndicatorText.setText(`◆ DART ${this.currentDartInTurn + 1} / 3`);
    if (this.dartScoresThisTurn.length > 0) {
      this.lastScoresText.setText(this.dartScoresThisTurn.join("  +  "));
    }
    this._drawScoreBlocks();
  }

  private _flashDartIndicator() {
    if (this.currentDartInTurn < 3) {
      this.dartIndicatorText.setText(
        `◆ DART ${this.currentDartInTurn + 1} / 3`,
      );
      this.tweens.add({
        targets: this.dartIndicatorText,
        scaleX: 1.35,
        scaleY: 1.35,
        duration: 110,
        yoyo: true,
        ease: "Power2.easeOut",
      });
    }
  }
}
