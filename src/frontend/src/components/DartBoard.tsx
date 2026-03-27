import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

// ─── Types ──────────────────────────────────────────────────
export interface ThrowResult {
  id: string;
  score: number;
  multiplier: number;
  segment: number;
  label: string;
  x: number;
  y: number;
}

interface Props {
  throws: ThrowResult[];
  disabled?: boolean;
  bustActive?: boolean;
  latestThrow?: ThrowResult | null;
  practiceMode?: "around-world" | "doubles" | "triples" | null;
  aroundWorldTarget?: number;
}

// ─── Board constants ─────────────────────────────────────────
const CX = 200;
const CY = 200;
export const SEGMENTS = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
];

export const R = {
  bullseye: 9,
  bull: 22,
  tripleInner: 96,
  tripleOuter: 112,
  doubleInner: 154,
  doubleOuter: 172,
  wire: 178,
  number: 190,
  outer: 196,
} as const;

const COLORS = {
  segA: "#050a14",
  segB: "#03060e",
  tripleA: "#1a7fff",
  tripleB: "#9933ff",
  doubleA: "#ff8800",
  doubleB: "#cc1133",
  bull: "#dd4400",
  wire: "#0d1530",
  wireStroke: "#1e2a50",
  numberLabel: "#ffffff",
  outerRing: "#060c1e",
  outerBorder: "#101830",
} as const;

// ─── Geometry helpers ─────────────────────────────────────────
function polar(r: number, deg: number) {
  const rad = (deg - 90) * (Math.PI / 180);
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function annularSector(
  r1: number,
  r2: number,
  startDeg: number,
  endDeg: number,
) {
  const p1 = polar(r2, startDeg);
  const p2 = polar(r2, endDeg);
  const p3 = polar(r1, endDeg);
  const p4 = polar(r1, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${r2} ${r2} 0 ${large} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${r1} ${r1} 0 ${large} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

// ─── Hit detection ────────────────────────────────────────────
function normalRandom() {
  const u1 = Math.random() || 1e-10;
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function computeScore(
  rawX: number,
  rawY: number,
  scatter = 2,
): ThrowResult {
  const hitX = rawX + normalRandom() * scatter;
  const hitY = rawY + normalRandom() * scatter;
  const dx = hitX - CX;
  const dy = hitY - CY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const dispX = Math.max(5, Math.min(395, hitX));
  const dispY = Math.max(5, Math.min(395, hitY));

  if (dist > R.wire) {
    return {
      id: crypto.randomUUID(),
      score: 0,
      multiplier: 0,
      segment: 0,
      label: "Miss",
      x: dispX,
      y: dispY,
    };
  }
  if (dist <= R.bullseye) {
    return {
      id: crypto.randomUUID(),
      score: 50,
      multiplier: 2,
      segment: 25,
      label: "BULLSEYE!",
      x: dispX,
      y: dispY,
    };
  }
  if (dist <= R.bull) {
    return {
      id: crypto.randomUUID(),
      score: 25,
      multiplier: 1,
      segment: 25,
      label: "Bull 25",
      x: dispX,
      y: dispY,
    };
  }

  const angle = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  const segIdx = Math.floor((angle + 9) / 18) % 20;
  const segNum = SEGMENTS[segIdx];

  let multiplier = 1;
  if (dist >= R.tripleInner && dist <= R.tripleOuter) multiplier = 3;
  else if (dist >= R.doubleInner && dist <= R.doubleOuter) multiplier = 2;

  const score = segNum * multiplier;
  const label =
    multiplier === 3
      ? `T${segNum}`
      : multiplier === 2
        ? `D${segNum}`
        : `${segNum}`;

  return {
    id: crypto.randomUUID(),
    score,
    multiplier,
    segment: segNum,
    label,
    x: dispX,
    y: dispY,
  };
}

interface Popup {
  id: string;
  x: number;
  y: number;
  score: number;
  label: string;
}

function GlowFilter({ id, blur }: { id: string; blur: number }) {
  return (
    <filter id={id} x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation={blur} result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
}

// ─── DartBoard Component (visual only) ───────────────────────
export default function DartBoard({
  throws,
  bustActive,
  latestThrow,
  practiceMode,
  aroundWorldTarget,
}: Props) {
  const [popups, setPopups] = useState<Popup[]>([]);
  const prevLatestRef = useRef<ThrowResult | null>(null);
  const [pulsePhase, setPulsePhase] = useState(0);

  useEffect(() => {
    if (bustActive) {
      setPopups([]);
    }
  }, [bustActive]);

  useEffect(() => {
    if (latestThrow && latestThrow !== prevLatestRef.current) {
      prevLatestRef.current = latestThrow;
      const popup: Popup = {
        id: latestThrow.id,
        x: latestThrow.x,
        y: Math.max(25, latestThrow.y - 18),
        score: latestThrow.score,
        label: latestThrow.label,
      };
      setPopups((prev) => [...prev, popup]);
      setTimeout(
        () => setPopups((prev) => prev.filter((p) => p.id !== popup.id)),
        1400,
      );
    }
  }, [latestThrow]);

  // Pulse animation for practice ring highlights
  useEffect(() => {
    if (!practiceMode || practiceMode === "around-world") return;
    let frame: number;
    let start: number | null = null;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const t = ((ts - start) % 1200) / 1200;
      setPulsePhase(t);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [practiceMode]);

  const segments = SEGMENTS.map((num, idx) => {
    const centerDeg = idx * 18;
    const startDeg = centerDeg - 9;
    const endDeg = centerDeg + 9;
    return { num, idx, startDeg, endDeg, isEven: idx % 2 === 0 };
  });

  const targetSegIdx =
    practiceMode === "around-world" && aroundWorldTarget
      ? SEGMENTS.indexOf(aroundWorldTarget)
      : -1;

  const pulseOpacity =
    practiceMode && practiceMode !== "around-world"
      ? 0.3 + Math.sin(pulsePhase * Math.PI * 2) * 0.25
      : 0;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        viewBox="0 0 400 400"
        aria-label="Dartboard"
        role="img"
        style={{ width: "100%", height: "100%", overflow: "visible" }}
      >
        <title>Dartboard</title>
        <defs>
          <GlowFilter id="glow-triple-blue" blur={2} />
          <GlowFilter id="glow-triple-purple" blur={2} />
          <GlowFilter id="glow-double-orange" blur={2} />
          <GlowFilter id="glow-double-red" blur={2} />
          <GlowFilter id="glow-bull" blur={3} />
          <GlowFilter id="glow-text" blur={1.5} />
          <GlowFilter id="glow-dart" blur={2} />
          <GlowFilter id="glow-target-seg" blur={4} />
          <radialGradient id="bull-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffaa00" stopOpacity="0.9" />
            <stop offset="40%" stopColor="#ff6600" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#cc1100" stopOpacity="0.3" />
          </radialGradient>
          <radialGradient id="board-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1a4fff" stopOpacity="0.15" />
            <stop offset="60%" stopColor="#0033cc" stopOpacity="0.05" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer frame */}
        <circle
          cx={CX}
          cy={CY}
          r={R.outer + 8}
          fill={COLORS.outerRing}
          stroke={COLORS.outerBorder}
          strokeWidth="3"
        />

        {/* Board glow */}
        <circle cx={CX} cy={CY} r={R.outer + 8} fill="url(#board-glow)" />

        {/* Segments */}
        {segments.map(({ num, idx, startDeg, endDeg, isEven }) => (
          <g key={num}>
            {practiceMode === "around-world" && targetSegIdx === idx && (
              <path
                d={annularSector(R.bull, R.doubleOuter, startDeg, endDeg)}
                fill="rgba(255,255,100,0.22)"
                filter="url(#glow-target-seg)"
              />
            )}
            <path
              d={annularSector(R.bull, R.tripleInner, startDeg, endDeg)}
              fill={isEven ? COLORS.segA : COLORS.segB}
            />
            <path
              d={annularSector(R.tripleInner, R.tripleOuter, startDeg, endDeg)}
              fill={isEven ? COLORS.tripleA : COLORS.tripleB}
              filter={
                isEven ? "url(#glow-triple-blue)" : "url(#glow-triple-purple)"
              }
            />
            <path
              d={annularSector(R.tripleOuter, R.doubleInner, startDeg, endDeg)}
              fill={isEven ? COLORS.segA : COLORS.segB}
            />
            <path
              d={annularSector(R.doubleInner, R.doubleOuter, startDeg, endDeg)}
              fill={isEven ? COLORS.doubleA : COLORS.doubleB}
              filter={
                isEven ? "url(#glow-double-orange)" : "url(#glow-double-red)"
              }
            />
            <line
              x1={polar(R.bull, startDeg).x}
              y1={polar(R.bull, startDeg).y}
              x2={polar(R.doubleOuter, startDeg).x}
              y2={polar(R.doubleOuter, startDeg).y}
              stroke={COLORS.wireStroke}
              strokeWidth="0.7"
              opacity="0.5"
            />
            <text
              x={polar(R.number, idx * 18).x}
              y={polar(R.number, idx * 18).y}
              textAnchor="middle"
              dominantBaseline="central"
              fill={
                practiceMode === "around-world" && num === aroundWorldTarget
                  ? "#ffe040"
                  : COLORS.numberLabel
              }
              fontSize="11"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="700"
              filter="url(#glow-text)"
            >
              {num}
            </text>
          </g>
        ))}

        {/* Practice mode ring overlays */}
        {practiceMode === "doubles" && (
          <>
            <circle
              cx={CX}
              cy={CY}
              r={(R.doubleInner + R.doubleOuter) / 2}
              fill="none"
              stroke="#ff8800"
              strokeWidth={R.doubleOuter - R.doubleInner}
              opacity={pulseOpacity}
            />
            <circle
              cx={CX}
              cy={CY}
              r={(R.doubleInner + R.doubleOuter) / 2}
              fill="none"
              stroke="rgba(255,180,0,0.6)"
              strokeWidth="2"
              opacity={pulseOpacity * 1.5}
            />
          </>
        )}
        {practiceMode === "triples" && (
          <>
            <circle
              cx={CX}
              cy={CY}
              r={(R.tripleInner + R.tripleOuter) / 2}
              fill="none"
              stroke="#00e8ff"
              strokeWidth={R.tripleOuter - R.tripleInner}
              opacity={pulseOpacity}
            />
            <circle
              cx={CX}
              cy={CY}
              r={(R.tripleInner + R.tripleOuter) / 2}
              fill="none"
              stroke="rgba(0,150,255,0.8)"
              strokeWidth="2"
              opacity={pulseOpacity * 1.5}
            />
          </>
        )}

        {/* Ring borders */}
        <circle
          cx={CX}
          cy={CY}
          r={R.doubleOuter}
          fill="none"
          stroke={COLORS.wireStroke}
          strokeWidth="1"
        />
        <circle
          cx={CX}
          cy={CY}
          r={R.doubleInner}
          fill="none"
          stroke={COLORS.wireStroke}
          strokeWidth="0.5"
          opacity="0.5"
        />
        <circle
          cx={CX}
          cy={CY}
          r={R.tripleOuter}
          fill="none"
          stroke={COLORS.wireStroke}
          strokeWidth="0.5"
          opacity="0.5"
        />
        <circle
          cx={CX}
          cy={CY}
          r={R.tripleInner}
          fill="none"
          stroke={COLORS.wireStroke}
          strokeWidth="0.5"
          opacity="0.5"
        />

        {/* Bull ring */}
        <circle
          cx={CX}
          cy={CY}
          r={R.bull}
          fill={COLORS.bull}
          filter="url(#glow-bull)"
        />
        <circle
          cx={CX}
          cy={CY}
          r={R.bullseye}
          fill="url(#bull-glow)"
          filter="url(#glow-bull)"
        />

        {/* Embedded darts */}
        {throws.map((t) => (
          <g key={t.id} filter="url(#glow-dart)">
            <circle
              cx={t.x}
              cy={t.y}
              r={2.5}
              fill="#c8c8c8"
              stroke="rgba(255,255,255,0.6)"
              strokeWidth="0.8"
            />
            <line
              x1={t.x}
              y1={t.y + 2}
              x2={t.x}
              y2={t.y + 16}
              stroke="#1a1a2e"
              strokeWidth="2"
            />
          </g>
        ))}

        {/* Bust overlay */}
        {bustActive && (
          <circle cx={CX} cy={CY} r={R.outer + 8} fill="rgba(180,20,20,0.15)" />
        )}

        {/* Score popups */}
        <AnimatePresence>
          {popups.map((p) => (
            <motion.text
              key={p.id}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill={
                p.score >= 50
                  ? "#00ff88"
                  : p.score >= 30
                    ? "#00e8ff"
                    : "#ffffff"
              }
              fontSize={p.score >= 50 ? "16" : "12"}
              fontFamily="JetBrains Mono, monospace"
              fontWeight="800"
              filter="url(#glow-text)"
              initial={{ opacity: 1, y: p.y }}
              animate={{ opacity: 0, y: p.y - 25 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            >
              {p.label === "BULLSEYE!" ? "💥" : "+"}
              {p.score}
            </motion.text>
          ))}
        </AnimatePresence>
      </svg>
    </div>
  );
}
