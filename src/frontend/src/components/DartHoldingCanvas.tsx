import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import type { FlickState } from "../hooks/useFlickInput";
import type { DartConfig } from "../types/dart";
import DartMesh from "./DartMesh";

function HoldingDart({
  dartConfig,
  dartPos,
  flickState,
  pullDistance,
}: {
  dartConfig: DartConfig;
  dartPos: { x: number; y: number };
  flickState: FlickState;
  pullDistance: number;
}) {
  const groupRef = useRef<Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    if (flickState === "idle") {
      groupRef.current.position.x = Math.sin(t * 0.6) * 0.03;
      groupRef.current.position.y = Math.sin(t * 0.4) * 0.02;
      groupRef.current.rotation.z = Math.sin(t * 0.5) * 0.04;
      groupRef.current.rotation.x = -Math.PI / 2 + Math.sin(t * 0.3) * 0.02;
    } else if (flickState === "grabbed") {
      const scale = 0.012;
      groupRef.current.position.x +=
        (dartPos.x * scale - groupRef.current.position.x) * 0.25;
      groupRef.current.position.y +=
        (-dartPos.y * scale - groupRef.current.position.y) * 0.25;
      groupRef.current.rotation.x = -Math.PI / 2 + pullDistance * 0.3;
      groupRef.current.rotation.z = -dartPos.x * scale * 0.4;
    }
  });

  if (flickState === "released") return null;

  return (
    <group ref={groupRef} rotation={[-Math.PI / 2, 0, 0]}>
      <DartMesh
        color={dartConfig.color}
        barrelRadius={dartConfig.barrelRadius}
        flightSize={dartConfig.flightSize}
      />
    </group>
  );
}

export default function DartHoldingCanvas({
  dartConfig,
  dartPos,
  flickState,
  pullDistance,
}: {
  dartConfig: DartConfig;
  dartPos: { x: number; y: number };
  flickState: FlickState;
  pullDistance: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 2.8], fov: 50 }}
        gl={{ alpha: true, antialias: true }}
        style={{
          background: "transparent",
          pointerEvents: "none",
          touchAction: "none",
        }}
      >
        <ambientLight intensity={0.5} />
        <pointLight
          position={[0, 2, 3]}
          intensity={2}
          color={dartConfig.color}
        />
        <pointLight position={[0, 0, 5]} intensity={0.8} color="#ffffff" />
        <HoldingDart
          dartConfig={dartConfig}
          dartPos={dartPos}
          flickState={flickState}
          pullDistance={pullDistance}
        />
      </Canvas>
    </div>
  );
}
