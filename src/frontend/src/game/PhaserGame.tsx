import Phaser from "phaser";
import { useEffect, useRef } from "react";
import DartSelectionScene from "./scenes/DartSelectionScene";
import GameScene from "./scenes/GameScene";
import IntroScene from "./scenes/IntroScene";
import ModeSelectScene from "./scenes/ModeSelectScene";
import PreloadScene from "./scenes/PreloadScene";

export default function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // ── Kill browser scroll/zoom interference — but NOT touchstart ──────────
    // Removing touchstart preventDefault so iOS synthesises pointer events,
    // which Phaser uses for its interactive buttons (play, mode select, etc).
    // touch-action: none on the container already prevents scrolling in CSS.
    const preventBrowserTouch = (e: TouchEvent) => e.preventDefault();
    document.addEventListener("touchmove", preventBrowserTouch, {
      capture: true,
      passive: false,
    });
    document.addEventListener(
      "gesturestart",
      preventBrowserTouch as EventListener,
      {
        capture: true,
        passive: false,
      },
    );
    document.addEventListener(
      "gesturechange",
      preventBrowserTouch as EventListener,
      {
        capture: true,
        passive: false,
      },
    );

    // Use devicePixelRatio for crisp Retina rendering via the scale zoom.
    // In Phaser 3.60+, "resolution" was removed from RenderConfig; the
    // recommended approach is to set zoom = devicePixelRatio so the canvas
    // draws at native pixel density, while CSS scales it back to screen size.
    const dpr = window.devicePixelRatio || 1;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: window.innerWidth * dpr,
      height: window.innerHeight * dpr,
      backgroundColor: "#000008",
      scene: [
        PreloadScene,
        DartSelectionScene,
        ModeSelectScene,
        IntroScene,
        GameScene,
      ],
      input: {
        // Single active pointer only — mirrors the single-touch gate in InputLayer
        activePointers: 1,
      },
      dom: {
        createContainer: false,
      },
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        zoom: 1 / dpr,
      },
      render: {
        antialias: true,
        powerPreference: "high-performance",
      },
    };

    const game = new Phaser.Game(config);

    // Lock canvas styles once Phaser creates the element
    const lockCanvas = () => {
      const canvas = containerRef.current?.querySelector("canvas");
      if (canvas) {
        canvas.style.touchAction = "none";
        canvas.style.userSelect = "none";
        (
          canvas.style as CSSStyleDeclaration & {
            webkitUserSelect: string;
            webkitTapHighlightColor: string;
          }
        ).webkitUserSelect = "none";
        (
          canvas.style as CSSStyleDeclaration & {
            webkitTapHighlightColor: string;
          }
        ).webkitTapHighlightColor = "transparent";
      }
    };
    lockCanvas();
    const retryTimer = setTimeout(lockCanvas, 300);

    return () => {
      clearTimeout(retryTimer);
      document.removeEventListener("touchmove", preventBrowserTouch, {
        capture: true,
      });
      document.removeEventListener(
        "gesturestart",
        preventBrowserTouch as EventListener,
        { capture: true },
      );
      document.removeEventListener(
        "gesturechange",
        preventBrowserTouch as EventListener,
        { capture: true },
      );
      game.destroy(true);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      data-ocid="game.canvas_target"
      style={{
        width: "100vw",
        height: "100vh",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        overflow: "hidden",
        position: "fixed",
        top: 0,
        left: 0,
      }}
    />
  );
}
