import Phaser from "phaser";

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload() {
    this.load.image(
      "dart-sprite",
      "/assets/generated/dart-sprite-transparent.dim_400x120.png",
    );
    this.load.image(
      "dartboard-bg",
      "/assets/generated/dartboard-neon-arcade.dim_600x600.png",
    );
  }

  create() {
    this.scene.start("DartSelectionScene");
  }
}
