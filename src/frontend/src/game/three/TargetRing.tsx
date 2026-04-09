import { forwardRef } from "react";
import * as THREE from "three";

interface TargetRingProps {
  position: THREE.Vector3;
}

const TargetRing = forwardRef<THREE.Mesh, TargetRingProps>(function TargetRing(
  { position },
  ref,
) {
  return (
    <mesh ref={ref} position={[position.x, position.y, position.z + 0.012]}>
      <ringGeometry args={[0.18, 0.26, 40]} />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={0.85}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
});

export default TargetRing;
