import Phaser from "phaser";

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload() {
    // New 3D vertical dart sprite — 160×500, tip at BOTTOM when angle=0
    // Use setAngle(180) for tip-up rest position; setAngle(velDeg - 90) for flight
    this.load.image(
      "dart-sprite",
      "/assets/generated/dart-3d-metallic-v2-transparent.dim_160x500.png",
    );
    this.load.image(
      "arena-bg",
      "/assets/generated/arena-competition-bg.dim_900x1600.jpg",
    );
  }

  create() {
    this.scene.start("DartSelectionScene");
  }
}
