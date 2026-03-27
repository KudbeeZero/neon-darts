import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActor } from "@/hooks/useActor";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useRef, useState } from "react";
import type { GameResult } from "./backend.d";
import DartBoard, { type ThrowResult } from "./components/DartBoard";
import DartFlight from "./components/DartFlight";
import GameHUD from "./components/GameHUD";
import StarField from "./components/StarField";
import { useDartAudio } from "./hooks/useDartAudio";

type GamePhase = "setup" | "playing" | "won";

interface RecentThrow {
  id: number;
  label: string;
  score: number;
  bust: boolean;
}

interface ThrowTarget {
  svgX: number;
  svgY: number;
}

let throwIdCounter = 0;

export default function App() {
  const [phase, setPhase] = useState<GamePhase>("setup");
  const [playerName, setPlayerName] = useState("");
  const [score, setScore] = useState(301);
  const [dartsLeft, setDartsLeft] = useState(3);
  const [totalDarts, setTotalDarts] = useState(0);
  const [allThrows, setAllThrows] = useState<ThrowResult[]>([]);
  const [recentThrows, setRecentThrows] = useState<RecentThrow[]>([]);
  const [turnStartScore, setTurnStartScore] = useState(301);
  const [bustActive, setBustActive] = useState(false);
  const [cameraZoomed, setCameraZoomed] = useState(false);
  const [cameraShake, setCameraShake] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [throwTarget, setThrowTarget] = useState<ThrowTarget | null>(null);
  const [dartColorIndex, setDartColorIndex] = useState(0);

  const stateRef = useRef({
    score: 301,
    dartsLeft: 3,
    turnStartScore: 301,
    totalDarts: 0,
  });
  stateRef.current = { score, dartsLeft, turnStartScore, totalDarts };
  const bustTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { actor, isFetching } = useActor();
  const { playThrow, playImpact } = useDartAudio();

  const submitMutation = useMutation({
    mutationFn: async ({
      remaining,
      darts,
      won,
    }: { remaining: number; darts: number; won: boolean }) => {
      if (!actor) return null;
      return actor.submitGame(
        playerName || "Anonymous",
        BigInt(remaining),
        BigInt(darts),
        won,
      );
    },
  });

  const leaderboardQuery = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async (): Promise<GameResult[]> => {
      if (!actor) return [];
      return actor.getLeaderboard();
    },
    enabled: !!actor && !isFetching && showLeaderboard,
  });

  const startGame = useCallback(() => {
    if (bustTimerRef.current) clearTimeout(bustTimerRef.current);
    setPhase("playing");
    setScore(301);
    setDartsLeft(3);
    setTotalDarts(0);
    setAllThrows([]);
    setRecentThrows([]);
    setTurnStartScore(301);
    setBustActive(false);
    setCameraZoomed(false);
    setCameraShake({ x: 0, y: 0 });
    setThrowTarget(null);
    setDartColorIndex(0);
  }, []);

  const handleImpact = useCallback(() => {
    playImpact();
  }, [playImpact]);

  const handleThrow = useCallback(
    (result: ThrowResult) => {
      if (bustActive) return;
      const {
        score: cur,
        dartsLeft: dl,
        turnStartScore: tss,
        totalDarts: td,
      } = stateRef.current;
      const newTotal = td + 1;
      const newScore = cur - result.score;
      const newDartsLeft = dl - 1;

      setCameraZoomed(true);
      setTimeout(() => setCameraZoomed(false), 650);

      // CSS camera shake
      const shakeFrames = [
        { x: 4, y: -3 },
        { x: -3, y: 4 },
        { x: 3, y: -2 },
        { x: -2, y: 3 },
        { x: 0, y: 0 },
      ];
      shakeFrames.forEach((frame, i) => {
        setTimeout(() => setCameraShake(frame), i * 64);
      });

      // Throw sound
      playThrow();

      // Set 3D dart target (SVG coords 0-400)
      setThrowTarget({ svgX: result.x, svgY: result.y });
      setDartColorIndex((prev) => (prev + 1) % 3);

      setAllThrows((prev) => [...prev, result]);
      setTotalDarts(newTotal);

      const isDouble =
        result.multiplier === 2 ||
        (result.segment === 25 && result.score === 50);

      if (newScore === 0 && isDouble) {
        setScore(0);
        setRecentThrows((prev) => [
          {
            id: ++throwIdCounter,
            label: result.label,
            score: result.score,
            bust: false,
          },
          ...prev.slice(0, 9),
        ]);
        setPhase("won");
        submitMutation.mutate({ remaining: 0, darts: newTotal, won: true });
        return;
      }

      const isBust =
        newScore < 0 || newScore === 1 || (newScore === 0 && !isDouble);

      if (isBust) {
        setBustActive(true);
        setRecentThrows((prev) => [
          { id: ++throwIdCounter, label: "BUST!", score: 0, bust: true },
          ...prev.slice(0, 9),
        ]);
        if (bustTimerRef.current) clearTimeout(bustTimerRef.current);
        bustTimerRef.current = setTimeout(() => {
          setScore(tss);
          setDartsLeft(3);
          setAllThrows((prev) => prev.slice(0, prev.length - 1));
          setBustActive(false);
        }, 2000);
        return;
      }

      setScore(newScore);
      setRecentThrows((prev) => [
        {
          id: ++throwIdCounter,
          label: result.label,
          score: result.score,
          bust: false,
        },
        ...prev.slice(0, 9),
      ]);

      if (newDartsLeft === 0) {
        setDartsLeft(3);
        setTurnStartScore(newScore);
      } else {
        setDartsLeft(newDartsLeft);
      }
    },
    [bustActive, submitMutation, playThrow],
  );

  const dartColors = ["#00e8ff", "#ff40b0", "#40ff80"];

  return (
    <div className="relative min-h-screen font-body overflow-hidden">
      <div className="space-bg" />
      <StarField />
      <div className="relative" style={{ zIndex: 1 }}>
        <AnimatePresence mode="wait">
          {phase === "setup" && (
            <SetupScreen
              key="setup"
              playerName={playerName}
              setPlayerName={setPlayerName}
              onStart={startGame}
            />
          )}
          {phase === "playing" && (
            <PlayingScreen
              key="playing"
              score={score}
              dartsLeft={dartsLeft}
              totalDarts={totalDarts}
              recentThrows={recentThrows}
              bustActive={bustActive}
              allThrows={allThrows}
              playerName={playerName}
              cameraZoomed={cameraZoomed}
              cameraShake={cameraShake}
              throwTarget={throwTarget}
              dartColor={dartColors[dartColorIndex]}
              onThrow={handleThrow}
              onImpact={handleImpact}
            />
          )}
          {phase === "won" && (
            <WinScreen
              key="won"
              playerName={playerName}
              totalDarts={totalDarts}
              leaderboard={leaderboardQuery.data}
              isLoadingLB={leaderboardQuery.isFetching}
              showLeaderboard={showLeaderboard}
              onShowLeaderboard={() => setShowLeaderboard(true)}
              onPlayAgain={startGame}
            />
          )}
        </AnimatePresence>
      </div>
      <footer
        className="fixed bottom-0 left-0 right-0 text-center py-2 text-xs text-muted-foreground/40 font-mono"
        style={{ zIndex: 10 }}
      >
        © {new Date().getFullYear()} Built with love using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary/60 hover:text-primary transition-colors"
        >
          caffeine.ai
        </a>
      </footer>
    </div>
  );
}

// ─── Setup Screen ─────────────────────────────────────────────
const RULES = [
  "Start at 301, reach exactly zero",
  "Must finish on a Double or Bullseye",
  "Bust = score reverts to turn start",
  "T = Triple · D = Double · Bull = 25 · Bull· = 50",
];

function SetupScreen({
  playerName,
  setPlayerName,
  onStart,
}: {
  playerName: string;
  setPlayerName: (n: string) => void;
  onStart: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="min-h-screen flex flex-col items-center justify-center px-4 py-20"
    >
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.7 }}
        className="text-center mb-12"
      >
        <div
          className="text-7xl mb-4 animate-float"
          style={{ filter: "drop-shadow(0 0 30px #00d4cc)" }}
        >
          🎯
        </div>
        <h1 className="text-6xl md:text-8xl font-display font-black tracking-tight neon-text-cyan mb-2">
          NEON
        </h1>
        <h2 className="text-5xl md:text-7xl font-display font-black tracking-widest neon-text-pink">
          DARTS
        </h2>
        <p className="mt-4 text-muted-foreground font-mono text-sm tracking-wider uppercase">
          301 · Single Player · Deep Space Edition
        </p>
      </motion.div>

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="glass rounded-2xl p-8 w-full max-w-sm"
      >
        <h3 className="text-lg font-display font-bold text-center mb-6 text-foreground">
          Enter your call sign
        </h3>
        <Input
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onStart()}
          placeholder="Ace, Maverick, Viper..."
          className="bg-muted/20 border-primary/30 text-foreground placeholder:text-muted-foreground/50 font-mono mb-6 text-center text-lg h-12"
          maxLength={24}
          data-ocid="setup.input"
        />
        <Button
          onClick={onStart}
          className="w-full h-12 text-lg font-display font-bold tracking-wide bg-primary text-primary-foreground hover:bg-primary/90 shadow-neon-cyan transition-all hover:scale-105"
          data-ocid="setup.primary_button"
        >
          🚀 Launch Game
        </Button>
        <div className="mt-6 space-y-1.5">
          {RULES.map((rule) => (
            <p
              key={rule}
              className="text-xs font-mono text-muted-foreground/70 flex gap-2"
            >
              <span className="text-primary/60">›</span>
              {rule}
            </p>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Playing Screen ───────────────────────────────────────────
function PlayingScreen({
  score,
  dartsLeft,
  totalDarts,
  recentThrows,
  bustActive,
  allThrows,
  playerName,
  cameraZoomed,
  cameraShake,
  throwTarget,
  dartColor,
  onThrow,
  onImpact,
}: {
  score: number;
  dartsLeft: number;
  totalDarts: number;
  recentThrows: RecentThrow[];
  bustActive: boolean;
  allThrows: ThrowResult[];
  playerName: string;
  cameraZoomed: boolean;
  cameraShake: { x: number; y: number };
  throwTarget: ThrowTarget | null;
  dartColor: string;
  onThrow: (r: ThrowResult) => void;
  onImpact: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col lg:flex-row items-center justify-center gap-4 md:gap-6 lg:gap-8 px-4 py-6 pb-12"
    >
      <div className="flex-shrink-0 flex flex-col items-center">
        <motion.div
          animate={{
            scale: cameraZoomed ? 1.08 : 1,
            rotateX: cameraZoomed ? 1 : 4,
          }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
          style={{ perspective: "1400px", transformStyle: "preserve-3d" }}
        >
          <div
            className="board-glow animate-float"
            style={{
              position: "relative",
              width: "min(90vw, calc(90vh - 160px), 480px)",
              height: "min(90vw, calc(90vh - 160px), 480px)",
              maxWidth: 480,
              maxHeight: 480,
              minWidth: 280,
              minHeight: 280,
              transform: `translate(${cameraShake.x}px, ${cameraShake.y}px)`,
              transition: "transform 64ms linear",
            }}
          >
            <DartBoard
              onThrow={onThrow}
              throws={allThrows}
              bustActive={bustActive}
            />
            <DartFlight
              throwTarget={throwTarget}
              onImpact={onImpact}
              dartColor={dartColor}
            />
          </div>
        </motion.div>
        <p className="mt-3 text-xs font-mono text-muted-foreground/50 uppercase tracking-widest">
          Drag &amp; release to throw
        </p>
      </div>

      <div
        className="w-full max-w-xs"
        style={{ minHeight: 340 }}
        data-ocid="game.panel"
      >
        <GameHUD
          score={score}
          dartsLeft={dartsLeft}
          totalDarts={totalDarts}
          recentThrows={recentThrows}
          bustActive={bustActive}
          playerName={playerName}
        />
      </div>
    </motion.div>
  );
}

// ─── Win Screen ───────────────────────────────────────────────
function WinScreen({
  playerName,
  totalDarts,
  leaderboard,
  isLoadingLB,
  showLeaderboard,
  onShowLeaderboard,
  onPlayAgain,
}: {
  playerName: string;
  totalDarts: number;
  leaderboard: GameResult[] | undefined;
  isLoadingLB: boolean;
  showLeaderboard: boolean;
  onShowLeaderboard: () => void;
  onPlayAgain: () => void;
}) {
  const rating =
    totalDarts <= 20
      ? "COSMIC LEGEND"
      : totalDarts <= 30
        ? "SPACE ACE"
        : totalDarts <= 45
          ? "STAR SHOOTER"
          : totalDarts <= 60
            ? "NOVA PLAYER"
            : "SPACE CADET";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
    >
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-center mb-8"
      >
        <div
          className="text-7xl mb-4 animate-win-pulse"
          style={{ filter: "drop-shadow(0 0 30px #ffe040)" }}
        >
          🏆
        </div>
        <h1 className="text-5xl md:text-6xl font-display font-black neon-text-cyan mb-1">
          CHECKOUT!
        </h1>
        <p className="text-2xl font-mono font-bold neon-text-pink">{rating}</p>
      </motion.div>

      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="glass rounded-2xl p-8 w-full max-w-sm mb-6"
        data-ocid="win.card"
      >
        <div className="text-center mb-6">
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest mb-1">
            Player
          </p>
          <p className="text-xl font-display font-bold text-foreground">
            {playerName || "Anonymous"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="text-center glass rounded-xl p-3">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wide mb-1">
              Darts Thrown
            </p>
            <p className="text-3xl font-mono font-black neon-text-cyan">
              {totalDarts}
            </p>
          </div>
          <div className="text-center glass rounded-xl p-3">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wide mb-1">
              Avg per dart
            </p>
            <p className="text-3xl font-mono font-black neon-text-green">
              {(301 / totalDarts).toFixed(1)}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Button
            onClick={onPlayAgain}
            className="w-full h-11 font-display font-bold text-base bg-primary text-primary-foreground hover:bg-primary/90 shadow-neon-cyan transition-all hover:scale-105"
            data-ocid="win.primary_button"
          >
            🎯 Play Again
          </Button>
          <Button
            variant="outline"
            onClick={onShowLeaderboard}
            className="w-full h-10 font-mono text-sm border-secondary/40 text-secondary hover:bg-secondary/10"
            data-ocid="win.secondary_button"
          >
            📊 View Leaderboard
          </Button>
        </div>
      </motion.div>

      <AnimatePresence>
        {showLeaderboard && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="glass rounded-2xl p-6 w-full max-w-sm"
            data-ocid="win.leaderboard"
          >
            <h3 className="text-sm font-mono font-bold text-center uppercase tracking-widest neon-text-cyan mb-4">
              🌌 Top Scores
            </h3>
            {isLoadingLB ? (
              <div className="text-center py-4" data-ocid="win.loading_state">
                <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : leaderboard && leaderboard.length > 0 ? (
              <div className="space-y-2">
                {leaderboard.slice(0, 8).map((entry, i) => (
                  <div
                    key={`${entry.playerName}-${entry.timestamp.toString()}`}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                      i === 0
                        ? "bg-accent/10 border border-accent/20"
                        : "bg-muted/20"
                    }`}
                    data-ocid={`win.leaderboard.item.${i + 1}`}
                  >
                    <span
                      className={`text-sm font-mono font-bold w-6 ${
                        i === 0
                          ? "neon-text-gold"
                          : i === 1
                            ? "text-muted-foreground"
                            : "text-muted-foreground/60"
                      }`}
                    >
                      #{i + 1}
                    </span>
                    <span className="flex-1 text-sm font-display font-semibold text-foreground truncate">
                      {entry.playerName}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">
                      {entry.dartsThrown.toString()}🎯
                    </span>
                    {entry.didWin && (
                      <span className="text-xs neon-text-green font-mono">
                        WIN
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p
                className="text-center text-muted-foreground/50 font-mono text-sm py-4"
                data-ocid="win.empty_state"
              >
                No games recorded yet
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
