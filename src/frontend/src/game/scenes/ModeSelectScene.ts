import Phaser from "phaser";
import type { DartConfig } from "../../types/dart";

const MODES = [
  {
    id: "301",
    label: "301 GAME",
    desc: "Classic double-out finish",
    color: 0x00e8ff,
  },
  {
    id: "around-world",
    label: "AROUND THE WORLD",
    desc: "Hit 1 through 20 in order",
    color: 0xff40b0,
  },
  {
    id: "doubles",
    label: "DOUBLES PRACTICE",
    desc: "Target the double ring",
    color: 0xff8800,
  },
  {
    id: "triples",
    label: "TRIPLES PRACTICE",
    desc: "Target the triple ring",
    color: 0x9933ff,
  },
  {
    id: "practice-301",
    label: "PRACTICE 301",
    desc: "301 countdown, no pressure",
    color: 0x40ff80,
  },
];

export default class ModeSelectScene extends Phaser.Scene {
  private selectedDart?: DartConfig;

  constructor() {
    super("ModeSelectScene");
  }

  init(data: { dart?: DartConfig }) {
    this.selectedDart = data.dart;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    const bg = this.add.graphics();
    bg.fillStyle(0x000008, 1);
    bg.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      bg.fillStyle(0xffffff, 0.18 + Math.random() * 0.4);
      bg.fillCircle(
        Math.random() * W,
        Math.random() * H,
        Math.random() < 0.15 ? 1.2 : 0.6,
      );
    }

    this.add
      .text(W / 2, H * 0.055, "SELECT MODE", {
        fontSize: `${Math.max(20, Math.round(H * 0.036))}px`,
        color: "#00e8ff",
        fontFamily: "Bricolage Grotesque, sans-serif",
        fontStyle: "bold",
        stroke: "#001a22",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    const btnW = W * 0.84;
    const btnH = H * 0.1;
    const startY = H * 0.13;
    const gap = H * 0.115;

    MODES.forEach((mode, i) => {
      const y = startY + i * gap;
      const gfx = this.add.graphics();
      this.drawModeBtn(gfx, W / 2 - btnW / 2, y, btnW, btnH, mode.color, false);

      this.add
        .text(W / 2, y + btnH * 0.34, mode.label, {
          fontSize: `${Math.max(14, Math.round(H * 0.025))}px`,
          color: `#${mode.color.toString(16).padStart(6, "0")}`,
          fontFamily: "Bricolage Grotesque, sans-serif",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(2);

      this.add
        .text(W / 2, y + btnH * 0.7, mode.desc, {
          fontSize: `${Math.max(10, Math.round(H * 0.016))}px`,
          color: "#334455",
          fontFamily: "JetBrains Mono, monospace",
        })
        .setOrigin(0.5)
        .setDepth(2);

      const hit = this.add
        .rectangle(W / 2, y + btnH / 2, btnW, btnH, 0xffffff, 0)
        .setInteractive({ useHandCursor: true })
        .setDepth(3);
      hit.on("pointerdown", () => {
        this.scene.start("IntroScene", {
          dart: this.selectedDart,
          mode: mode.id,
        });
      });
      hit.on("pointerover", () =>
        this.drawModeBtn(
          gfx,
          W / 2 - btnW / 2,
          y,
          btnW,
          btnH,
          mode.color,
          true,
        ),
      );
      hit.on("pointerout", () =>
        this.drawModeBtn(
          gfx,
          W / 2 - btnW / 2,
          y,
          btnW,
          btnH,
          mode.color,
          false,
        ),
      );
    });

    const backY = startY + MODES.length * gap + 14;
    const back = this.add
      .text(W / 2, backY, "← BACK", {
        fontSize: `${Math.max(13, Math.round(H * 0.02))}px`,
        color: "#334455",
        fontFamily: "JetBrains Mono, monospace",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    back.on("pointerdown", () => this.scene.start("DartSelectionScene"));
    back.on("pointerover", () => back.setColor("#6688aa"));
    back.on("pointerout", () => back.setColor("#334455"));
  }

  private drawModeBtn(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
    hover: boolean,
  ) {
    g.clear();
    g.fillStyle(hover ? 0x041228 : 0x020a18, 1);
    g.fillRoundedRect(x, y, w, h, 8);
    g.lineStyle(hover ? 2 : 1.5, color, hover ? 0.9 : 0.45);
    g.strokeRoundedRect(x, y, w, h, 8);
  }
}
