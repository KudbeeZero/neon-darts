import { useFrame } from "@react-three/fiber";
import { memo, useMemo, useRef } from "react";
import * as THREE from "three";

const STAR_COUNT = 320;

const NEBULA_0 = {
  color: "#440066",
  pos: [-4, 2, -28] as const,
  r: 3.0,
  speed: 0.0003,
};
const NEBULA_1 = {
  color: "#003344",
  pos: [5, -1, -33] as const,
  r: 3.5,
  speed: 0.0002,
};
const NEBULA_2 = {
  color: "#440033",
  pos: [-2, -3, -25] as const,
  r: 2.5,
  speed: 0.0004,
};
const NEBULAS = [NEBULA_0, NEBULA_1, NEBULA_2];

const Starfield = memo(function Starfield() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const neb0Ref = useRef<THREE.Mesh>(null);
  const neb1Ref = useRef<THREE.Mesh>(null);
  const neb2Ref = useRef<THREE.Mesh>(null);
  const nebRefs = [neb0Ref, neb1Ref, neb2Ref];

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

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (meshRef.current) {
      for (let i = 0; i < STAR_COUNT; i++) {
        const pos = positions[i];
        dummy.position.set(
          pos.x + Math.sin(t * speeds[i] + i) * 0.3,
          pos.y + Math.cos(t * speeds[i] * 0.7 + i * 1.3) * 0.3,
          pos.z,
        );
        const twinkle = 0.7 + Math.sin(t * speeds[i] * 3 + i * 2.1) * 0.3;
        dummy.scale.setScalar(twinkle);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
      }
      meshRef.current.instanceMatrix.needsUpdate = true;
    }

    NEBULAS.forEach((neb, idx) => {
      const m = nebRefs[idx].current;
      if (m) {
        m.position.x = neb.pos[0] + Math.sin(t * neb.speed * 1000) * 0.4;
        m.position.y = neb.pos[1] + Math.cos(t * neb.speed * 700) * 0.3;
      }
    });
  });

  return (
    <>
      <instancedMesh ref={meshRef} args={[undefined, undefined, STAR_COUNT]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshBasicMaterial color="#ffffff" />
      </instancedMesh>

      <mesh ref={neb0Ref} position={NEBULA_0.pos}>
        <sphereGeometry args={[NEBULA_0.r, 12, 12]} />
        <meshBasicMaterial
          color={NEBULA_0.color}
          transparent
          opacity={0.07}
          side={THREE.BackSide}
        />
      </mesh>
      <mesh ref={neb1Ref} position={NEBULA_1.pos}>
        <sphereGeometry args={[NEBULA_1.r, 12, 12]} />
        <meshBasicMaterial
          color={NEBULA_1.color}
          transparent
          opacity={0.07}
          side={THREE.BackSide}
        />
      </mesh>
      <mesh ref={neb2Ref} position={NEBULA_2.pos}>
        <sphereGeometry args={[NEBULA_2.r, 12, 12]} />
        <meshBasicMaterial
          color={NEBULA_2.color}
          transparent
          opacity={0.07}
          side={THREE.BackSide}
        />
      </mesh>
    </>
  );
});

export default Starfield;
