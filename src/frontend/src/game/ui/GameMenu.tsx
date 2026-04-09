import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { GameModeType } from "../core/GameModes";

const MENU_STYLES = `
  @keyframes neonGlow {
    0%, 100% { text-shadow: 0 0 20px #00ddff, 0 0 60px #00ddff, 0 0 100px #0088ff; }
    50% { text-shadow: 0 0 10px #00ddff, 0 0 25px #00ddff; }
  }
  @keyframes neonPulse {
    0%, 100% {
      box-shadow: 0 0 30px rgba(0,170,255,0.5), 0 4px 20px rgba(0,0,0,0.4), 0 0 60px rgba(0,170,255,0.3);
    }
    50% {
      box-shadow: 0 0 16px rgba(0,170,255,0.3), 0 4px 20px rgba(0,0,0,0.4), 0 0 30px rgba(0,170,255,0.15);
    }
  }
  .neon-title {
    animation: neonGlow 2s ease-in-out infinite;
  }
  .play-button {
    animation: neonPulse 1.5s ease-in-out infinite;
  }
`;

interface GameMenuProps {
  onStart: (mode: GameModeType) => void;
}

const MODES: {
  id: GameModeType;
  label: string;
  desc: string;
  color: string;
}[] = [
  {
    id: "301",
    label: "301",
    desc: "Score down from 301 to zero",
    color: "#00ddff",
  },
  {
    id: "around_world",
    label: "Around World",
    desc: "Hit 1 through 20 in order",
    color: "#ff0088",
  },
  {
    id: "doubles",
    label: "Doubles",
    desc: "Hit all doubles D1→D20",
    color: "#ffaa00",
  },
  {
    id: "triples",
    label: "Triples",
    desc: "Hit all triples T1→T20",
    color: "#00ff88",
  },
];

export default function GameMenu({ onStart }: GameMenuProps) {
  const [selected, setSelected] = useState<GameModeType>("301");
  const [hoveredMode, setHoveredMode] = useState<GameModeType | null>(null);
  const styleInjected = useRef(false);

  useEffect(() => {
    if (styleInjected.current) return;
    styleInjected.current = true;
    const style = document.createElement("style");
    style.textContent = MENU_STYLES;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,10,0.78)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        fontFamily: "'Bricolage Grotesque', 'JetBrains Mono', monospace",
        padding: "20px 16px",
        gap: 0,
      }}
    >
      {/* Title */}
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        style={{ textAlign: "center", marginBottom: 32 }}
      >
        <div
          className="neon-title"
          style={{
            fontSize: 54,
            fontWeight: 800,
            letterSpacing: -1,
            background: "linear-gradient(135deg, #00ddff, #ff0088)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            lineHeight: 1,
            marginBottom: 8,
          }}
        >
          NEON DARTS
        </div>
        <div
          style={{
            color: "#6666aa",
            fontSize: 13,
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          3D Cyberpunk Arena
        </div>
      </motion.div>

      {/* Mode selector */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          width: "100%",
          maxWidth: 320,
          marginBottom: 24,
        }}
      >
        {MODES.map((m) => {
          const isSelected = selected === m.id;
          const isHovered = hoveredMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              data-ocid={`menu.${m.id}.button`}
              onClick={() => setSelected(m.id)}
              onMouseEnter={() => setHoveredMode(m.id)}
              onMouseLeave={() => setHoveredMode(null)}
              style={{
                background: isSelected
                  ? `rgba(${m.id === "301" ? "0,220,255" : m.id === "around_world" ? "255,0,136" : m.id === "doubles" ? "255,170,0" : "0,255,136"},0.18)`
                  : isHovered
                    ? `rgba(${m.id === "301" ? "0,220,255" : m.id === "around_world" ? "255,0,136" : m.id === "doubles" ? "255,170,0" : "0,255,136"},0.08)`
                    : "rgba(10,10,30,0.6)",
                border: `1.5px solid ${
                  isSelected
                    ? m.color
                    : isHovered
                      ? `${m.color}88`
                      : "rgba(80,80,120,0.5)"
                }`,
                borderRadius: 12,
                padding: "12px 18px",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                transition: "all 0.18s ease",
                boxShadow: isSelected
                  ? `0 0 24px ${m.color}66`
                  : isHovered
                    ? `0 0 16px ${m.color}33`
                    : "none",
              }}
            >
              <div>
                <div
                  style={{
                    color: isSelected
                      ? m.color
                      : isHovered
                        ? `${m.color}cc`
                        : "#ccccee",
                    fontSize: 16,
                    fontWeight: 700,
                    transition: "color 0.18s",
                  }}
                >
                  {m.label}
                </div>
                <div style={{ color: "#666688", fontSize: 12 }}>{m.desc}</div>
              </div>
              {isSelected && (
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: m.color,
                    boxShadow: `0 0 10px ${m.color}, 0 0 20px ${m.color}`,
                  }}
                />
              )}
            </button>
          );
        })}
      </motion.div>

      {/* Start button */}
      <motion.button
        type="button"
        className="play-button"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.35 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        data-ocid="menu.start.button"
        onClick={() => onStart(selected)}
        style={{
          background: "linear-gradient(135deg, #00bbdd, #0044ff)",
          border: "none",
          borderRadius: 14,
          padding: "14px 48px",
          color: "white",
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: 2,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        PLAY
      </motion.button>

      {/* Bottom hint */}
      <div
        style={{
          marginTop: 20,
          color: "#444466",
          fontSize: 12,
          textAlign: "center",
          letterSpacing: 1,
        }}
      >
        Touch &amp; swipe to throw
      </div>
    </motion.div>
  );
}
