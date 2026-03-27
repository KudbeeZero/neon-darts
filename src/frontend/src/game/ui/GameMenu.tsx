import { motion } from "motion/react";
import { useState } from "react";
import type { GameModeType } from "../core/GameModes";

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
    color: "#ff6600",
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
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            data-ocid={`menu.${m.id}.button`}
            onClick={() => setSelected(m.id)}
            style={{
              background:
                selected === m.id
                  ? `rgba(${m.id === "301" ? "0,220,255" : m.id === "around_world" ? "255,0,136" : m.id === "doubles" ? "255,100,0" : "0,255,136"},0.18)`
                  : "rgba(10,10,30,0.6)",
              border: `1.5px solid ${
                selected === m.id ? m.color : "rgba(80,80,120,0.5)"
              }`,
              borderRadius: 12,
              padding: "12px 18px",
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              transition: "all 0.18s ease",
              boxShadow: selected === m.id ? `0 0 16px ${m.color}44` : "none",
            }}
          >
            <div>
              <div
                style={{
                  color: selected === m.id ? m.color : "#ccccee",
                  fontSize: 16,
                  fontWeight: 700,
                  transition: "color 0.18s",
                }}
              >
                {m.label}
              </div>
              <div style={{ color: "#666688", fontSize: 12 }}>{m.desc}</div>
            </div>
            {selected === m.id && (
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: m.color,
                  boxShadow: `0 0 8px ${m.color}`,
                }}
              />
            )}
          </button>
        ))}
      </motion.div>

      {/* Start button */}
      <motion.button
        type="button"
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
          boxShadow: "0 0 30px rgba(0,170,255,0.5), 0 4px 20px rgba(0,0,0,0.4)",
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
