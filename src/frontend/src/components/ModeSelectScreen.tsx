import { motion } from "motion/react";
import type { DartConfig } from "../types/dart";

export type GameMode = "around-world" | "doubles" | "triples" | "game";

export default function ModeSelectScreen({
  selectedDart,
  onSelect,
  onBack,
}: {
  selectedDart: DartConfig;
  onSelect: (mode: GameMode) => void;
  onBack: () => void;
}) {
  const modes: {
    id: GameMode;
    icon: string;
    title: string;
    tag: string;
    desc: string;
    accent: string;
    ocid: string;
  }[] = [
    {
      id: "around-world",
      icon: "🌍",
      title: "AROUND THE WORLD",
      tag: "Practice",
      desc: "Hit 1 through 20 in order · Unlimited darts",
      accent: "rgba(0,232,255,0.3)",
      ocid: "mode_select.primary_button",
    },
    {
      id: "doubles",
      icon: "🎯",
      title: "DOUBLES",
      tag: "Practice",
      desc: "Practice the double ring · Double ring highlighted",
      accent: "rgba(255,150,0,0.3)",
      ocid: "mode_select.secondary_button",
    },
    {
      id: "triples",
      icon: "⚡",
      title: "TRIPLES",
      tag: "Practice",
      desc: "Practice the triple ring · Triple ring highlighted",
      accent: "rgba(0,150,255,0.3)",
      ocid: "mode_select.toggle",
    },
    {
      id: "game",
      icon: "🏆",
      title: "301 GAME",
      tag: "Compete",
      desc: "Start at 301 · Double to finish · Bust detection",
      accent: `${selectedDart.color}55`,
      ocid: "mode_select.submit_button",
    },
  ];

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0,80,180,0.3) 0%, transparent 70%), linear-gradient(180deg, #030812 0%, #050d20 100%)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm flex flex-col items-center gap-5"
      >
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono"
          style={{
            background: `${selectedDart.color}18`,
            border: `1px solid ${selectedDart.color}55`,
            color: selectedDart.color,
          }}
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: selectedDart.color }}
          />
          {selectedDart.name} selected
        </div>

        <div className="text-center">
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/30 mb-2">
            Choose Mode
          </p>
          <h1
            className="text-3xl font-display font-black"
            style={{
              color: "#fff",
              textShadow: `0 0 20px ${selectedDart.color}88, 0 0 40px ${selectedDart.color}44`,
            }}
          >
            READY TO THROW?
          </h1>
        </div>

        <div className="w-full flex flex-col gap-2">
          {modes.map((m) => (
            <motion.button
              key={m.id}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect(m.id)}
              className="w-full rounded-2xl p-4 text-left transition-all cursor-pointer"
              style={{
                background:
                  m.id === "game"
                    ? "linear-gradient(135deg, #1a0a20, #0c0618)"
                    : "linear-gradient(135deg, #0a1a2c, #061018)",
                border: `1.5px solid ${m.accent}`,
                boxShadow: `0 0 16px ${m.accent.replace("0.3", "0.08")}`,
              }}
              data-ocid={m.ocid}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-base font-display font-bold text-white">
                  {m.icon} {m.title}
                </span>
                <span className="text-[9px] font-mono text-white/30 uppercase tracking-wider">
                  {m.tag}
                </span>
              </div>
              <p className="text-xs text-white/40 font-mono">{m.desc}</p>
            </motion.button>
          ))}
        </div>

        <button
          type="button"
          onClick={onBack}
          className="text-white/30 text-xs font-mono hover:text-white/60 transition-colors"
          data-ocid="mode_select.cancel_button"
        >
          ← Back to dart selection
        </button>
      </motion.div>
    </div>
  );
}
