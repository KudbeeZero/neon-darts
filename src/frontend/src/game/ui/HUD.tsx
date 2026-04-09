import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import type { ModeState } from "../core/GameModes";
import type { ZoneResult } from "../core/ScoringGrid";

const HUD_STYLES = `
  @keyframes borderPulse {
    0%, 100% { border-color: rgba(0,200,255,0.7); box-shadow: 0 0 12px rgba(0,200,255,0.3); }
    50% { border-color: rgba(0,200,255,0.3); box-shadow: 0 0 4px rgba(0,200,255,0.1); }
  }
  @keyframes targetPulse {
    0%, 100% { border-color: rgba(255,170,0,0.8); box-shadow: 0 0 16px rgba(255,170,0,0.4); }
    50% { border-color: rgba(255,170,0,0.4); box-shadow: 0 0 6px rgba(255,170,0,0.15); }
  }
  .hud-aiming-pill {
    animation: borderPulse 1.4s ease-in-out infinite;
  }
  .hud-target-badge {
    animation: targetPulse 1.2s ease-in-out infinite;
  }
`;

interface HUDProps {
  modeState: ModeState;
  dartsLeft: number;
  lastZone: ZoneResult | null;
  showPopup: boolean;
  isAiming: boolean;
}

function DartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="20"
      height="20"
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
        stroke={filled ? "#00eeff" : "#334"}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <polygon
        points="14,6 18,9 14,12"
        fill={filled ? "#00eeff" : "#334"}
        style={filled ? { filter: "drop-shadow(0 0 4px #00eeff)" } : {}}
      />
      <rect
        x="0"
        y="7"
        width="4"
        height="4"
        rx="0.5"
        fill={filled ? "#ff0088" : "#223"}
        style={filled ? { filter: "drop-shadow(0 0 4px #ff0088)" } : {}}
      />
    </svg>
  );
}

export default function HUD({
  modeState,
  dartsLeft,
  lastZone,
  showPopup,
  isAiming,
}: HUDProps) {
  const popupKey = useRef(0);
  useEffect(() => {
    if (showPopup) popupKey.current++;
  }, [showPopup]);

  const isMode301 = modeState.type === "301";
  const isPractice = !isMode301;

  // For practice modes, show current target prominently
  const targetDisplay = isPractice ? modeState.targetLabel : null;

  return (
    <>
      <style>{HUD_STYLES}</style>
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
            border: "1px solid rgba(0,220,255,0.5)",
            borderRadius: 12,
            padding: "10px 16px",
            minWidth: 100,
            boxShadow: "0 0 20px rgba(0,200,255,0.15)",
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
              color: modeState.isBust ? "#ff4400" : "#ffffff",
              fontSize: isMode301 ? 38 : 26,
              fontWeight: 700,
              lineHeight: 1.1,
              textShadow: modeState.isBust
                ? "0 0 16px #ff4400"
                : "0 0 16px #00ddff, 0 0 32px #00aaff",
            }}
          >
            {isMode301 ? modeState.score : modeState.targetLabel}
          </div>
          {isMode301 && (
            <div style={{ color: "#666688", fontSize: 11, marginTop: 2 }}>
              Round {modeState.round}
            </div>
          )}
          {isPractice && (
            <div style={{ color: "#aaaacc", fontSize: 11, marginTop: 2 }}>
              {modeState.score}/20 hit
            </div>
          )}
        </div>

        {/* Target badge — practice modes only, below score panel */}
        {isPractice && targetDisplay && modeState.target <= 20 && (
          <div
            className="hud-target-badge"
            style={{
              position: "absolute",
              top: 120,
              left: 16,
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              background: "rgba(0,0,20,0.7)",
              border: "1px solid rgba(255,170,0,0.8)",
              borderRadius: 10,
              padding: "6px 14px",
              color: "#ffaa00",
              fontSize: 20,
              fontWeight: 900,
              textShadow: "0 0 12px #ffaa00",
              letterSpacing: 1,
            }}
          >
            🎯 {targetDisplay}
          </div>
        )}

        {/* Darts left — top right */}
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            background: "rgba(0,0,20,0.65)",
            border: "1px solid rgba(0,220,255,0.5)",
            borderRadius: 12,
            padding: "10px 14px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            boxShadow: "0 0 20px rgba(0,200,255,0.15)",
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
          className={isAiming ? "hud-aiming-pill" : ""}
          style={{
            position: "absolute",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            background: "rgba(0,0,20,0.55)",
            border: isAiming
              ? "1px solid rgba(0,200,255,0.7)"
              : "1px solid rgba(100,100,255,0.3)",
            borderRadius: 20,
            padding: "8px 20px",
            color: isAiming ? "#ccf0ff" : "#aaaadd",
            fontSize: 13,
            letterSpacing: 1,
            whiteSpace: "nowrap",
            textAlign: "center",
            transition: "border-color 0.3s, color 0.3s",
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
                  fontSize: 72,
                  fontWeight: 900,
                  color:
                    lastZone.ring === "bullseye"
                      ? "#ff2200"
                      : lastZone.ring === "triple"
                        ? "#00eeff"
                        : lastZone.ring === "double"
                          ? "#ffaa00"
                          : "#ffffff",
                  textShadow:
                    lastZone.ring === "triple"
                      ? "0 0 30px #00eeff, 0 0 60px #00eeff, 0 0 90px #00eeff"
                      : lastZone.ring === "double"
                        ? "0 0 30px #ffaa00, 0 0 60px #ffaa00"
                        : lastZone.ring === "bullseye"
                          ? "0 0 30px #ff2200, 0 0 60px #ff4400"
                          : "0 0 20px rgba(255,255,255,0.8)",
                  letterSpacing: -1,
                }}
              >
                {lastZone.label}
              </div>
              {lastZone.score > 0 && (
                <div
                  style={{
                    fontSize: 24,
                    color: "#aaddff",
                    marginTop: -8,
                    textShadow: "0 0 14px #4488ff, 0 0 28px #4488ff",
                  }}
                >
                  +{lastZone.score}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
