import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import type { ModeState } from "../core/GameModes";
import type { ZoneResult } from "../core/ScoringGrid";

interface HUDProps {
  modeState: ModeState;
  dartsLeft: number;
  lastZone: ZoneResult | null;
  showPopup: boolean;
}

function DartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      role="img"
      aria-label="dart"
    >
      <line
        x1="2"
        y1="9"
        x2="14"
        y2="9"
        stroke={filled ? "#00ddff" : "#334"}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <polygon points="14,6 18,9 14,12" fill={filled ? "#00ddff" : "#334"} />
      <rect
        x="0"
        y="7"
        width="4"
        height="4"
        rx="0.5"
        fill={filled ? "#ff0088" : "#223"}
      />
    </svg>
  );
}

export default function HUD({
  modeState,
  dartsLeft,
  lastZone,
  showPopup,
}: HUDProps) {
  const popupKey = useRef(0);
  useEffect(() => {
    if (showPopup) popupKey.current++;
  }, [showPopup]);

  const isMode301 = modeState.type === "301";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 20,
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      }}
    >
      {/* Score / remaining — top left */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          background: "rgba(0,0,20,0.65)",
          border: "1px solid rgba(0,200,255,0.3)",
          borderRadius: 12,
          padding: "10px 16px",
          minWidth: 100,
        }}
      >
        <div
          style={{
            color: "#00ddff",
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
            opacity: 0.7,
          }}
        >
          {isMode301 ? "Remaining" : modeState.type.replace("_", " ")}
        </div>
        <div
          style={{
            color: "#ffffff",
            fontSize: isMode301 ? 38 : 26,
            fontWeight: 700,
            lineHeight: 1.1,
            textShadow: "0 0 12px #00ddff",
          }}
        >
          {isMode301 ? modeState.score : modeState.targetLabel}
        </div>
        {!isMode301 && (
          <div style={{ color: "#aaaacc", fontSize: 11, marginTop: 2 }}>
            {modeState.score}/20 hit
          </div>
        )}
      </div>

      {/* Darts left — top right */}
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          background: "rgba(0,0,20,0.65)",
          border: "1px solid rgba(0,200,255,0.3)",
          borderRadius: 12,
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        <div
          style={{
            color: "#00ddff",
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            opacity: 0.7,
          }}
        >
          Darts
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          {[0, 1, 2].map((i) => (
            <DartIcon key={i} filled={i < dartsLeft} />
          ))}
        </div>
      </div>

      {/* Mode message — bottom center */}
      <div
        style={{
          position: "absolute",
          bottom: 28,
          left: "50%",
          transform: "translateX(-50%)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          background: "rgba(0,0,20,0.55)",
          border: "1px solid rgba(100,100,255,0.3)",
          borderRadius: 20,
          padding: "8px 20px",
          color: "#aaaadd",
          fontSize: 13,
          letterSpacing: 1,
          whiteSpace: "nowrap",
          textAlign: "center",
        }}
      >
        {modeState.message || "Swipe to throw"}
      </div>

      {/* Score popup — centre screen */}
      <AnimatePresence>
        {showPopup && lastZone && (
          <motion.div
            key={popupKey.current}
            initial={{ opacity: 0, scale: 0.4, y: 0 }}
            animate={{ opacity: 1, scale: 1.2, y: -20 }}
            exit={{ opacity: 0, scale: 0.8, y: -80 }}
            transition={{ duration: 0.25 }}
            style={{
              position: "absolute",
              top: "42%",
              left: "50%",
              transform: "translateX(-50%)",
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                fontSize: 52,
                fontWeight: 900,
                color:
                  lastZone.ring === "bullseye"
                    ? "#ff2200"
                    : lastZone.ring === "triple"
                      ? "#00ccff"
                      : lastZone.ring === "double"
                        ? "#ff4400"
                        : "#ffffff",
                textShadow:
                  lastZone.ring === "triple"
                    ? "0 0 20px #00ccff, 0 0 40px #00ccff"
                    : lastZone.ring === "double"
                      ? "0 0 20px #ff4400"
                      : "0 0 16px rgba(255,255,255,0.8)",
                letterSpacing: -1,
              }}
            >
              {lastZone.label}
            </div>
            {lastZone.score > 0 && (
              <div
                style={{
                  fontSize: 22,
                  color: "#aaddff",
                  marginTop: -8,
                  textShadow: "0 0 10px #4488ff",
                }}
              >
                +{lastZone.score}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
