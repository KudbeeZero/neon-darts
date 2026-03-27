import { useFrame } from "@react-three/fiber";
import { memo, useMemo, useRef } from "react";
import * as THREE from "three";

const STAR_COUNT = 320;

const Starfield = memo(function Starfield() {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Pre-compute star positions
  const { positions, speeds } = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    const speeds: number[] = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 8 + Math.random() * 14;
      positions.push(
        new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi),
        ),
      );
      speeds.push(0.002 + Math.random() * 0.005);
    }
    return { positions, speeds };
  }, []);

  // Set initial transforms
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < STAR_COUNT; i++) {
      const pos = positions[i];
      dummy.position.set(
        pos.x + Math.sin(t * speeds[i] + i) * 0.3,
        pos.y + Math.cos(t * speeds[i] * 0.7 + i * 1.3) * 0.3,
        pos.z,
      );
      // Twinkling scale
      const twinkle = 0.7 + Math.sin(t * speeds[i] * 3 + i * 2.1) * 0.3;
      dummy.scale.setScalar(twinkle);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, STAR_COUNT]}>
      <sphereGeometry args={[0.025, 4, 4]} />
      <meshBasicMaterial color="#ffffff" />
    </instancedMesh>
  );
});

export default Starfield;
