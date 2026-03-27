import Phaser from "phaser";
import type { DartConfig } from "../../types/dart";

export default class IntroScene extends Phaser.Scene {
  private selectedDart?: DartConfig;
  private selectedMode = "301";

  constructor() {
    super("IntroScene");
  }

  init(data: { dart?: DartConfig; mode?: string }) {
    this.selectedDart = data.dart;
    this.selectedMode = data.mode ?? "301";
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    const dartColor = this.selectedDart?.color ?? "#00e8ff";
    const col = Number.parseInt(dartColor.replace("#", ""), 16);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x000008, 1);
    bg.fillRect(0, 0, W, H);

    // Generate spark texture (add to scene, make invisible)
    const sparkGfx = this.add.graphics();
    sparkGfx.fillStyle(0xffffff, 1);
    sparkGfx.fillCircle(4, 4, 4);
    sparkGfx.generateTexture("spark", 8, 8);
    sparkGfx.setVisible(false);

    // Particle emitter
    const zone: Phaser.Types.GameObjects.Particles.ParticleEmitterRandomZoneConfig =
      {
        source: new Phaser.Geom.Circle(
          0,
          0,
          130,
        ) as unknown as Phaser.Types.GameObjects.Particles.RandomZoneSource,
        type: "random",
      };
    this.add.particles(W / 2, H * 0.38, "spark", {
      speed: { min: 25, max: 130 },
      scale: { start: 0.55, end: 0 },
      alpha: { start: 0.9, end: 0 },
      lifespan: { min: 700, max: 2200 },
      frequency: 35,
      tint: [col, 0xff40b0, 0xffdd00, 0x9933ff, 0x40ff80],
      emitZone: zone,
      gravityY: -15,
      blendMode: "ADD",
    });

    // Board glow silhouette
    const boardGfx = this.add.graphics();
    for (let i = 5; i >= 1; i--) {
      boardGfx.lineStyle(i * 8, col, 0.06 * (6 - i));
      boardGfx.strokeCircle(W / 2, H * 0.38, 90 + i * 4);
    }
    boardGfx.lineStyle(3, col, 0.4);
    boardGfx.strokeCircle(W / 2, H * 0.38, 88);
    boardGfx.fillStyle(0x000820, 0.7);
    boardGfx.fillCircle(W / 2, H * 0.38, 86);
    boardGfx.lineStyle(1.5, col, 0.6);
    boardGfx.strokeCircle(W / 2, H * 0.38, 55);
    boardGfx.lineStyle(1, col, 0.4);
    boardGfx.strokeCircle(W / 2, H * 0.38, 22);

    // Title
    const title = this.add
      .text(W / 2, H * 0.18, "NEON DARTS", {
        fontSize: `${Math.max(38, Math.round(W * 0.115))}px`,
        color: "#00e8ff",
        fontFamily: "Bricolage Grotesque, sans-serif",
        fontStyle: "bold",
        stroke: "#001a22",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({
      targets: title,
      alpha: 1,
      duration: 700,
      ease: "Power2.easeOut",
    });

    // Dart badge
    const badge = this.add
      .text(W / 2, H * 0.6, `\u25b6  ${this.selectedDart?.name ?? ""}`, {
        fontSize: `${Math.max(15, Math.round(H * 0.026))}px`,
        color: dartColor,
        fontFamily: "JetBrains Mono, monospace",
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: badge, alpha: 1, duration: 500, delay: 400 });

    // Start countdown after 1.6s
    this.time.delayedCall(1600, () => this.runCountdown());
  }

  private runCountdown() {
    const W = this.scale.width;
    const H = this.scale.height;
    const dartColor = this.selectedDart?.color ?? "#00e8ff";
    const steps = ["3", "2", "1", "THROW!"];
    let step = 0;

    const showStep = () => {
      if (step >= steps.length) {
        this.scene.start("GameScene", {
          dart: this.selectedDart,
          mode: this.selectedMode,
        });
        return;
      }
      const isThrow = step === 3;
      const t = this.add
        .text(W / 2, H / 2, steps[step], {
          fontSize: isThrow
            ? `${Math.max(44, Math.round(H * 0.09))}px`
            : `${Math.max(72, Math.round(H * 0.16))}px`,
          color: isThrow ? dartColor : "#ffffff",
          fontFamily: "Bricolage Grotesque, sans-serif",
          fontStyle: "bold",
          stroke: "#000011",
          strokeThickness: 6,
        })
        .setOrigin(0.5)
        .setAlpha(0)
        .setScale(0.5);

      this.tweens.add({
        targets: t,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 180,
        ease: "Back.easeOut",
        onComplete: () => {
          this.tweens.add({
            targets: t,
            alpha: 0,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 220,
            delay: 200,
            ease: "Power2.easeIn",
            onComplete: () => {
              t.destroy();
              step++;
              showStep();
            },
          });
        },
      });
    };

    showStep();
  }
}
