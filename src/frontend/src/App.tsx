import { useActor } from "@/hooks/useActor";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult } from "./backend.d";
import DartBoard, { computeScore } from "./components/DartBoard";
import type { ThrowResult } from "./components/DartBoard";
import DartFlight, { type ThrowTargetData } from "./components/DartFlight";
import DartHoldingCanvas from "./components/DartHoldingCanvas";
import DartSelectionScreen from "./components/DartSelectionScreen";
import GameHUD, { type RecentThrow } from "./components/GameHUD";
import ModeSelectScreen, { type GameMode } from "./components/ModeSelectScreen";
import { useDartAudio } from "./hooks/useDartAudio";
import { triggerImpactHaptic, useFlickInput } from "./hooks/useFlickInput";
import { DART_CONFIGS, type DartConfig } from "./types/dart";

type GamePhase =
  | "dartSelection"
  | "modeSelect"
  | "intro"
  | "countdown"
  | "playing"
  | "won";

// Physics: compute SVG hit position from flick result
function computeHitFromFlick(
  aimOffsetNX: number,
  aimOffsetNY: number,
  power: number,
  dartConfig: DartConfig,
): { x: number; y: number } {
  const boardRadius = 148;

  let hitX = 200 + aimOffsetNX * boardRadius;
  let hitY = 200 - aimOffsetNY * boardRadius;

  const gravityDrop = (dartConfig.weight / 28 - 0.43) * 16;
  hitY += gravityDrop;

  const stabilityFactor = 1 - dartConfig.stability / 100;
  const drift = stabilityFactor * (Math.random() * 2 - 1) * 22;
  hitX += drift;

  let scatter = 3;
  if (power < 0.25) {
    scatter = 3 + ((0.25 - power) / 0.25) * 28;
    const wf = (0.25 - power) / 0.25;
    const dx = hitX - 200;
    const dy = hitY - 200;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      hitX += (dx / dist) * wf * 35;
      hitY += (dy / dist) * wf * 35;
    }
  } else if (power > 0.82) {
    scatter = 3 + ((power - 0.82) / 0.18) * 9;
  }

  const nr = () => {
    const u1 = Math.random() || 1e-10;
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
  hitX += nr() * scatter;
  hitY += nr() * scatter;

  return {
    x: Math.max(10, Math.min(390, hitX)),
    y: Math.max(10, Math.min(390, hitY)),
  };
}

function getFlightDuration(dart: DartConfig): number {
  return (400 + (dart.weight / 28) * 200 - (dart.speed / 18) * 150) / 1000;
}

let throwIdCounter = 0;

// ─── Sparkle dot ─────────────────────────────────────────────
function Sparkle({
  x,
  y,
  delay,
  size,
}: { x: number; y: number; delay: number; size: number }) {
  return (
    <motion.div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        borderRadius: "50%",
        background: "white",
        boxShadow:
          "0 0 6px 2px rgba(0,232,255,0.8), 0 0 12px 4px rgba(0,232,255,0.4)",
        pointerEvents: "none",
      }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: [0, 1, 0.3, 1, 0], scale: [0, 1, 0.7, 1.2, 0] }}
      transition={{
        duration: 2.2,
        delay,
        repeat: Number.POSITIVE_INFINITY,
        repeatDelay: Math.random() * 1.5,
      }}
    />
  );
}

// ─── Intro Screen ─────────────────────────────────────────────
function IntroScreen({
  selectedDart,
  onDone,
}: {
  selectedDart: DartConfig;
  onDone: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2200);
    return () => clearTimeout(timer);
  }, [onDone]);

  const sparkles = useRef(
    Array.from({ length: 24 }, (_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: (i * 0.09) % 2,
      size: 2 + Math.random() * 3,
    })),
  ).current;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        position: "fixed",
        inset: 0,
        background: "#030812",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        overflow: "hidden",
        cursor: "pointer",
      }}
      onClick={onDone}
      data-ocid="intro.canvas_target"
    >
      {/* Sparkles */}
      {sparkles.map((s, _i) => (
        <Sparkle key={`sparkle-${s.x.toFixed(1)}-${s.y.toFixed(1)}`} {...s} />
      ))}

      {/* Board silhouette */}
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.7, type: "spring", stiffness: 120 }}
        style={{
          width: 160,
          height: 160,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(0,50,120,0.6) 0%, rgba(0,20,60,0.4) 60%, transparent 100%)",
          boxShadow: `0 0 40px 15px ${selectedDart.color}55, 0 0 80px 30px ${selectedDart.color}22`,
          border: `2px solid ${selectedDart.color}44`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 28,
        }}
      >
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: "50%",
            border: `1.5px solid ${selectedDart.color}33`,
          }}
        />
      </motion.div>

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        style={{
          fontFamily: "Bricolage Grotesque, sans-serif",
          fontSize: "clamp(36px, 10vw, 56px)",
          fontWeight: 900,
          color: "#00e8ff",
          textShadow: "0 0 20px #00e8ffaa, 0 0 40px #00e8ff55",
          letterSpacing: "0.12em",
          marginBottom: 14,
          textAlign: "center",
        }}
      >
        NEON DARTS
      </motion.h1>

      {/* Dart name badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.55, duration: 0.4 }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 18px",
          borderRadius: 999,
          background: `${selectedDart.color}18`,
          border: `1px solid ${selectedDart.color}55`,
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 13,
          color: selectedDart.color,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: selectedDart.color,
            boxShadow: `0 0 6px ${selectedDart.color}`,
          }}
        />
        {selectedDart.name}
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ delay: 1, duration: 0.5 }}
        style={{
          position: "absolute",
          bottom: 40,
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 11,
          color: "white",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
        }}
      >
        Tap to skip
      </motion.p>
    </motion.div>
  );
}

// ─── Countdown Screen ─────────────────────────────────────────
function CountdownScreen({
  selectedDart,
  onDone,
}: {
  selectedDart: DartConfig;
  onDone: () => void;
}) {
  const [step, setStep] = useState<number>(3); // 3 2 1 0=THROW

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setStep(2), 500));
    timers.push(setTimeout(() => setStep(1), 1000));
    timers.push(setTimeout(() => setStep(0), 1500));
    timers.push(setTimeout(() => onDone(), 1900));
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  const label = step === 0 ? "THROW!" : String(step);
  const isThrow = step === 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        background: "#030812",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.6, opacity: 0 }}
          transition={{ duration: 0.3, type: "spring", stiffness: 200 }}
          style={{
            fontFamily: "Bricolage Grotesque, sans-serif",
            fontSize: isThrow
              ? "clamp(52px, 16vw, 96px)"
              : "clamp(80px, 25vw, 160px)",
            fontWeight: 900,
            color: isThrow ? selectedDart.color : "#ffffff",
            textShadow: isThrow
              ? `0 0 30px ${selectedDart.color}cc, 0 0 60px ${selectedDart.color}66`
              : "0 0 30px rgba(255,255,255,0.8), 0 0 60px rgba(255,255,255,0.4)",
            letterSpacing: isThrow ? "0.06em" : "0",
            textAlign: "center",
          }}
        >
          {label}
        </motion.div>
      </AnimatePresence>

      {/* Radial flash on THROW */}
      {isThrow && (
        <motion.div
          initial={{ opacity: 0.7, scale: 0.5 }}
          animate={{ opacity: 0, scale: 3 }}
          transition={{ duration: 0.5 }}
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at 50% 50%, ${selectedDart.color}44 0%, transparent 70%)`,
            pointerEvents: "none",
          }}
        />
      )}
    </motion.div>
  );
}

export default function App() {
  const [phase, setPhase] = useState<GamePhase>("dartSelection");
  const [selectedDart, setSelectedDart] = useState<DartConfig>(DART_CONFIGS[2]);
  const [gameMode, setGameMode] = useState<GameMode>("around-world");

  // Game state
  const [score, setScore] = useState(0);
  const [dartsLeft, setDartsLeft] = useState(3);
  const [totalDarts, setTotalDarts] = useState(0);
  const [allThrows, setAllThrows] = useState<ThrowResult[]>([]);
  const [recentThrows, setRecentThrows] = useState<RecentThrow[]>([]);
  const [bustActive, setBustActive] = useState(false);
  const [turnStartScore, setTurnStartScore] = useState(301);
  const [latestThrow, setLatestThrow] = useState<ThrowResult | null>(null);
  const [aroundWorldTarget, setAroundWorldTarget] = useState(1);

  const stateRef = useRef({ score, dartsLeft, turnStartScore, totalDarts });
  stateRef.current = { score, dartsLeft, turnStartScore, totalDarts };
  const bustTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { actor } = useActor();
  const { playThrow, playImpact } = useDartAudio();

  const submitMutation = useMutation({
    mutationFn: async (vars: {
      remaining: number;
      darts: number;
      won: boolean;
    }) => {
      if (!actor) return null;
      return actor.submitGame(
        "Anonymous",
        BigInt(vars.remaining),
        BigInt(vars.darts),
        vars.won,
      );
    },
  });

  const startGame = useCallback((dart: DartConfig, mode: GameMode) => {
    if (bustTimerRef.current) clearTimeout(bustTimerRef.current);
    setSelectedDart(dart);
    setGameMode(mode);
    setScore(mode === "game" ? 301 : 0);
    setDartsLeft(3);
    setTotalDarts(0);
    setAllThrows([]);
    setRecentThrows([]);
    setTurnStartScore(301);
    setBustActive(false);
    setLatestThrow(null);
    setAroundWorldTarget(1);
    setPhase("intro");
  }, []);

  const handleThrow = useCallback(
    (result: ThrowResult, mode: GameMode) => {
      if (bustActive) return;
      const {
        score: cur,
        dartsLeft: dl,
        turnStartScore: tss,
        totalDarts: td,
      } = stateRef.current;

      const newTotal = td + 1;
      const newDartsLeft = dl - 1;
      const throwEntry: RecentThrow = {
        id: ++throwIdCounter,
        score: result.score,
        label: result.label,
        bust: false,
      };

      setAllThrows((prev) => [...prev, result]);
      setTotalDarts(newTotal);
      setLatestThrow(result);

      if (mode === "around-world") {
        setScore((prev) => prev + result.score);
        setRecentThrows((prev) => [...prev.slice(-9), throwEntry]);
        setDartsLeft(newDartsLeft <= 0 ? 3 : newDartsLeft);
        // Advance target if hit exact segment
        setAroundWorldTarget((prev) => {
          if (result.segment === prev && result.multiplier > 0) {
            return Math.min(prev + 1, 20);
          }
          return prev;
        });
        return;
      }

      if (mode === "doubles" || mode === "triples") {
        setScore((prev) => prev + result.score);
        setRecentThrows((prev) => [...prev.slice(-9), throwEntry]);
        setDartsLeft(newDartsLeft <= 0 ? 3 : newDartsLeft);
        return;
      }

      // Game mode: 301 logic
      const newScore = cur - result.score;
      const isBust =
        newScore < 0 ||
        newScore === 1 ||
        (newScore === 0 && result.multiplier !== 2);
      const isWin = newScore === 0 && result.multiplier === 2;

      if (isWin) {
        setScore(0);
        setRecentThrows((prev) => [...prev.slice(-9), throwEntry]);
        submitMutation.mutate({ remaining: 0, darts: newTotal, won: true });
        setTimeout(() => setPhase("won"), 600);
        return;
      }

      if (isBust) {
        throwEntry.bust = true;
        setRecentThrows((prev) => [...prev.slice(-9), throwEntry]);
        setBustActive(true);
        bustTimerRef.current = setTimeout(() => {
          setScore(tss);
          setDartsLeft(3);
          setTurnStartScore(tss);
          setBustActive(false);
          submitMutation.mutate({
            remaining: tss,
            darts: newTotal,
            won: false,
          });
        }, 1600);
        return;
      }

      setScore(newScore);
      setRecentThrows((prev) => [...prev.slice(-9), throwEntry]);

      if (newDartsLeft <= 0) {
        setDartsLeft(3);
        setTurnStartScore(newScore);
        submitMutation.mutate({
          remaining: newScore,
          darts: newTotal,
          won: false,
        });
      } else {
        setDartsLeft(newDartsLeft);
      }
    },
    [bustActive, submitMutation],
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030812]">
      <AnimatePresence mode="wait">
        {phase === "dartSelection" && (
          <motion.div
            key="dartSelection"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <DartSelectionScreen
              onSelect={(dart) => {
                setSelectedDart(dart);
                setPhase("modeSelect");
              }}
            />
          </motion.div>
        )}
        {phase === "modeSelect" && (
          <motion.div
            key="modeSelect"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ModeSelectScreen
              selectedDart={selectedDart}
              onSelect={(mode) => startGame(selectedDart, mode)}
              onBack={() => setPhase("dartSelection")}
            />
          </motion.div>
        )}
        {phase === "intro" && (
          <IntroScreen
            key="intro"
            selectedDart={selectedDart}
            onDone={() => setPhase("countdown")}
          />
        )}
        {phase === "countdown" && (
          <CountdownScreen
            key="countdown"
            selectedDart={selectedDart}
            onDone={() => setPhase("playing")}
          />
        )}
        {phase === "playing" && (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0 }}
          >
            <PlayingScreen
              selectedDart={selectedDart}
              gameMode={gameMode}
              score={score}
              dartsLeft={dartsLeft}
              totalDarts={totalDarts}
              recentThrows={recentThrows}
              bustActive={bustActive}
              allThrows={allThrows}
              latestThrow={latestThrow}
              aroundWorldTarget={aroundWorldTarget}
              onThrow={handleThrow}
              onImpact={playImpact}
              onQuit={() => setPhase("dartSelection")}
              playThrow={playThrow}
            />
          </motion.div>
        )}
        {phase === "won" && (
          <motion.div
            key="won"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <WinScreen
              totalDarts={totalDarts}
              onPlayAgain={() => startGame(selectedDart, gameMode)}
              onBack={() => setPhase("dartSelection")}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Score Blocks (301 mode only) ────────────────────────────
const TOTAL_BLOCKS = 301;

function ScoreBlocks({
  score,
  dartColor,
}: {
  score: number;
  dartColor: string;
}) {
  const prevScoreRef = useRef(score);
  const [explodingRange, setExplodingRange] = useState<[number, number] | null>(
    null,
  );

  useEffect(() => {
    const prev = prevScoreRef.current;
    if (prev !== score && prev > score) {
      // explodingRange: [newScore, prevScore) i.e. blocks that just scored
      setExplodingRange([score, prev]);
      setTimeout(() => setExplodingRange(null), 700);
    }
    prevScoreRef.current = score;
  }, [score]);

  const blocks = Array.from({ length: TOTAL_BLOCKS }, (_, i) => {
    const blockNum = TOTAL_BLOCKS - i; // blockNum=301 is top, blockNum=1 is bottom
    const isActive = blockNum <= score;
    const isExploding =
      explodingRange &&
      blockNum > explodingRange[0] &&
      blockNum <= explodingRange[1];
    return { blockNum, isActive, isExploding };
  });

  return (
    <div
      style={{
        position: "absolute",
        right: 6,
        top: "10%",
        bottom: "10%",
        width: 26,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        gap: 0.5,
        zIndex: 10,
        pointerEvents: "none",
      }}
    >
      {blocks.map(({ blockNum, isActive, isExploding }, i) => (
        <motion.div
          key={blockNum}
          style={{
            height: 2,
            width: "100%",
            borderRadius: 1,
          }}
          animate={{
            background: isActive ? dartColor : "rgba(255,255,255,0.07)",
            boxShadow: isActive ? `0 0 3px ${dartColor}88` : "none",
            y: isExploding ? -30 - (i % 10) * 3 : 0,
            opacity: isExploding ? 0 : 1,
            scale: isExploding ? 0.5 : 1,
          }}
          transition={{
            duration: isExploding ? 0.4 : 0.15,
            delay: isExploding ? (i % 10) * 0.015 : 0,
          }}
        />
      ))}
    </div>
  );
}

// ─── Hit Effect Overlay ───────────────────────────────────────
function HitEffect({
  type,
}: {
  type: "double" | "triple" | "bullseye";
  dartColor?: string;
}) {
  if (type === "double") {
    return (
      <motion.div
        initial={{ opacity: 0.8 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 40%, rgba(0,150,255,0.55) 0%, transparent 60%)",
          pointerEvents: "none",
          zIndex: 20,
        }}
      />
    );
  }
  if (type === "triple") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.6, 0] }}
        transition={{ duration: 0.7 }}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 20,
        }}
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            initial={{ scale: 0.3 + i * 0.15, opacity: 0.9 }}
            animate={{ scale: 0.7 + i * 0.35, opacity: 0 }}
            transition={{ duration: 0.7, delay: i * 0.08 }}
            style={{
              position: "absolute",
              inset: 0,
              border: "2px solid rgba(0,232,255,0.8)",
              borderRadius: "50%",
              margin: "auto",
              width: "60%",
              height: "60%",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              boxShadow: "0 0 12px rgba(0,232,255,0.5)",
            }}
          />
        ))}
      </motion.div>
    );
  }
  // bullseye
  return (
    <motion.div
      initial={{ opacity: 0.9 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.9 }}
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(circle at 50% 40%, rgba(255,220,0,0.7) 0%, rgba(255,255,255,0.3) 30%, transparent 70%)",
        pointerEvents: "none",
        zIndex: 20,
      }}
    />
  );
}

// ─── Playing Screen ───────────────────────────────────────────
function PlayingScreen({
  selectedDart,
  gameMode,
  score,
  dartsLeft,
  totalDarts,
  recentThrows,
  bustActive,
  allThrows,
  latestThrow,
  aroundWorldTarget,
  onThrow,
  onImpact,
  onQuit,
  playThrow,
}: {
  selectedDart: DartConfig;
  gameMode: GameMode;
  score: number;
  dartsLeft: number;
  totalDarts: number;
  recentThrows: RecentThrow[];
  bustActive: boolean;
  allThrows: ThrowResult[];
  latestThrow: ThrowResult | null;
  aroundWorldTarget: number;
  onThrow: (result: ThrowResult, mode: GameMode) => void;
  onImpact: () => void;
  onQuit: () => void;
  playThrow: () => void;
}) {
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const flickZoneRef = useRef<HTMLDivElement>(null);
  const [throwTargetData, setThrowTargetData] =
    useState<ThrowTargetData | null>(null);

  // Dart number indicator
  const [dartNumberVisible, setDartNumberVisible] = useState(false);
  const prevDartsLeftRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevDartsLeftRef.current === null) {
      prevDartsLeftRef.current = dartsLeft;
      return;
    }
    if (dartsLeft !== prevDartsLeftRef.current) {
      prevDartsLeftRef.current = dartsLeft;
      setDartNumberVisible(true);
      const t = setTimeout(() => setDartNumberVisible(false), 1200);
      return () => clearTimeout(t);
    }
  }, [dartsLeft]);

  const dartNumber = dartsLeft === 3 ? 1 : dartsLeft === 2 ? 2 : 3;

  // Hit effects
  const [hitEffectType, setHitEffectType] = useState<
    "double" | "triple" | "bullseye" | null
  >(null);
  const { playDouble, playTriple, playBullseye } = useDartAudio();

  const prevLatestRef = useRef<ThrowResult | null>(null);
  useEffect(() => {
    if (latestThrow && latestThrow !== prevLatestRef.current) {
      prevLatestRef.current = latestThrow;
      triggerImpactHaptic();
      onImpact();

      if (
        latestThrow.multiplier === 2 &&
        latestThrow.segment === 25 &&
        latestThrow.score === 50
      ) {
        setHitEffectType("bullseye");
        playBullseye();
        setTimeout(() => setHitEffectType(null), 900);
      } else if (latestThrow.multiplier === 3) {
        setHitEffectType("triple");
        playTriple();
        setTimeout(() => setHitEffectType(null), 700);
      } else if (latestThrow.multiplier === 2) {
        setHitEffectType("double");
        playDouble();
        setTimeout(() => setHitEffectType(null), 600);
      }
    }
  }, [latestThrow, onImpact, playBullseye, playDouble, playTriple]);

  const handleFlick = useCallback(
    (flickResult: import("./hooks/useFlickInput").FlickResult) => {
      const boardRect = boardContainerRef.current?.getBoundingClientRect();
      const flickRect = flickZoneRef.current?.getBoundingClientRect();
      if (!boardRect || !flickRect) return;

      const startScreenX =
        flickRect.left + flickRect.width / 2 + flickResult.dartPos.x;
      const startScreenY =
        flickRect.top + flickRect.height / 2 + flickResult.dartPos.y;

      const hit = computeHitFromFlick(
        flickResult.aimOffsetNX,
        flickResult.aimOffsetNY,
        flickResult.power,
        selectedDart,
      );

      const baseScatter = 2 + (1 - selectedDart.stability / 100) * 8;
      const throwResult = computeScore(hit.x, hit.y, baseScatter);

      setThrowTargetData({
        svgX: throwResult.x,
        svgY: throwResult.y,
        boardRect,
        startScreenX,
        startScreenY,
        flightDuration: getFlightDuration(selectedDart),
      });

      playThrow();
      onThrow(throwResult, gameMode);
    },
    [selectedDart, gameMode, onThrow, playThrow],
  );

  const {
    flickState,
    dartPos,
    pullDistance,
    engaged,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useFlickInput(selectedDart, handleFlick, flickZoneRef);

  // Camera engage zoom
  const [cameraEngaged, setCameraEngaged] = useState(false);
  const cameraSnapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (flickState === "grabbed") {
      if (cameraSnapTimerRef.current) clearTimeout(cameraSnapTimerRef.current);
      setCameraEngaged(true);
    } else if (flickState === "idle") {
      if (cameraSnapTimerRef.current) clearTimeout(cameraSnapTimerRef.current);
      setCameraEngaged(false);
    }
  }, [flickState]);

  const prevLatestForCameraRef = useRef<ThrowResult | null>(null);
  useEffect(() => {
    if (latestThrow && latestThrow !== prevLatestForCameraRef.current) {
      prevLatestForCameraRef.current = latestThrow;
      if (cameraSnapTimerRef.current) clearTimeout(cameraSnapTimerRef.current);
      cameraSnapTimerRef.current = setTimeout(
        () => setCameraEngaged(false),
        400,
      );
    }
  }, [latestThrow]);

  const practiceMode =
    gameMode === "game"
      ? null
      : (gameMode as "around-world" | "doubles" | "triples");

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ background: "#030812" }}
    >
      {/* ── Arena background ── */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% -5%, rgba(20,80,220,0.28) 0%, transparent 65%), " +
            "radial-gradient(ellipse 35% 50% at 8% 95%, rgba(0,60,200,0.18) 0%, transparent 60%), " +
            "radial-gradient(ellipse 35% 50% at 92% 95%, rgba(0,60,200,0.18) 0%, transparent 60%), " +
            "linear-gradient(180deg, #030812 0%, #040a1a 60%, #030812 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Top spotlight cone */}
      <div
        className="absolute"
        style={{
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "55%",
          height: "65%",
          background:
            "conic-gradient(from 80deg at 50% -10%, transparent 0%, rgba(200,220,255,0.06) 8%, transparent 17%)",
          pointerEvents: "none",
        }}
      />

      {/* Left corner light */}
      <div
        className="absolute"
        style={{
          bottom: "40%",
          left: 0,
          width: "28%",
          height: "50%",
          background:
            "radial-gradient(ellipse at 0% 100%, rgba(0,80,255,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      {/* Right corner light */}
      <div
        className="absolute"
        style={{
          bottom: "40%",
          right: 0,
          width: "28%",
          height: "50%",
          background:
            "radial-gradient(ellipse at 100% 100%, rgba(0,80,255,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* ── HUD strip (top overlay) ── */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{ zIndex: 30, padding: "8px 10px" }}
      >
        <GameHUD
          score={score}
          dartsLeft={dartsLeft}
          totalDarts={totalDarts}
          recentThrows={recentThrows}
          bustActive={bustActive}
          mode={gameMode}
          dartColor={selectedDart.color}
          onQuit={onQuit}
        />
      </div>

      {/* Practice mode label */}
      {gameMode !== "game" && (
        <div
          style={{
            position: "absolute",
            top: 58,
            left: 0,
            right: 0,
            textAlign: "center",
            zIndex: 5,
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 9,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.3)",
            }}
          >
            {gameMode === "around-world"
              ? `AROUND THE WORLD · TARGET: ${aroundWorldTarget}`
              : gameMode === "doubles"
                ? "DOUBLES PRACTICE"
                : "TRIPLES PRACTICE"}
          </span>
        </div>
      )}

      {/* ── Board area (upper ~56%) ── */}
      <div
        className="absolute left-0 right-0"
        style={{
          top: "58px",
          height: "calc(56% - 58px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <motion.div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
          }}
          animate={{ scale: cameraEngaged ? 1.06 : 1.0 }}
          transition={{
            duration: cameraEngaged ? 0.18 : 0.55,
            ease: cameraEngaged ? "easeOut" : "easeInOut",
          }}
        >
          {/* Board radial glow */}
          <div
            className="absolute"
            style={{
              width: "90%",
              height: "120%",
              background: `radial-gradient(ellipse 60% 60% at 50% 50%, ${selectedDart.color}18 0%, transparent 65%)`,
              pointerEvents: "none",
            }}
          />
          <div
            ref={boardContainerRef}
            style={{
              width: "min(82vw, calc(52vh - 30px))",
              height: "min(82vw, calc(52vh - 30px))",
              position: "relative",
            }}
          >
            <DartBoard
              throws={allThrows}
              bustActive={bustActive}
              latestThrow={latestThrow}
              practiceMode={practiceMode}
              aroundWorldTarget={aroundWorldTarget}
            />
          </div>
        </motion.div>
      </div>

      {/* ── Score Blocks (game mode only) ── */}
      {gameMode === "game" && (
        <ScoreBlocks score={score} dartColor={selectedDart.color} />
      )}

      {/* ── Hit Effect Overlays ── */}
      <AnimatePresence>
        {hitEffectType && (
          <HitEffect
            key={hitEffectType + String(latestThrow?.id)}
            type={hitEffectType}
            dartColor={selectedDart.color}
          />
        )}
      </AnimatePresence>

      {/* ── Dart Number Indicator ── */}
      <AnimatePresence>
        {dartNumberVisible && (
          <motion.div
            key={`dart-${dartNumber}`}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: [0.5, 1, 1.1], opacity: [0, 1, 0.8] }}
            exit={{ opacity: 0, scale: 1.3 }}
            transition={{ duration: 0.5, times: [0, 0.4, 1] }}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 50,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                fontFamily: "Bricolage Grotesque, sans-serif",
                fontSize: "clamp(32px, 10vw, 56px)",
                fontWeight: 900,
                color: selectedDart.color,
                textShadow: `0 0 20px ${selectedDart.color}cc, 0 0 40px ${selectedDart.color}66`,
                letterSpacing: "0.08em",
              }}
            >
              ◆ DART {dartNumber}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Flick zone (lower 44%) ── */}
      <div
        ref={flickZoneRef}
        className="absolute left-0 right-0 bottom-0"
        style={{
          height: "44%",
          touchAction: "none",
          WebkitTapHighlightColor: "transparent",
          WebkitUserSelect: "none",
          outline: "none",
          userSelect: "none",
          cursor: flickState === "idle" ? "pointer" : "none",
          zIndex: 15,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        data-ocid="game.canvas_target"
      >
        {/* Subtle zone separator line */}
        <div
          className="absolute top-0 left-0 right-0"
          style={{
            height: "1px",
            background: `linear-gradient(90deg, transparent, ${selectedDart.color}40, transparent)`,
          }}
        />

        {/* Dart holding canvas */}
        <DartHoldingCanvas
          dartConfig={selectedDart}
          dartPos={dartPos}
          flickState={flickState}
          pullDistance={pullDistance}
        />

        {/* Idle / engaged pulse ring */}
        {(flickState === "idle" || engaged) && (
          <div
            className="absolute"
            style={{
              bottom: "30%",
              left: "50%",
              transform: "translateX(-50%)",
              width: engaged ? 72 : 56,
              height: engaged ? 72 : 56,
              borderRadius: "50%",
              border: `${engaged ? 2 : 1.5}px solid ${selectedDart.color}${engaged ? "99" : "55"}`,
              boxShadow: engaged ? `0 0 16px ${selectedDart.color}88` : "none",
              animation: `pulse-ring ${engaged ? "0.8s" : "2s"} ease-in-out infinite`,
              pointerEvents: "none",
              transition: "all 0.3s ease",
            }}
          />
        )}

        {/* Aim guide line (grabbed state) */}
        {flickState === "grabbed" && (
          <svg
            aria-hidden="true"
            className="absolute inset-0 w-full h-full"
            style={{ pointerEvents: "none" }}
          >
            <defs>
              <marker
                id="aim-arrow"
                markerWidth="6"
                markerHeight="6"
                refX="3"
                refY="3"
                orient="auto"
              >
                <path
                  d="M0,0 L6,3 L0,6 Z"
                  fill={selectedDart.color}
                  opacity="0.5"
                />
              </marker>
            </defs>
            <line
              x1="50%"
              y1="50%"
              x2="50%"
              y2="-100%"
              stroke={selectedDart.color}
              strokeWidth="1"
              strokeDasharray="4 8"
              opacity="0.3"
              markerEnd="url(#aim-arrow)"
            />
          </svg>
        )}

        {/* Power indicator (pulled back) */}
        {(flickState === "grabbed" || flickState === "released") &&
          pullDistance > 0.08 && (
            <div className="absolute left-4 right-4" style={{ bottom: 12 }}>
              <div
                className="h-1 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.1)" }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${selectedDart.color}, #ffffff)`,
                    width: `${pullDistance * 100}%`,
                    boxShadow: `0 0 8px ${selectedDart.color}`,
                  }}
                  animate={{ width: `${pullDistance * 100}%` }}
                  transition={{ duration: 0.05 }}
                />
              </div>
            </div>
          )}

        {/* Flick hint text */}
        {flickState === "idle" && (
          <p
            className="absolute font-mono text-center"
            style={{
              bottom: 8,
              left: 0,
              right: 0,
              fontSize: 10,
              color: "rgba(255,255,255,0.2)",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              pointerEvents: "none",
            }}
          >
            {engaged
              ? "TAP AGAIN TO FIRE · OR FLICK TO AIM"
              : "TAP TO ENGAGE · FLICK TO THROW"}
          </p>
        )}
      </div>

      {/* ── Fullscreen DartFlight overlay ── */}
      <DartFlight
        throwTargetData={throwTargetData}
        onImpact={() => {}}
        dartConfig={selectedDart}
      />

      {/* Bust overlay */}
      <AnimatePresence>
        {bustActive && (
          <motion.div
            key="bust-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
            style={{ zIndex: 25, pointerEvents: "none" }}
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="px-8 py-4 rounded-2xl"
              style={{
                background: "rgba(160,10,10,0.85)",
                border: "2px solid rgba(255,60,60,0.6)",
                backdropFilter: "blur(12px)",
                boxShadow: "0 0 40px rgba(255,0,0,0.4)",
              }}
            >
              <p
                className="text-5xl font-display font-black text-white"
                style={{ textShadow: "0 0 20px #ff4444" }}
              >
                BUST!
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Win Screen ───────────────────────────────────────────────
function WinScreen({
  totalDarts,
  onPlayAgain,
  onBack,
}: {
  totalDarts: number;
  onPlayAgain: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(0,200,100,0.15) 0%, transparent 70%), linear-gradient(180deg, #030812 0%, #050d20 100%)",
      }}
    >
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, delay: 0.15 }}
        className="text-center mb-10"
      >
        <div className="text-7xl mb-4">🎯</div>
        <h1
          className="text-6xl font-display font-black"
          style={{
            color: "#40ff80",
            textShadow: "0 0 20px #40ff8088, 0 0 40px #40ff8044",
          }}
        >
          CHECKOUT!
        </h1>
        <p className="text-white/50 font-mono mt-3 text-sm">
          Finished in{" "}
          <span className="text-white font-bold">{totalDarts} darts</span>
        </p>
      </motion.div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          type="button"
          onClick={onPlayAgain}
          className="w-full py-4 rounded-2xl font-display font-bold text-lg text-black transition-all hover:scale-105"
          style={{
            background: "#40ff80",
            boxShadow: "0 0 20px #40ff8055",
          }}
          data-ocid="win.primary_button"
        >
          Play Again
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full py-4 rounded-2xl font-display font-bold text-base text-white/60 transition-all hover:text-white"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
          data-ocid="win.secondary_button"
        >
          Change Dart
        </button>
      </div>

      <footer className="absolute bottom-0 left-0 right-0 text-center py-2 text-[10px] text-white/20 font-mono">
        © {new Date().getFullYear()} Built with love using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/40 hover:text-white/60 transition-colors"
        >
          caffeine.ai
        </a>
      </footer>
    </motion.div>
  );
}
