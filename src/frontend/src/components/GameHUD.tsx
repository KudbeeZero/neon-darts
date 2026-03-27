import { AnimatePresence, motion } from "motion/react";

interface RecentThrow {
  id: number;
  label: string;
  score: number;
  bust: boolean;
}

interface Props {
  score: number;
  dartsLeft: number;
  totalDarts: number;
  recentThrows: RecentThrow[];
  bustActive: boolean;
  playerName: string;
}

const CHECKOUTS: Record<number, string> = {
  170: "T20 T20 Bull",
  167: "T20 T19 Bull",
  164: "T20 T18 Bull",
  161: "T20 T17 Bull",
  160: "T20 T20 D20",
  158: "T20 T20 D19",
  157: "T20 T19 D20",
  156: "T20 T20 D18",
  155: "T20 T19 D19",
  154: "T20 T18 D20",
  150: "T20 T18 D18",
  140: "T20 T16 D14",
  130: "T20 T18 D8",
  121: "T20 T11 D14",
  110: "T20 T10 D20",
  100: "T20 D20",
  99: "T19 D21",
  98: "T20 D19",
  97: "T19 D20",
  96: "T20 D18",
  95: "T19 D19",
  90: "T18 D18",
  81: "T15 D18",
  80: "T16 D16",
  76: "T20 D8",
  70: "T18 D8",
  68: "T20 D4",
  64: "T16 D8",
  60: "20 D20",
  50: "D25",
  40: "D20",
  38: "D19",
  36: "D18",
  32: "D16",
  20: "D10",
  16: "D8",
  10: "D5",
  4: "D2",
  2: "D1",
};

function getCheckout(score: number): string | null {
  if (score in CHECKOUTS) return CHECKOUTS[score];
  if (score <= 40 && score % 2 === 0) return `D${score / 2}`;
  return null;
}

function DartIndicator({ filled, index }: { filled: boolean; index: number }) {
  return (
    <motion.div
      className={`relative w-6 h-10 rounded-sm border ${
        filled
          ? "border-primary bg-primary/20 shadow-neon-cyan"
          : "border-muted/30 bg-muted/10"
      }`}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: index * 0.1 }}
    >
      {filled && (
        <>
          <div className="absolute left-1/2 top-1 bottom-3 w-0.5 -translate-x-1/2 bg-primary rounded-full" />
          <div
            className="absolute bottom-2 left-1/2 -translate-x-1/2 w-3 h-2 opacity-80"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.82 0.18 195) 0%, transparent 60%), linear-gradient(225deg, oklch(0.82 0.18 195) 0%, transparent 60%)",
            }}
          />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
        </>
      )}
    </motion.div>
  );
}

export default function GameHUD({
  score,
  dartsLeft,
  totalDarts,
  recentThrows,
  bustActive,
  playerName,
}: Props) {
  const checkout = score <= 170 ? getCheckout(score) : null;
  const needsDouble = score <= 50;

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Player header */}
      <div className="glass rounded-xl p-3 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-0.5">
          Player
        </p>
        <p className="font-display font-bold text-foreground text-sm truncate">
          {playerName || "Anonymous"}
        </p>
      </div>

      {/* Score display */}
      <div
        className={`glass rounded-2xl p-4 text-center relative overflow-hidden transition-all duration-300 ${
          bustActive ? "glass-hot animate-bust-shake" : ""
        }`}
        data-ocid="game.score_display"
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`w-24 h-24 rounded-full blur-2xl transition-all duration-300 ${
              bustActive ? "bg-destructive/20" : "bg-primary/10"
            }`}
          />
        </div>

        <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-1 relative">
          Remaining
        </p>

        <AnimatePresence mode="wait">
          {bustActive ? (
            <motion.div
              key="bust"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              className="relative"
            >
              <p className="text-4xl font-mono font-black neon-text-pink">
                BUST!
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Score reverts...
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={score}
              initial={{ scale: 0.8, opacity: 0, y: -10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="relative"
            >
              <p
                className={`score-display font-black leading-none text-5xl ${
                  score <= 40 ? "neon-text-green" : "neon-text-cyan"
                }`}
              >
                {score}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {checkout && !bustActive && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 relative"
          >
            <p className="text-xs font-mono uppercase tracking-wide text-accent/80">
              Checkout:
            </p>
            <p className="text-sm font-mono font-bold neon-text-green">
              {checkout}
            </p>
          </motion.div>
        )}

        {needsDouble && !bustActive && score > 0 && (
          <p className="text-xs text-secondary/80 mt-1 font-mono animate-pulse-neon">
            ⚡ Needs double to finish
          </p>
        )}
      </div>

      {/* Darts remaining */}
      <div className="glass rounded-xl p-3">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-2 text-center">
          Darts
        </p>
        <div className="flex justify-center gap-3">
          {[0, 1, 2].map((i) => (
            <DartIndicator key={i} index={i} filled={i < dartsLeft} />
          ))}
        </div>
      </div>

      {/* Total darts */}
      <div className="glass rounded-xl p-3 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
          Total Darts
        </p>
        <p className="text-2xl font-mono font-bold neon-text-cyan">
          {totalDarts}
        </p>
      </div>

      {/* Recent throws */}
      <div className="glass rounded-xl p-3 flex-1 min-h-0">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-2">
          Recent Throws
        </p>
        <div className="flex flex-col gap-1 overflow-hidden">
          <AnimatePresence initial={false}>
            {recentThrows.slice(0, 6).map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex items-center justify-between px-2 py-1 rounded-md ${
                  t.bust
                    ? "bg-destructive/10 border border-destructive/20"
                    : t.score >= 50
                      ? "bg-accent/10 border border-accent/20"
                      : "bg-muted/20"
                }`}
              >
                <span
                  className={`text-xs font-mono font-semibold ${
                    t.bust
                      ? "text-destructive"
                      : t.score >= 50
                        ? "neon-text-green"
                        : t.score >= 30
                          ? "neon-text-cyan"
                          : "text-foreground/70"
                  }`}
                >
                  {t.label}
                </span>
                <span
                  className={`text-xs font-mono ${
                    t.bust ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {t.bust ? "BUST" : `+${t.score}`}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
          {recentThrows.length === 0 && (
            <p className="text-xs text-muted-foreground/40 text-center py-2 font-mono">
              Click the board to throw
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
