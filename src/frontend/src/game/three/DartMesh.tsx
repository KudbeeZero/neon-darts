import { forwardRef, useImperativeHandle, useRef } from "react";
import * as THREE from "three";

export interface DartMeshHandle {
  group: THREE.Group | null;
  setFlightRoll: (t: number) => void;
}

const GRIP_Z = [0.13, 0.19, 0.25] as const;

const DartMesh = forwardRef<DartMeshHandle, object>(function DartMesh(_, ref) {
  const groupRef = useRef<THREE.Group>(null);
  const flight1Ref = useRef<THREE.Mesh>(null);
  const flight2Ref = useRef<THREE.Mesh>(null);

  useImperativeHandle(ref, () => ({
    get group() {
      return groupRef.current;
    },
    setFlightRoll(t: number) {
      const scale = 1 + Math.sin(t * Math.PI * 10) * 0.45;
      if (flight1Ref.current) flight1Ref.current.scale.x = scale;
      if (flight2Ref.current) flight2Ref.current.scale.x = scale;
    },
  }));

  return (
    <group ref={groupRef} position={[0, -0.3, -1.5]}>
      {/* Tip — apex at z=0 (group origin), cone extends +Z */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.04]} castShadow>
        <coneGeometry args={[0.012, 0.08, 8]} />
        <meshStandardMaterial
          color="#d4d4d4"
          metalness={0.95}
          roughness={0.05}
          emissive="#aaaacc"
          emissiveIntensity={0.1}
        />
      </mesh>

      {/* Barrel */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.19]} castShadow>
        <cylinderGeometry args={[0.013, 0.018, 0.22, 12]} />
        <meshStandardMaterial
          color="#1a1a2e"
          metalness={0.95}
          roughness={0.08}
          emissive="#0033aa"
          emissiveIntensity={0.18}
        />
      </mesh>

      {/* Grip rings */}
      {GRIP_Z.map((z) => (
        <mesh key={z} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, z]}>
          <cylinderGeometry args={[0.019, 0.019, 0.012, 10]} />
          <meshStandardMaterial
            color="#aaaacc"
            metalness={0.9}
            roughness={0.15}
          />
        </mesh>
      ))}

      {/* Flights — horizontal */}
      <mesh
        ref={flight1Ref}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, 0.32]}
      >
        <planeGeometry args={[0.14, 0.1]} />
        <meshStandardMaterial
          color="#ff0088"
          emissive="#ff0088"
          emissiveIntensity={0.6}
          side={THREE.DoubleSide}
          roughness={0.3}
          metalness={0.1}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Flights — vertical */}
      <mesh
        ref={flight2Ref}
        rotation={[Math.PI / 2, 0, Math.PI / 2]}
        position={[0, 0, 0.32]}
      >
        <planeGeometry args={[0.14, 0.1]} />
        <meshStandardMaterial
          color="#0066ff"
          emissive="#0066ff"
          emissiveIntensity={0.6}
          side={THREE.DoubleSide}
          roughness={0.3}
          metalness={0.1}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  );
});

export default DartMesh;
