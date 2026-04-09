import { Canvas, useFrame } from "@react-three/fiber";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import TouchLayer from "./input/TouchLayer";
import DartMesh, { type DartMeshHandle } from "./three/DartMesh";
import DartboardMesh from "./three/DartboardMesh";
import GameCamera, { type GameCameraHandle } from "./three/GameCamera";
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

const ARENA_BG =
  "https://cyan-chemical-capybara-537.mypinata.cloud/ipfs/bafkreigj6ekkwd45x2tfnlhdszi3byapz6sb62gu74blbfpu7hwnoxhuwy?pinataGatewayToken=7zglWYSGiMDzNDI6rKBp6n24Hn5dRANGNukXWHOraLmAUnl5cjJrHMrbnpJJJj2G";

type GameState = "menu" | "aiming" | "throwing" | "embedded" | "round_over";

// ── Dart Trail ────────────────────────────────────────────────────────────────

interface DartTrailProps {
  positionsRef: React.RefObject<THREE.Vector3[]>;
}

function DartTrail({ positionsRef }: DartTrailProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorBuf = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    if (!meshRef.current) return;
    const positions = positionsRef.current;
    const count = positions.length;

    for (let i = 0; i < 8; i++) {
      if (i < count) {
        dummy.position.copy(positions[i]);
        dummy.scale.setScalar(1);
      } else {
        dummy.position.set(0, -1000, 0);
        dummy.scale.setScalar(0);
      }
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      const brightness = Math.max(0, 1 - i / 8);
      colorBuf.setRGB(0, brightness * 0.93, brightness);
      meshRef.current.setColorAt(i, colorBuf);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 8]}>
      <sphereGeometry args={[0.008, 4, 4]} />
      <meshBasicMaterial vertexColors transparent opacity={0.45} />
    </instancedMesh>
  );
}

// ── Inner 3-D scene (must be inside Canvas) ────────────────────────────────

interface GameSceneProps {
  gameState: GameState;
  currentThrow: PlannedThrow | null;
  onImpact: (zone: ZoneResult) => void;
  modeState: ModeState;
  aimOffsetRef: React.RefObject<{ x: number; y: number }>;
}

function GameScene({
  gameState,
  currentThrow,
  onImpact,
  modeState,
  aimOffsetRef,
}: GameSceneProps) {
  const dartRef = useRef<DartMeshHandle>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const cameraRef = useRef<GameCameraHandle>(null);
  const throwAnimRef = useRef<ThrowAnimation | null>(null);
  const onImpactRef = useRef(onImpact);
  const trailPositionsRef = useRef<THREE.Vector3[]>([]);
  const idleRollRef = useRef(0);

  useEffect(() => {
    onImpactRef.current = onImpact;
  });

  useEffect(() => {
    if (gameState !== "throwing" || !currentThrow) return;
    throwAnimRef.current = new ThrowAnimation(currentThrow, Date.now());
    trailPositionsRef.current = [];
    // Cinematic zoom only for perfect shots (bullseye / bull / triple 20)
    if (currentThrow.isPerfect) {
      cameraRef.current?.startThrow(
        currentThrow.landingPos3D,
        currentThrow.flightMs,
      );
    }
  }, [currentThrow, gameState]);

  useEffect(() => {
    if (gameState === "aiming" && dartRef.current?.group) {
      dartRef.current.group.position.copy(DART_START);
      // Tilt tip upward ~25 deg so it looks like a natural dart grip
      const readyQuat = new THREE.Quaternion();
      readyQuat.setFromEuler(new THREE.Euler(Math.PI / 7.5, 0, 0));
      dartRef.current.group.quaternion.copy(readyQuat);
      trailPositionsRef.current = [];
    }
  }, [gameState]);

  useFrame(() => {
    // Idle barrel roll when aiming
    if (gameState === "aiming" && dartRef.current) {
      idleRollRef.current += 0.018;
      dartRef.current.setBarrelRoll(idleRollRef.current);

      // Nudge dart position based on aim drag for visual feedback
      if (dartRef.current.group) {
        const offset = aimOffsetRef.current;
        dartRef.current.group.position.set(
          DART_START.x + offset.x,
          DART_START.y + offset.y,
          DART_START.z,
        );
      }
    }

    const anim = throwAnimRef.current;
    if (!anim) return;

    const result = anim.update(Date.now());

    if (dartRef.current?.group) {
      dartRef.current.group.position.copy(result.position);
      dartRef.current.group.quaternion.copy(result.quaternion);

      const positions = trailPositionsRef.current;
      positions.unshift(result.position.clone());
      if (positions.length > 8) positions.pop();
    }

    // Only show flight twirl when dart is going downward (descent phase)
    if (result.tangentY < 0) {
      dartRef.current?.setFlightRoll(result.t);
    }

    if (ringRef.current) {
      const s = Math.max(0.01, 1 - result.t);
      ringRef.current.scale.setScalar(s);
    }

    if (result.complete && !anim.impactFired) {
      anim.impactFired = true;
      throwAnimRef.current = null;
      trailPositionsRef.current = [];
      cameraRef.current?.onImpact();
      onImpactRef.current(result.landingZone);
    }
  });

  const ringPos = currentThrow?.landingPos3D ?? new THREE.Vector3(0, 0, -5);

  let highlightSegment = 0;
  let highlightRing: "single" | "double" | "triple" | "bull" | null = null;
  if (
    modeState.type === "around_world" &&
    modeState.target > 0 &&
    modeState.target <= 20
  ) {
    highlightSegment = modeState.target;
    highlightRing = "single";
  } else if (
    modeState.type === "doubles" &&
    modeState.target > 0 &&
    modeState.target <= 20
  ) {
    highlightSegment = modeState.target;
    highlightRing = "double";
  } else if (
    modeState.type === "triples" &&
    modeState.target > 0 &&
    modeState.target <= 20
  ) {
    highlightSegment = modeState.target;
    highlightRing = "triple";
  }

  return (
    <>
      <DartboardMesh
        highlightSegment={highlightSegment}
        highlightRing={highlightRing}
      />
      <DartMesh ref={dartRef} />
      {currentThrow && <TargetRing ref={ringRef} position={ringPos} />}
      {gameState === "throwing" && (
        <DartTrail positionsRef={trailPositionsRef} />
      )}
      <GameCamera ref={cameraRef} />
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 0, -3]} intensity={8} color="#ffffff" />
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
  const [impactFlash, setImpactFlash] = useState<string | null>(null);
  const impactFlashKey = useRef(0);
  const transitioning = useRef(false);
  const aimOffsetRef = useRef({ x: 0, y: 0 });

  const handleStart = useCallback((mode: GameModeType) => {
    setModeState(createInitialState(mode));
    setDartsLeft(3);
    setCurrentThrow(null);
    setLastZone(null);
    setShowPopup(false);
    setImpactFlash(null);
    transitioning.current = false;
    aimOffsetRef.current = { x: 0, y: 0 };
    setGameState("aiming");
  }, []);

  const handleThrow = useCallback(
    (pt: PlannedThrow) => {
      if (gameState !== "aiming" || transitioning.current) return;
      aimOffsetRef.current = { x: 0, y: 0 };
      setCurrentThrow(pt);
      setGameState("throwing");
    },
    [gameState],
  );

  const handleAimUpdate = useCallback((normX: number, normY: number) => {
    aimOffsetRef.current = { x: normX * 0.15, y: normY * 0.12 };
  }, []);

  const handleImpact = useCallback(
    (zone: ZoneResult) => {
      if (transitioning.current) return;
      transitioning.current = true;

      let flashColor: string | null = null;
      if (zone.ring === "bullseye") flashColor = "#ff2200";
      else if (zone.ring === "triple") flashColor = "#00eeff";
      else if (zone.ring === "double") flashColor = "#ffaa00";

      if (flashColor) {
        impactFlashKey.current++;
        setImpactFlash(flashColor);
        setTimeout(() => setImpactFlash(null), 300);
      }

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
            aimOffsetRef.current = { x: 0, y: 0 };
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
    setImpactFlash(null);
    transitioning.current = false;
    aimOffsetRef.current = { x: 0, y: 0 };
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
      {/* Arena background image */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${ARENA_BG})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          zIndex: 0,
        }}
      />
      {/* Dark overlay to deepen the background so the board/dart pop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,8,0.55)",
          zIndex: 1,
          pointerEvents: "none",
        }}
      />

      {/* 3-D Canvas */}
      <Canvas
        style={{ position: "absolute", inset: 0, zIndex: 2 }}
        camera={{ fov: 62, position: [0, -0.2, 0], near: 0.05, far: 60 }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          alpha: true,
        }}
        onCreated={({ camera, gl }) => {
          camera.lookAt(0, 0.6, -5);
          gl.setClearColor(0x000000, 0);
        }}
      >
        <GameScene
          gameState={gameState}
          currentThrow={currentThrow}
          onImpact={handleImpact}
          modeState={modeState}
          aimOffsetRef={aimOffsetRef}
        />
      </Canvas>

      {/* Vignette overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.75) 100%)",
          pointerEvents: "none",
          zIndex: 5,
        }}
      />

      {/* Scanlines overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)",
          pointerEvents: "none",
          zIndex: 6,
        }}
      />

      {/* Impact flash overlay */}
      <AnimatePresence>
        {impactFlash && (
          <motion.div
            key={impactFlashKey.current}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            style={{
              position: "absolute",
              inset: 0,
              background: `${impactFlash}22`,
              boxShadow: `inset 0 0 120px ${impactFlash}88`,
              pointerEvents: "none",
              zIndex: 25,
            }}
          />
        )}
      </AnimatePresence>

      {/* Touch input layer */}
      <TouchLayer
        enabled={isAiming}
        onThrow={handleThrow}
        onAimUpdate={handleAimUpdate}
      />

      {/* HUD */}
      {gameState !== "menu" && (
        <HUD
          modeState={modeState}
          dartsLeft={dartsLeft}
          lastZone={lastZone}
          showPopup={showPopup}
          isAiming={isAiming}
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
