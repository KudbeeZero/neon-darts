/**
 * GAME SCENE
 * ----------
 * Orchestrates the throw pipeline. Each layer has one job:
 *
 *   InputLayer    →  RawInputData
 *   AimLayer      →  AimData
 *   PowerLayer    →  PowerData
 *   ThrowArcLayer →  drives tween, fires onUpdate / onComplete
 *   SpinLayer     →  dart sprite rotation
 *   ImpactLayer   →  ImpactResult + effects
 *   CameraLayer   →  all camera state / motion
 *
 * This scene owns: board drawing, HUD, score state, turn management.
 * It does NOT contain any physics, direction math, or effect code.
 */

import Phaser from "phaser";
import { DART_CONFIGS, type DartConfig } from "../../types/dart";
import { playThrowSound } from "../audio";

import { AimLayer } from "../layers/AimLayer";
import { CameraLayer } from "../layers/CameraLayer";
import { ImpactLayer } from "../layers/ImpactLayer";
import { InputLayer } from "../layers/InputLayer";
import { PowerLayer } from "../layers/PowerLayer";
import { SpinLayer } from "../layers/SpinLayer";
import { ThrowArcLayer } from "../layers/ThrowArcLayer";

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
  private boardGfx!: Phaser.GameObjects.Graphics;
  private highlightGfx!: Phaser.GameObjects.Graphics;
  private blocksGfx!: Phaser.GameObjects.Graphics;
  private trailGfx!: Phaser.GameObjects.Graphics;
  private aimGfx!: Phaser.GameObjects.Graphics;

  // Dart sprite
  private dartSprite!: Phaser.GameObjects.Image;
  private dartStartX = 0;
  private dartStartY = 0;
  private dartX = 0;
  private dartY = 0;
  private dartFlying = false;
  private dartSettled = false;
  private trailPoints: Array<{ x: number; y: number }> = [];

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

  // Aim indicator state (fed from InputLayer callbacks)
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
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.boardCX = W / 2;
    this.boardCY = H * 0.34;
    this.boardRadius = Math.min(W, H) * 0.43;
    this.dartStartX = W / 2;
    this.dartStartY = H * 0.62;
    this.dartX = this.dartStartX;
    this.dartY = this.dartStartY;

    this._buildScene();
    this._initLayers();
  }

  // ── Scene construction ─────────────────────────────────────────────────────

  private _buildScene() {
    const W = this.scale.width;
    const H = this.scale.height;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x000008, 1);
    bg.fillRect(0, 0, W, H);
    for (let i = 0; i < 110; i++) {
      bg.fillStyle(0xffffff, 0.2 + Math.random() * 0.5);
      bg.fillCircle(
        Math.random() * W,
        Math.random() * H,
        Math.random() < 0.15 ? 1.4 : 0.65,
      );
    }

    // Stage lighting cone
    const light = this.add.graphics();
    light.fillStyle(0x1040a0, 0.06);
    light.fillTriangle(W / 2 - 10, 0, W / 2 + 10, 0, W / 2 + W * 0.45, H * 0.7);
    light.fillStyle(0x1040a0, 0.03);
    light.fillTriangle(W / 2 - 10, 0, W / 2 + 10, 0, W / 2 - W * 0.45, H * 0.7);

    // Board
    this.boardGfx = this.add.graphics();
    this._drawBoard();
    this.highlightGfx = this.add.graphics();
    this._drawPracticeHighlight();
    this.blocksGfx = this.add.graphics();
    this._drawScoreBlocks();

    // Dart layers
    this.trailGfx = this.add.graphics();
    this.aimGfx = this.add.graphics().setDepth(9);

    // Dart sprite
    this.dartSprite = this.add.image(
      this.dartStartX,
      this.dartStartY,
      "dart-sprite",
    );
    this.dartSprite.setAngle(-90);
    this.dartSprite.setScale(0.28);
    this.dartSprite.setDepth(10);

    this._setupHUD();
  }

  // ── Pipeline initialisation ───────────────────────────────────────────────────

  private _initLayers() {
    // ── Camera Layer (initialised first — other layers may call it) ───────────
    this.cameraLayer = new CameraLayer(this);

    // ── Layer 1: Input ───────────────────────────────────────────────────────
    this.inputLayer = new InputLayer(this);

    this.inputLayer.onDown = (_x, _y) => {
      if (this.dartFlying || this.dartSettled || this.gameOver) return;
      this.intentStartX = _x;
      this.intentStartY = _y;
      if (navigator.vibrate) navigator.vibrate(20);
      // Camera: enter aim state (micro zoom-in)
      this.cameraLayer.enterAim();
    };

    this.inputLayer.onMove = (x, y) => {
      if (this.dartFlying || this.dartSettled || this.gameOver) return;
      this._drawAimIndicator(x, y);
      // Camera: subtle micro-follow during aim
      const dx = x - this.intentStartX;
      const dy = y - this.intentStartY;
      this.cameraLayer.updateAimFollow(dx, dy);
    };

    this.inputLayer.onCancel = () => {
      this.aimGfx.clear();
      // Camera: return to idle
      this.cameraLayer.enterIdle();
    };

    this.inputLayer.onThrow = (rawInput) => {
      if (this.dartFlying || this.dartSettled || this.gameOver) return;
      this.aimGfx.clear();

      // ── Layer 2: Aim ────────────────────────────────────────────────────────
      const aim = this.aimLayer.calculate(rawInput);

      // ── Layer 3: Power ───────────────────────────────────────────────────────
      const power = this.powerLayer.calculate(rawInput);
      this.lastThrowPower = power.power;

      // Start flight
      this.dartFlying = true;
      this.trailPoints = [];
      playThrowSound();

      // Camera: throw release impulse
      this.cameraLayer.enterThrow(power.power);

      // ── Layer 5: Spin (starts alongside arc) ───────────────────────────────
      this.spinLayer.reset();
      this.spinLayer.startFlight(this, power.flightDurationMs);

      // Short delay then enter flight-follow (lets throw impulse play first)
      this.time.delayedCall(100, () => {
        this.cameraLayer.enterFlight(this.dartX, this.dartY);
      });

      // ── Layer 4: Throw/Arc ────────────────────────────────────────────────
      this.throwArcLayer.launch({
        scene: this,
        startX: this.dartStartX,
        startY: this.dartStartY,
        aim,
        power,
        boardCX: this.boardCX,
        boardCY: this.boardCY,
        boardRadius: this.boardRadius,
        stability: this.selectedDart.stability,
        weight: this.selectedDart.weight,
        onUpdate: (x, y) => {
          this.dartX = x;
          this.dartY = y;
          this.trailPoints.unshift({ x, y });
          if (this.trailPoints.length > 9) this.trailPoints.pop();
          this._redrawTrail();
          // Spin layer tracks dart position each frame
          this.spinLayer.updatePosition(x, y);
          // Camera: smooth follow during flight
          this.cameraLayer.updateFlight(x, y);
        },
        onComplete: (tx, ty) => {
          // ── Layer 5: Spin settle ──────────────────────────────────────
          this.spinLayer.settleOnImpact(this);
          this.spinLayer.hide();

          this.dartFlying = false;
          this.dartSettled = true;
          this.trailPoints = [];
          this.trailGfx.clear();

          // Camera: impact state (shake + snap back)
          this.cameraLayer.enterImpact(this.lastThrowPower);

          // ── Layer 6: Impact ───────────────────────────────────────────
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
    };

    this.inputLayer.enable();

    // Instantiate stateless/scene-bound layers
    this.aimLayer = new AimLayer();
    this.powerLayer = new PowerLayer();
    this.throwArcLayer = new ThrowArcLayer();
    this.spinLayer = new SpinLayer(this.dartSprite);
    this.impactLayer = new ImpactLayer(this);
  }

  // ── Aim indicator (pure visual — reads aim+power from current pointer) ──────

  private _drawAimIndicator(px: number, py: number) {
    const g = this.aimGfx;
    g.clear();

    const swipeX = px - this.intentStartX;
    const swipeY = py - this.intentStartY;
    const swipeDist = Math.sqrt(swipeX * swipeX + swipeY * swipeY);
    if (swipeDist < 2) return;

    // Synthetic input snapshot so aim/power layers can preview
    const swipeLen = swipeDist || 1;
    const fakeInput = {
      startX: this.intentStartX,
      startY: this.intentStartY,
      endX: px,
      endY: py,
      dirX: swipeX / swipeLen,
      dirY: swipeY / swipeLen,
      velocityX: (swipeX / 0.1) * 1000,
      velocityY: (swipeY / 0.1) * 1000,
      velocityMag: swipeDist * 6,
      swipeDistance: swipeDist,
      swipeDuration: 100,
      history: [
        { x: this.intentStartX, y: this.intentStartY, t: 0 },
        { x: px, y: py, t: 100 },
      ],
      isValidThrow: true,
    };
    const aim = this.aimLayer.calculate(fakeInput);
    const power = this.powerLayer.calculate(fakeInput);

    // Trajectory dots
    const dots = this.throwArcLayer.previewDots(
      this.dartStartX,
      this.dartStartY,
      aim,
      power,
    );
    for (const dot of dots) {
      g.fillStyle(0x00e8ff, dot.alpha);
      g.fillCircle(dot.x, dot.y, dot.radius);
    }

    // Power ring on dart
    const minR = 18;
    const maxR = 38;
    const circR = minR + power.power * (maxR - minR);
    const r = Math.round(power.power * 255);
    const gb = Math.round(232 - power.power * 100);
    const ringColor = (r << 16) | (gb << 8) | gb;
    g.lineStyle(2, ringColor, 0.7);
    g.strokeCircle(this.dartStartX, this.dartStartY, circR);

    // Aim dot on board
    const boardAimX = this.boardCX + aim.normX * this.boardRadius * 0.55;
    const boardAimY = this.boardCY + aim.normY * this.boardRadius * 0.55;
    g.fillStyle(0x00e8ff, 0.45);
    g.fillCircle(boardAimX, boardAimY, 7);
    g.lineStyle(1.5, 0x00e8ff, 0.6);
    g.strokeCircle(boardAimX, boardAimY, 11);
  }

  // ── Landing & scoring ─────────────────────────────────────────────────────

  private _onDartLanded(
    wx: number,
    wy: number,
    result: ReturnType<ImpactLayer["process"]>,
  ) {
    const col = hexColor(this.selectedDart.color);
    this.landings.push({ wx, wy, color: col, label: result.label });

    // Place a landed dart sprite
    const landed = this.add.image(wx, wy, "dart-sprite");
    landed.setAngle(-80);
    landed.setScale(0.18);
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
        this.dartX = this.dartStartX;
        this.dartY = this.dartStartY;
        this.spinLayer.reset();
        this.spinLayer.show();
        // Camera: return to idle between darts
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
    this.dartX = this.dartStartX;
    this.dartY = this.dartStartY;
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
    const overlay = this.add
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
      overlay.destroy();
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

  private _drawBoard() {
    const g = this.boardGfx;
    g.clear();
    const cx = this.boardCX;
    const cy = this.boardCY;
    const r = this.boardRadius;

    const R_BE = r * 0.05;
    const R_BL = r * 0.12;
    const R_TI = r * 0.535;
    const R_TO = r * 0.622;
    const R_DI = r * 0.855;
    const R_DO = r * 0.955;

    for (let i = 4; i >= 1; i--) {
      g.lineStyle(i * 6, 0x1e3a80, 0.07 * (5 - i));
      g.strokeCircle(cx, cy, R_DO + i * 9);
    }
    g.fillStyle(0x050a14, 1);
    g.fillCircle(cx, cy, R_DO);

    const boardBg = this.add.image(cx, cy, "dartboard-bg");
    boardBg.setDisplaySize(r * 2.1, r * 2.1);
    boardBg.setAlpha(0.85);

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
        even ? 0x050a14 : 0x03060e,
        0.45,
      );
      this._fillSlice(
        g,
        cx,
        cy,
        R_TO,
        R_DI,
        sA,
        eA,
        even ? 0x050a14 : 0x03060e,
        0.45,
      );
      this._fillSlice(
        g,
        cx,
        cy,
        R_TI,
        R_TO,
        sA,
        eA,
        even ? 0x1a7fff : 0x9933ff,
        0.45,
      );
      this._fillSlice(
        g,
        cx,
        cy,
        R_DI,
        R_DO,
        sA,
        eA,
        even ? 0xff8800 : 0xcc1133,
        0.45,
      );
    }

    g.fillStyle(0xdd4400, 0.6);
    g.fillCircle(cx, cy, R_BL);
    g.fillStyle(0xff2200, 0.7);
    g.fillCircle(cx, cy, R_BE);

    g.lineStyle(1.5, 0x1e2a50, 1);
    for (let i = 0; i < 20; i++) {
      const angle = (i * 18 - 9 - 90) * (Math.PI / 180);
      g.beginPath();
      g.moveTo(cx + Math.cos(angle) * R_BL, cy + Math.sin(angle) * R_BL);
      g.lineTo(cx + Math.cos(angle) * R_DO, cy + Math.sin(angle) * R_DO);
      g.strokePath();
    }
    g.lineStyle(1, 0x2a3a60, 0.7);
    for (const ring of [R_TI, R_TO, R_DI, R_DO, R_BL])
      g.strokeCircle(cx, cy, ring);

    const labelR = R_DO + r * 0.075;
    const fontSize = Math.max(11, Math.round(r * 0.066));
    for (let i = 0; i < 20; i++) {
      const angle = (i * 18 - 90) * (Math.PI / 180);
      this.add
        .text(
          cx + Math.cos(angle) * labelR,
          cy + Math.sin(angle) * labelR,
          String(SEGMENT_ORDER[i]),
          {
            fontSize: `${fontSize}px`,
            color: "#aaccff",
            fontFamily: "JetBrains Mono, monospace",
            stroke: "#000022",
            strokeThickness: 3,
          },
        )
        .setOrigin(0.5, 0.5);
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
    const cx = this.boardCX;
    const cy = this.boardCY;
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
        const t = i / count;
        const red = Math.round(255 * (1 - t));
        const grn = Math.round(136 + 96 * t);
        const blu = Math.round(255 * t);
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
