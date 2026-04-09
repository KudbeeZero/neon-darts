import { forwardRef } from "react";
import * as THREE from "three";
import { BOARD_Z } from "../core/ArcPlanner";

interface TargetRingProps {
  position: THREE.Vector3;
}

const TargetRing = forwardRef<THREE.Mesh, TargetRingProps>(function TargetRing(
  { position },
  ref,
) {
  return (
    // Place ring at board surface (BOARD_Z + slight offset so it sits on face)
    <mesh
      ref={ref}
      position={[position.x, position.y, BOARD_Z + 0.015]}
      // Initial scale 1.2 — starts slightly larger, more visible
      scale={[1.2, 1.2, 1.2]}
    >
      {/* inner 0.20, outer 0.30 — more visible ring */}
      <ringGeometry args={[0.2, 0.3, 48]} />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={0.9}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
});

export default TargetRing;
