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

    // ── Kill browser touch interference at document level ──────────────────
    const preventBrowserTouch = (e: TouchEvent) => e.preventDefault();
    document.addEventListener("touchstart", preventBrowserTouch, {
      capture: true,
      passive: false,
    });
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

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: window.innerWidth,
      height: window.innerHeight,
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
      document.removeEventListener("touchstart", preventBrowserTouch, {
        capture: true,
      });
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
