import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

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
  onThrow: (result: ThrowResult) => void;
  throws: ThrowResult[];
  disabled?: boolean;
  bustActive?: boolean;
}

// ─── Board constants ─────────────────────────────────────────
const CX = 200;
const CY = 200;
const SEGMENTS = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
];

const R = {
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
  segA: "#0c0c18",
  segB: "#080810",
  tripleA: "#00c8c0",
  tripleB: "#c03090",
  doubleA: "#00b848",
  doubleB: "#b82818",
  bull: "#b84010",
  bullseye2: "#e83030",
  wire: "#1a1a30",
  wireStroke: "#303060",
  numberLabel: "#8ab0cc",
  outerRing: "#0a0a18",
  outerBorder: "#1e1e3a",
} as const;

// ─── Drag constants ───────────────────────────────────────────
const MAX_DRAG = 85;

// ─── Geometry helpers ────────────────────────────────────────
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

// ─── Hit detection ───────────────────────────────────────────
function normalRandom() {
  const u1 = Math.random() || 1e-10;
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function computeScore(rawX: number, rawY: number, scatter = 2): ThrowResult {
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
}

// ─── DartBoard Component ──────────────────────────────────────
export default function DartBoard({
  onThrow,
  throws,
  disabled,
  bustActive,
}: Props) {
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [dragCurrent, setDragCurrent] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [popups, setPopups] = useState<Popup[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (bustActive) {
      setPopups([]);
    }
  }, [bustActive]);

  const getSvgCoords = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (400 / rect.width),
      y: (clientY - rect.top) * (400 / rect.height),
    };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (disabled || bustActive) return;
      const pos = getSvgCoords(e.clientX, e.clientY);
      if (!pos) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragStart(pos);
      setDragCurrent(pos);
      setIsDragging(true);
    },
    [disabled, bustActive, getSvgCoords],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!isDragging) return;
      const pos = getSvgCoords(e.clientX, e.clientY);
      if (pos) setDragCurrent(pos);
    },
    [isDragging, getSvgCoords],
  );

  const handlePointerUp = useCallback(
    (_e: React.PointerEvent<SVGSVGElement>) => {
      if (!isDragging || !dragStart || !dragCurrent) {
        setIsDragging(false);
        setDragStart(null);
        setDragCurrent(null);
        return;
      }

      // Raw delta: reversed for throw direction
      let rawDx = dragStart.x - dragCurrent.x;
      let rawDy = dragStart.y - dragCurrent.y;

      // Clamp magnitude
      const mag = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
      const clampedMag = Math.min(mag, MAX_DRAG);
      if (mag > 0) {
        rawDx = (rawDx / mag) * clampedMag;
        rawDy = (rawDy / mag) * clampedMag;
      }

      // Aim assist: 8% nudge toward board center
      const assistDx = (CX - dragStart.x) * 0.08;
      const assistDy = (CY - dragStart.y) * 0.08;
      rawDx += assistDx;
      rawDy += assistDy;

      const power = clampedMag / MAX_DRAG;
      const scatter = power > 0.75 ? 2 + (14 - 2) * ((power - 0.75) / 0.25) : 2;

      // Map drag to board hit position
      const hitX = CX + rawDx * (R.wire / MAX_DRAG) * 0.95;
      const hitY = CY + rawDy * (R.wire / MAX_DRAG) * 0.95;

      const result = computeScore(hitX, hitY, scatter);
      onThrow(result);

      const popup: Popup = {
        id: result.id,
        x: result.x,
        y: Math.max(30, result.y - 15),
        score: result.score,
      };
      setPopups((prev) => [...prev, popup]);
      setTimeout(
        () => setPopups((prev) => prev.filter((p) => p.id !== popup.id)),
        1400,
      );

      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
    },
    [isDragging, dragStart, dragCurrent, onThrow],
  );

  // Compute aim line data
  let aimLineEnd: { x: number; y: number } | null = null;
  let power = 0;
  if (isDragging && dragStart && dragCurrent) {
    let rawDx = dragStart.x - dragCurrent.x;
    let rawDy = dragStart.y - dragCurrent.y;
    const mag = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
    const clampedMag = Math.min(mag, MAX_DRAG);
    power = clampedMag / MAX_DRAG;
    if (mag > 0) {
      rawDx = rawDx / mag;
      rawDy = rawDy / mag;
    }
    aimLineEnd = {
      x: dragStart.x + rawDx * 70,
      y: dragStart.y + rawDy * 70,
    };
  }

  const segments = SEGMENTS.map((num, idx) => {
    const startDeg = idx * 18 - 9;
    const endDeg = startDeg + 18;
    const isEven = idx % 2 === 0;
    return {
      num,
      idx,
      startDeg,
      endDeg,
      isEven,
      singleInner: annularSector(R.bull, R.tripleInner, startDeg, endDeg),
      triple: annularSector(R.tripleInner, R.tripleOuter, startDeg, endDeg),
      singleOuter: annularSector(
        R.tripleOuter,
        R.doubleInner,
        startDeg,
        endDeg,
      ),
      double: annularSector(R.doubleInner, R.doubleOuter, startDeg, endDeg),
      numberPos: polar(R.number, idx * 18),
    };
  });

  const dartColors = ["#00e8ff", "#ff40b0", "#40ff80"];

  return (
    <div className="relative w-full h-full">
      <svg
        ref={svgRef}
        viewBox="0 0 400 400"
        role="img"
        aria-label="Neon dartboard — drag to throw"
        className={`w-full h-full select-none ${
          disabled || bustActive ? "opacity-60" : "cursor-crosshair"
        }`}
        style={{ touchAction: "none", userSelect: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <title>Neon Dartboard</title>
        <defs>
          <filter
            id="glow-triple-cyan"
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b2" />
            <feMerge>
              <feMergeNode in="b2" />
              <feMergeNode in="b1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter
            id="glow-triple-pink"
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="0.8 0.1 0.4 0 0  0.1 0 0.3 0 0  0.4 0.1 0.8 0 0  0 0 0 1 0"
              result="tinted"
            />
            <feGaussianBlur in="tinted" stdDeviation="4" result="b1" />
            <feGaussianBlur in="tinted" stdDeviation="8" result="b2" />
            <feMerge>
              <feMergeNode in="b2" />
              <feMergeNode in="b1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter
            id="glow-double-green"
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b2" />
            <feMerge>
              <feMergeNode in="b2" />
              <feMergeNode in="b1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-bull" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="b2" />
            <feMerge>
              <feMergeNode in="b2" />
              <feMergeNode in="b1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-dart" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-text" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-aim" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="boardAmbient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1a1a40" stopOpacity="0" />
            <stop offset="100%" stopColor="#000010" stopOpacity="0.7" />
          </radialGradient>
        </defs>

        {/* Outer bezel */}
        <circle cx={CX} cy={CY} r={R.outer} fill={COLORS.outerBorder} />
        <circle cx={CX} cy={CY} r={R.wire} fill={COLORS.outerRing} />

        {/* Singles */}
        {segments.map(({ idx, isEven, singleInner, singleOuter }) => (
          <g key={`s${idx}`}>
            <path
              d={singleInner}
              fill={isEven ? COLORS.segA : COLORS.segB}
              stroke={COLORS.wire}
              strokeWidth="0.3"
            />
            <path
              d={singleOuter}
              fill={isEven ? COLORS.segA : COLORS.segB}
              stroke={COLORS.wire}
              strokeWidth="0.3"
            />
          </g>
        ))}

        {/* Triples */}
        {segments.map(({ idx, isEven, triple }) => (
          <path
            key={`t${idx}`}
            d={triple}
            fill={isEven ? COLORS.tripleA : COLORS.tripleB}
            stroke={COLORS.wire}
            strokeWidth="0.4"
            filter={
              isEven ? "url(#glow-triple-cyan)" : "url(#glow-triple-pink)"
            }
          />
        ))}

        {/* Doubles */}
        {segments.map(({ idx, isEven, double: dbl }) => (
          <path
            key={`d${idx}`}
            d={dbl}
            fill={isEven ? COLORS.doubleA : COLORS.doubleB}
            stroke={COLORS.wire}
            strokeWidth="0.4"
            filter="url(#glow-double-green)"
          />
        ))}

        {/* Vignette */}
        <circle
          cx={CX}
          cy={CY}
          r={R.wire}
          fill="url(#boardAmbient)"
          pointerEvents="none"
        />

        {/* Wire dividers */}
        {segments.map(({ idx, startDeg }) => {
          const inner = polar(R.bull, startDeg);
          const outer = polar(R.doubleOuter, startDeg);
          return (
            <line
              key={`w${idx}`}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={COLORS.wireStroke}
              strokeWidth="0.8"
              opacity="0.6"
            />
          );
        })}

        {/* Bull (25) */}
        <circle
          cx={CX}
          cy={CY}
          r={R.bull}
          fill={COLORS.bull}
          filter="url(#glow-bull)"
        />

        {/* Bullseye (50) */}
        <circle
          cx={CX}
          cy={CY}
          r={R.bullseye}
          fill={COLORS.bullseye2}
          filter="url(#glow-bull)"
        />
        <circle
          cx={CX}
          cy={CY}
          r={R.bullseye * 0.55}
          fill="#ff6060"
          filter="url(#glow-bull)"
        />

        {/* Ring outlines */}
        {[
          R.bull,
          R.tripleInner,
          R.tripleOuter,
          R.doubleInner,
          R.doubleOuter,
          R.wire,
        ].map((r) => (
          <circle
            key={r}
            cx={CX}
            cy={CY}
            r={r}
            fill="none"
            stroke={COLORS.wireStroke}
            strokeWidth={r === R.wire ? 1.5 : 0.8}
            opacity="0.7"
          />
        ))}

        {/* Number labels */}
        {segments.map(({ num, idx, numberPos }) => (
          <text
            key={`n${idx}`}
            x={numberPos.x}
            y={numberPos.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="13"
            fontWeight="700"
            fontFamily="JetBrains Mono, monospace"
            fill={COLORS.numberLabel}
            filter="url(#glow-text)"
            style={{ userSelect: "none" }}
          >
            {num}
          </text>
        ))}

        {/* Dart markers */}
        {throws.map((t, idx) => (
          <g key={t.id} style={{ animation: "dart-fly 0.3s ease-out" }}>
            <circle
              cx={t.x}
              cy={t.y}
              r={5}
              fill="none"
              stroke={dartColors[idx % 3]}
              strokeWidth="1.5"
              opacity="0.8"
              filter="url(#glow-dart)"
            />
            <circle
              cx={t.x}
              cy={t.y}
              r={2.5}
              fill={dartColors[idx % 3]}
              filter="url(#glow-dart)"
            />
            <line
              x1={t.x}
              y1={t.y + 2}
              x2={t.x}
              y2={t.y + 10}
              stroke={dartColors[idx % 3]}
              strokeWidth="1"
              opacity="0.6"
            />
          </g>
        ))}

        {/* Aim line */}
        {isDragging && dragStart && aimLineEnd && (
          <g style={{ pointerEvents: "none" }} filter="url(#glow-aim)">
            <line
              x1={dragStart.x}
              y1={dragStart.y}
              x2={aimLineEnd.x}
              y2={aimLineEnd.y}
              stroke="#00e8ff"
              strokeWidth="1.5"
              strokeDasharray="6 4"
              opacity="0.85"
            />
            <circle
              cx={dragStart.x}
              cy={dragStart.y}
              r={5}
              fill="#00e8ff"
              opacity="0.9"
            />
            <circle
              cx={aimLineEnd.x}
              cy={aimLineEnd.y}
              r={3}
              fill="none"
              stroke="#00e8ff"
              strokeWidth="1.5"
              opacity="0.6"
            />
          </g>
        )}

        {/* Score popups */}
        <AnimatePresence>
          {popups.map((p) => (
            <motion.text
              key={p.id}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              fontSize={p.score >= 50 ? "16" : p.score >= 30 ? "14" : "12"}
              fontWeight="700"
              fontFamily="JetBrains Mono, monospace"
              fill={
                p.score === 0
                  ? "#ff6060"
                  : p.score >= 50
                    ? "#ffe040"
                    : p.score >= 30
                      ? "#00e8ff"
                      : "#80e0ff"
              }
              filter="url(#glow-dart)"
              initial={{ opacity: 1, y: p.y }}
              animate={{ opacity: 0, y: p.y - 35 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {p.score > 0 ? `+${p.score}` : "MISS"}
            </motion.text>
          ))}
        </AnimatePresence>
      </svg>

      {/* Power indicator */}
      {isDragging && (
        <div
          className="absolute bottom-0 left-0 right-0 px-3 pb-2 pt-1"
          style={{ pointerEvents: "none" }}
        >
          <p className="text-[9px] font-mono text-cyan-400/70 uppercase tracking-widest mb-1">
            POWER
          </p>
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${power * 100}%`,
                background: "linear-gradient(90deg, #00e8ff, #ff40b0)",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
