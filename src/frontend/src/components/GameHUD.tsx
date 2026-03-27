import { AnimatePresence, motion } from "motion/react";
import type { GameMode } from "./ModeSelectScreen";

export interface RecentThrow {
  id: number;
  label: string;
  score: number;
  bust: boolean;
}

const CHECKOUTS: Record<number, string> = {
  170: "T20 T20 Bull",
  167: "T20 T19 Bull",
  160: "T20 T20 D20",
  140: "T20 T16 D14",
  130: "T20 T18 D8",
  121: "T20 T11 D14",
  110: "T20 T10 D20",
  100: "T20 D20",
  98: "T20 D19",
  96: "T20 D18",
  90: "T18 D18",
  80: "T16 D16",
  70: "T18 D8",
  60: "20 D20",
  50: "D25",
  40: "D20",
  32: "D16",
  20: "D10",
  10: "D5",
  2: "D1",
};

function getCheckout(score: number): string | null {
  if (score in CHECKOUTS) return CHECKOUTS[score];
  if (score <= 40 && score % 2 === 0) return `D${score / 2}`;
  return null;
}

const MODE_LABELS: Record<GameMode, string> = {
  game: "301",
  "around-world": "ATW",
  doubles: "DBL",
  triples: "TBL",
};

interface Props {
  score: number;
  dartsLeft: number;
  totalDarts: number;
  recentThrows: RecentThrow[];
  bustActive: boolean;
  mode: GameMode;
  dartColor: string;
  onQuit: () => void;
}

export default function GameHUD({
  score,
  dartsLeft,
  totalDarts,
  recentThrows,
  bustActive,
  mode,
  dartColor,
  onQuit,
}: Props) {
  const isGame = mode === "game";
  const checkout = isGame && score <= 170 ? getCheckout(score) : null;

  return (
    <div className="flex items-stretch gap-2" style={{ width: "100%" }}>
      {/* Score block */}
      <div
        className="flex-1 rounded-xl px-3 py-2 flex flex-col items-center justify-center relative overflow-hidden"
        style={{
          background: "rgba(4,12,30,0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: bustActive
            ? "1px solid rgba(200,20,20,0.5)"
            : `1px solid ${dartColor}44`,
          boxShadow: bustActive
            ? "0 0 20px rgba(200,20,20,0.25)"
            : `0 0 16px ${dartColor}22`,
        }}
        data-ocid="game.score_display"
      >
        <p className="text-[9px] font-mono uppercase tracking-widest text-white/30 mb-0.5">
          {isGame ? "Remaining" : "Score"}
        </p>
        <AnimatePresence mode="wait">
          {bustActive ? (
            <motion.p
              key="bust"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="text-2xl font-mono font-black"
              style={{ color: "#ff4444", textShadow: "0 0 10px #ff444488" }}
            >
              BUST!
            </motion.p>
          ) : (
            <motion.p
              key={score}
              initial={{ scale: 0.85, opacity: 0, y: -6 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="text-3xl font-mono font-black"
              style={{
                color: score <= 40 && isGame ? "#40ff80" : "#fff",
                textShadow:
                  score <= 40 && isGame
                    ? "0 0 12px #40ff8088"
                    : `0 0 12px ${dartColor}88`,
              }}
            >
              {score}
            </motion.p>
          )}
        </AnimatePresence>
        {checkout && !bustActive && (
          <p className="text-[9px] font-mono text-emerald-400/80 mt-0.5">
            {checkout}
          </p>
        )}
      </div>

      {/* Darts + mode */}
      <div
        className="flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-xl"
        style={{
          background: "rgba(4,12,30,0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <p className="text-[9px] font-mono uppercase tracking-widest text-white/30">
          Darts
        </p>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-5 rounded-sm"
              style={{
                background: i < dartsLeft ? dartColor : "rgba(255,255,255,0.1)",
                boxShadow: i < dartsLeft ? `0 0 6px ${dartColor}88` : "none",
              }}
            />
          ))}
        </div>
        <div
          className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full"
          style={{
            background: `${dartColor}18`,
            border: `1px solid ${dartColor}44`,
            color: dartColor,
          }}
        >
          {MODE_LABELS[mode]}
        </div>
      </div>

      {/* Recent + total */}
      <div
        className="flex-1 rounded-xl px-2 py-2 flex flex-col justify-center"
        style={{
          background: "rgba(4,12,30,0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <p className="text-[9px] font-mono uppercase tracking-widest text-white/30 mb-1">
          #{totalDarts} · Last throws
        </p>
        <div className="flex flex-col gap-0.5">
          <AnimatePresence initial={false}>
            {recentThrows.slice(-3).map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between"
              >
                <span
                  className="text-[10px] font-mono"
                  style={{
                    color: t.bust
                      ? "#ff4444"
                      : t.score >= 50
                        ? "#40ff80"
                        : t.score >= 30
                          ? "#00e8ff"
                          : "rgba(255,255,255,0.6)",
                  }}
                >
                  {t.label}
                </span>
                <span className="text-[10px] font-mono text-white/30">
                  {t.bust ? "BUST" : `+${t.score}`}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
          {recentThrows.length === 0 && (
            <p className="text-[9px] text-white/20 font-mono">Flick to throw</p>
          )}
        </div>
      </div>

      {/* Quit */}
      <button
        type="button"
        onClick={onQuit}
        className="px-2 rounded-xl text-white/30 hover:text-white/60 text-lg transition-colors"
        style={{
          background: "rgba(4,12,30,0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
        data-ocid="game.close_button"
      >
        ✕
      </button>
    </div>
  );
}
