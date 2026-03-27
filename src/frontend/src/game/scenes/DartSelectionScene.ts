import Phaser from "phaser";
import { DART_CONFIGS, type DartConfig } from "../../types/dart";

export default class DartSelectionScene extends Phaser.Scene {
  private selectedIndex = 0;
  private cardGfxList: Phaser.GameObjects.Graphics[] = [];

  constructor() {
    super("DartSelectionScene");
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x000008, 1);
    bg.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) {
      bg.fillStyle(0xffffff, 0.2 + Math.random() * 0.45);
      bg.fillCircle(
        Math.random() * W,
        Math.random() * H,
        Math.random() < 0.15 ? 1.3 : 0.6,
      );
    }

    // Title
    this.add
      .text(W / 2, H * 0.06, "SELECT YOUR DART", {
        fontSize: `${Math.max(20, Math.round(H * 0.036))}px`,
        color: "#00e8ff",
        fontFamily: "Bricolage Grotesque, sans-serif",
        fontStyle: "bold",
        stroke: "#001a22",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    const cardW = W * 0.82;
    const cardH = H * 0.158;
    const cardX = W / 2;
    const startY = H * 0.15;
    const gap = H * 0.185;

    this.cardGfxList = [];

    DART_CONFIGS.forEach((dart, i) => {
      const y = startY + i * gap;
      const cardGfx = this.add.graphics();
      this.cardGfxList.push(cardGfx);
      this.drawCard(
        cardGfx,
        cardX - cardW / 2,
        y,
        cardW,
        cardH,
        dart,
        i === this.selectedIndex,
      );

      // Transparent hit rectangle
      const hit = this.add
        .rectangle(cardX, y + cardH / 2, cardW, cardH, 0xffffff, 0)
        .setInteractive({ useHandCursor: true })
        .setDepth(5);
      hit.on("pointerdown", () => {
        this.selectedIndex = i;
        this.redrawAllCards(cardX, cardW, cardH, startY, gap);
      });

      // Dart name
      this.add
        .text(cardX - cardW / 2 + 64, y + 14, dart.name, {
          fontSize: `${Math.max(17, Math.round(H * 0.028))}px`,
          color: dart.color,
          fontFamily: "Bricolage Grotesque, sans-serif",
          fontStyle: "bold",
        })
        .setDepth(6);

      // Tagline
      this.add
        .text(cardX - cardW / 2 + 64, y + 46, dart.tagline, {
          fontSize: `${Math.max(11, Math.round(H * 0.017))}px`,
          color: "#556677",
          fontFamily: "JetBrains Mono, monospace",
        })
        .setDepth(6);

      // Weight
      this.add
        .text(cardX + cardW / 2 - 12, y + 18, `${dart.weight}g`, {
          fontSize: `${Math.max(13, Math.round(H * 0.02))}px`,
          color: "#8899aa",
          fontFamily: "JetBrains Mono, monospace",
        })
        .setOrigin(1, 0)
        .setDepth(6);

      // Speed bar
      const barX = cardX + cardW / 2 - 12 - 60;
      const barY = y + cardH - 22;
      const barW = 60;
      const barH2 = 4;
      const barGfx = this.add.graphics().setDepth(6);
      barGfx.fillStyle(0x112233, 1);
      barGfx.fillRoundedRect(barX, barY, barW, barH2, 2);
      barGfx.fillStyle(Number.parseInt(dart.color.replace("#", ""), 16), 1);
      barGfx.fillRoundedRect(barX, barY, (dart.speed / 18) * barW, barH2, 2);
    });

    // Play button
    const btnY = startY + DART_CONFIGS.length * gap + 10;
    const btnW = W * 0.62;
    const btnH = H * 0.072;
    const btnGfx = this.add.graphics().setDepth(6);
    this.drawPlayBtn(btnGfx, W / 2 - btnW / 2, btnY, btnW, btnH, false);

    this.add
      .text(W / 2, btnY + btnH / 2, "PLAY", {
        fontSize: `${Math.max(20, Math.round(H * 0.034))}px`,
        color: "#000022",
        fontFamily: "Bricolage Grotesque, sans-serif",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(8);

    const btnHit = this.add
      .rectangle(W / 2, btnY + btnH / 2, btnW, btnH, 0xffffff, 0)
      .setInteractive({ useHandCursor: true })
      .setDepth(9);
    btnHit.on("pointerdown", () => {
      this.scene.start("ModeSelectScene", {
        dart: DART_CONFIGS[this.selectedIndex],
      });
    });
    btnHit.on("pointerover", () =>
      this.drawPlayBtn(btnGfx, W / 2 - btnW / 2, btnY, btnW, btnH, true),
    );
    btnHit.on("pointerout", () =>
      this.drawPlayBtn(btnGfx, W / 2 - btnW / 2, btnY, btnW, btnH, false),
    );

    // Footer
    this.add
      .text(
        W / 2,
        H - 12,
        `© ${new Date().getFullYear()}. Built with love using caffeine.ai`,
        {
          fontSize: `${Math.max(9, Math.round(H * 0.013))}px`,
          color: "#1a2a3a",
          fontFamily: "JetBrains Mono, monospace",
        },
      )
      .setOrigin(0.5, 1);
  }

  private drawPlayBtn(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    hover: boolean,
  ) {
    g.clear();
    g.fillStyle(hover ? 0x00ccee : 0x00e8ff, 1);
    g.fillRoundedRect(x, y, w, h, 10);
  }

  private drawCard(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    dart: DartConfig,
    selected: boolean,
  ) {
    g.clear();
    const col = Number.parseInt(dart.color.replace("#", ""), 16);
    g.fillStyle(selected ? 0x060e20 : 0x020810, 1);
    g.fillRoundedRect(x, y, w, h, 8);
    g.lineStyle(selected ? 2 : 1, col, selected ? 0.95 : 0.28);
    g.strokeRoundedRect(x, y, w, h, 8);
    if (selected) {
      g.lineStyle(8, col, 0.12);
      g.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, 6);
    }
    // Mini dart illustration
    const dx = x + 36;
    const dy = y + h / 2;
    g.fillStyle(0xcccccc, 1);
    g.fillTriangle(dx, dy - 20, dx - 3, dy - 6, dx + 3, dy - 6);
    g.fillStyle(col, 1);
    g.fillRoundedRect(dx - 4, dy - 6, 8, 18, 2);
    g.fillStyle(col, 0.75);
    g.fillTriangle(dx, dy + 12, dx - 9, dy + 24, dx - 1, dy + 18);
    g.fillTriangle(dx, dy + 12, dx + 9, dy + 24, dx + 1, dy + 18);
  }

  private redrawAllCards(
    cardX: number,
    cardW: number,
    cardH: number,
    startY: number,
    gap: number,
  ) {
    DART_CONFIGS.forEach((dart, i) => {
      this.drawCard(
        this.cardGfxList[i],
        cardX - cardW / 2,
        startY + i * gap,
        cardW,
        cardH,
        dart,
        i === this.selectedIndex,
      );
    });
  }
}
