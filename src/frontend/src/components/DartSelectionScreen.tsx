import { Canvas, useFrame } from "@react-three/fiber";
import { motion } from "motion/react";
import { useRef } from "react";
import { DART_CONFIGS, type DartConfig } from "../types/dart";
import DartMesh from "./DartMesh";

function RotatingDart({ dartConfig }: { dartConfig: DartConfig }) {
  const groupRef = useRef<import("three").Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.8;
    groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.4) * 0.2;
  });
  return (
    <group ref={groupRef}>
      <DartMesh
        color={dartConfig.color}
        barrelRadius={dartConfig.barrelRadius}
        flightSize={dartConfig.flightSize}
      />
    </group>
  );
}

function StatBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="mb-2">
      <div className="flex justify-between mb-1">
        <span className="text-[10px] font-mono uppercase tracking-widest text-white/50">
          {label}
        </span>
        <span className="text-[10px] font-mono text-white/70">{pct}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
    </div>
  );
}

function DartCard({
  dart,
  selected,
  onSelect,
}: {
  dart: DartConfig;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      onClick={onSelect}
      className="relative flex flex-col rounded-2xl overflow-hidden cursor-pointer select-none"
      style={{
        background: selected
          ? `linear-gradient(145deg, ${dart.color}22, #0a0f2c88)`
          : "linear-gradient(145deg, #0a0f2ccc, #04081888)",
        border: `1.5px solid ${selected ? dart.color : "rgba(255,255,255,0.1)"}`,
        boxShadow: selected
          ? `0 0 20px ${dart.color}55, 0 0 40px ${dart.color}22`
          : "none",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* 3D dart preview */}
      <div className="w-full" style={{ height: 140 }}>
        <Canvas
          camera={{ position: [0, 0, 3], fov: 50 }}
          gl={{ alpha: true, antialias: true }}
          style={{ background: "transparent" }}
        >
          <ambientLight intensity={0.6} />
          <pointLight position={[2, 2, 3]} intensity={2} color={dart.color} />
          <pointLight position={[-2, -1, 2]} intensity={1} color="#ffffff" />
          <RotatingDart dartConfig={dart} />
        </Canvas>
      </div>

      <div className="p-3 flex-1 flex flex-col">
        {/* Dart name badge */}
        <div className="mb-2 text-center">
          <span
            className="inline-block px-3 py-0.5 rounded-full text-xs font-mono font-bold tracking-widest"
            style={{
              background: `${dart.color}22`,
              border: `1px solid ${dart.color}66`,
              color: dart.color,
            }}
          >
            {dart.name}
          </span>
        </div>
        <p className="text-[10px] text-white/40 text-center font-mono mb-3">
          {dart.tagline}
        </p>

        <div className="flex-1">
          <StatBar label="Speed" value={dart.speed} max={18} color="#00e8ff" />
          <StatBar
            label="Stability"
            value={dart.stability}
            max={100}
            color="#40ff80"
          />
          <StatBar
            label="Weight"
            value={dart.weight}
            max={28}
            color="#ff8800"
          />
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className="mt-3 w-full py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-widest transition-all"
          style={{
            background: selected ? dart.color : `${dart.color}22`,
            color: selected ? "#000" : dart.color,
            border: `1px solid ${dart.color}`,
          }}
          data-ocid="dart_select.primary_button"
        >
          {selected ? "✓ Selected" : "Select"}
        </button>
      </div>
    </motion.div>
  );
}

export default function DartSelectionScreen({
  onSelect,
}: {
  onSelect: (dart: DartConfig) => void;
}) {
  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-start overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0,100,200,0.25) 0%, transparent 70%), linear-gradient(180deg, #030812 0%, #050d20 100%)",
      }}
    >
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="pt-12 pb-6 text-center px-4"
      >
        <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/30 mb-2">
          Neon Darts
        </p>
        <h1
          className="text-4xl font-display font-black tracking-tight"
          style={{
            color: "#fff",
            textShadow: "0 0 20px #00e8ff88, 0 0 40px #00e8ff44",
          }}
        >
          SELECT YOUR DART
        </h1>
        <p className="text-white/30 text-xs font-mono mt-2">
          Each dart flies differently — choose wisely
        </p>
      </motion.div>

      {/* Cards */}
      <div className="w-full max-w-3xl px-4 pb-8 grid grid-cols-3 gap-3">
        {DART_CONFIGS.map((dart) => (
          <DartCard
            key={dart.id}
            dart={dart}
            selected={false}
            onSelect={() => onSelect(dart)}
          />
        ))}
      </div>

      {/* Footer */}
      <footer className="absolute bottom-0 left-0 right-0 text-center py-2 text-[10px] text-white/20 font-mono">
        © {new Date().getFullYear()} Built with love using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/40 hover:text-white/60 transition-colors"
        >
          caffeine.ai
        </a>
      </footer>
    </div>
  );
}
