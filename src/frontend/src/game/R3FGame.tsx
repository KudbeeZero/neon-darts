import { Canvas, useFrame } from "@react-three/fiber";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

import TouchLayer from "./input/TouchLayer";
import DartMesh, { type DartMeshHandle } from "./three/DartMesh";
import DartboardMesh from "./three/DartboardMesh";
import GameCamera, { type GameCameraHandle } from "./three/GameCamera";
import Starfield from "./three/Starfield";
import TargetRing from "./three/TargetRing";
import { ThrowAnimation } from "./three/ThrowAnimation";
import GameMenu from "./ui/GameMenu";
import HUD from "./ui/HUD";

import { DART_START, type PlannedThrow } from "./core/ArcPlanner";
import {
  type GameModeType,
  type ModeState,
  createInitialState,
  processThrow,
} from "./core/GameModes";
import type { ZoneResult } from "./core/ScoringGrid";

type GameState = "menu" | "aiming" | "throwing" | "embedded" | "round_over";

// ── Inner 3-D scene (must be inside Canvas) ────────────────────────────────

interface GameSceneProps {
  gameState: GameState;
  currentThrow: PlannedThrow | null;
  onImpact: (zone: ZoneResult) => void;
}

function GameScene({ gameState, currentThrow, onImpact }: GameSceneProps) {
  const dartRef = useRef<DartMeshHandle>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const cameraRef = useRef<GameCameraHandle>(null);
  const throwAnimRef = useRef<ThrowAnimation | null>(null);
  const onImpactRef = useRef(onImpact);

  useEffect(() => {
    onImpactRef.current = onImpact;
  });

  // Kick off animation when a new throw arrives
  useEffect(() => {
    if (gameState !== "throwing" || !currentThrow) return;
    throwAnimRef.current = new ThrowAnimation(currentThrow, Date.now());
    cameraRef.current?.startThrow(
      currentThrow.landingPos3D,
      currentThrow.flightMs,
    );
  }, [currentThrow, gameState]);

  // Reset dart position when entering aiming state
  useEffect(() => {
    if (gameState === "aiming" && dartRef.current?.group) {
      dartRef.current.group.position.copy(DART_START);
      dartRef.current.group.quaternion.set(0, 0, 0, 1);
    }
  }, [gameState]);

  useFrame(() => {
    const anim = throwAnimRef.current;
    if (!anim) return;

    const result = anim.update(Date.now());

    if (dartRef.current?.group) {
      dartRef.current.group.position.copy(result.position);
      dartRef.current.group.quaternion.copy(result.quaternion);
    }
    dartRef.current?.setFlightRoll(result.t);

    if (ringRef.current) {
      const s = Math.max(0.01, 1 - result.t);
      ringRef.current.scale.setScalar(s);
    }

    if (result.complete && !anim.impactFired) {
      anim.impactFired = true;
      throwAnimRef.current = null;
      cameraRef.current?.onImpact();
      onImpactRef.current(result.landingZone);
    }
  });

  const ringPos = currentThrow?.landingPos3D ?? new THREE.Vector3(0, 0, -5);

  return (
    <>
      <Starfield />
      <DartboardMesh />
      <DartMesh ref={dartRef} />
      {currentThrow && <TargetRing ref={ringRef} position={ringPos} />}
      <GameCamera ref={cameraRef} />
      <ambientLight intensity={0.12} />
      <pointLight position={[0, 3, -1]} intensity={4} color="#4466ff" />
      <pointLight position={[0.8, 0.5, -3]} intensity={2} color="#ff44aa" />
      <pointLight position={[-0.8, 0.5, -3]} intensity={2} color="#44ffcc" />
      <pointLight position={[0, 0.5, -4.5]} intensity={3} color="#ffffff" />
      <pointLight position={[0, -1, -4]} intensity={1} color="#ff6600" />
    </>
  );
}

// ── Root game component ───────────────────────────────────────────────────────

export default function R3FGame() {
  const [gameState, setGameState] = useState<GameState>("menu");
  const [modeState, setModeState] = useState<ModeState>(
    createInitialState("301"),
  );
  const [dartsLeft, setDartsLeft] = useState(3);
  const [currentThrow, setCurrentThrow] = useState<PlannedThrow | null>(null);
  const [lastZone, setLastZone] = useState<ZoneResult | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const transitioning = useRef(false);

  const handleStart = useCallback((mode: GameModeType) => {
    setModeState(createInitialState(mode));
    setDartsLeft(3);
    setCurrentThrow(null);
    setLastZone(null);
    setShowPopup(false);
    transitioning.current = false;
    setGameState("aiming");
  }, []);

  const handleThrow = useCallback(
    (pt: PlannedThrow) => {
      if (gameState !== "aiming" || transitioning.current) return;
      setCurrentThrow(pt);
      setGameState("throwing");
    },
    [gameState],
  );

  const handleImpact = useCallback(
    (zone: ZoneResult) => {
      if (transitioning.current) return;
      transitioning.current = true;

      setLastZone(zone);
      setShowPopup(true);

      setModeState((prev) => {
        const { newState } = processThrow(zone, prev);
        return newState;
      });
      setGameState("embedded");

      const nextDartsLeft = dartsLeft - 1;
      setDartsLeft(nextDartsLeft);

      setTimeout(() => {
        setShowPopup(false);
        setModeState((ms) => {
          if (ms.isComplete || nextDartsLeft <= 0) {
            setGameState("round_over");
          } else {
            setGameState("aiming");
          }
          transitioning.current = false;
          return ms;
        });
      }, 1600);
    },
    [dartsLeft],
  );

  const handlePlayAgain = useCallback(() => {
    setModeState((prev) => createInitialState(prev.type));
    setDartsLeft(3);
    setCurrentThrow(null);
    setLastZone(null);
    setShowPopup(false);
    transitioning.current = false;
    setGameState("aiming");
  }, []);

  const isAiming = gameState === "aiming";

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
        background: "#000008",
      }}
    >
      {/* 3-D Canvas */}
      <Canvas
        style={{ position: "absolute", inset: 0 }}
        camera={{ fov: 75, position: [0, 0.15, 0], near: 0.05, far: 60 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 0, -5);
        }}
      >
        <GameScene
          gameState={gameState}
          currentThrow={currentThrow}
          onImpact={handleImpact}
        />
      </Canvas>

      {/* Touch input layer */}
      <TouchLayer enabled={isAiming} onThrow={handleThrow} />

      {/* HUD */}
      {gameState !== "menu" && (
        <HUD
          modeState={modeState}
          dartsLeft={dartsLeft}
          lastZone={lastZone}
          showPopup={showPopup}
        />
      )}

      {/* Main menu */}
      <AnimatePresence>
        {gameState === "menu" && <GameMenu key="menu" onStart={handleStart} />}
      </AnimatePresence>

      {/* Round-over overlay */}
      <AnimatePresence>
        {gameState === "round_over" && (
          <motion.div
            key="round_over"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 40,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,12,0.82)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              fontFamily: "'JetBrains Mono', monospace",
              gap: 16,
            }}
          >
            <div
              style={{
                fontSize: 38,
                fontWeight: 800,
                color: modeState.isComplete ? "#00ddff" : "#ff8800",
                textShadow: modeState.isComplete
                  ? "0 0 24px #00ddff"
                  : "0 0 20px #ff8800",
                textAlign: "center",
              }}
            >
              {modeState.isComplete ? "🏆 YOU WIN!" : "Round Over"}
            </div>

            {modeState.type === "301" && (
              <div
                style={{
                  color: "#aaaacc",
                  fontSize: 18,
                  textAlign: "center",
                }}
              >
                {modeState.isComplete
                  ? "Perfect!"
                  : `${modeState.score} remaining`}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button
                type="button"
                data-ocid="round_over.play_again.button"
                onClick={handlePlayAgain}
                style={{
                  background: "linear-gradient(135deg, #00bbdd, #0044ff)",
                  border: "none",
                  borderRadius: 12,
                  padding: "12px 32px",
                  color: "white",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 0 20px rgba(0,170,255,0.4)",
                  fontFamily: "inherit",
                }}
              >
                Play Again
              </button>
              <button
                type="button"
                data-ocid="round_over.menu.button"
                onClick={() => setGameState("menu")}
                style={{
                  background: "rgba(30,30,60,0.8)",
                  border: "1px solid rgba(100,100,200,0.4)",
                  borderRadius: 12,
                  padding: "12px 32px",
                  color: "#aaaacc",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Menu
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
