import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";

export interface DartMeshHandle {
  group: THREE.Group | null;
  setFlightRoll: (t: number) => void;
  setBarrelRoll: (angle: number) => void;
}

// Flight wing shape — swept-back arrow
function createFlightShape(): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.045, 0.13);
  shape.lineTo(0.012, 0.06);
  shape.lineTo(0.012, 0);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

const DartMesh = forwardRef<DartMeshHandle, object>(function DartMesh(_, ref) {
  const groupRef = useRef<THREE.Group>(null);
  const f1aRef = useRef<THREE.Mesh>(null);
  const f1bRef = useRef<THREE.Mesh>(null);
  const f2aRef = useRef<THREE.Mesh>(null);
  const f2bRef = useRef<THREE.Mesh>(null);

  const flightGeo = useMemo(() => createFlightShape(), []);

  useImperativeHandle(ref, () => ({
    get group() {
      return groupRef.current;
    },
    setFlightRoll(t: number) {
      const angle = t * Math.PI * 12;
      const refs = [f1aRef, f1bRef, f2aRef, f2bRef];
      refs.forEach((r, i) => {
        if (r.current) {
          r.current.rotation.z = (Math.PI / 2) * i + angle;
        }
      });
    },
    setBarrelRoll(angle: number) {
      const refs = [f1aRef, f1bRef, f2aRef, f2bRef];
      refs.forEach((r, i) => {
        if (r.current) {
          r.current.rotation.z = (Math.PI / 2) * i + angle;
        }
      });
    },
  }));

  return (
    <group ref={groupRef} position={[0, -0.55, -0.9]} scale={[2.5, 2.5, 2.5]}>
      {/* ── TIP ── */}
      <mesh position={[0, 0, -0.005]}>
        <coneGeometry args={[0.004, 0.055, 10]} />
        <meshStandardMaterial
          color="#d8d8e8"
          metalness={1.0}
          roughness={0.02}
          emissive="#aaaacc"
          emissiveIntensity={0.1}
        />
      </mesh>

      {/* ── FRONT TAPER ── */}
      <mesh position={[0, 0, 0.055]}>
        {/* wider rear end to match bigger barrel */}
        <cylinderGeometry args={[0.004, 0.018, 0.06, 12]} />
        <meshStandardMaterial
          color="#c0c0d8"
          metalness={0.98}
          roughness={0.05}
        />
      </mesh>

      {/* ── BARREL: slightly bigger (was 0.014/0.013) ── */}
      <mesh position={[0, 0, 0.135]}>
        <cylinderGeometry args={[0.018, 0.016, 0.18, 16]} />
        <meshStandardMaterial
          color="#1c1c2c"
          metalness={0.97}
          roughness={0.06}
          emissive="#111133"
          emissiveIntensity={0.4}
        />
      </mesh>

      {/* Barrel highlight stripe */}
      <mesh position={[0, 0, 0.13]}>
        <cylinderGeometry args={[0.019, 0.019, 0.04, 16]} />
        <meshStandardMaterial
          color="#8899ff"
          metalness={1.0}
          roughness={0.0}
          emissive="#8899ff"
          emissiveIntensity={0.5}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Knurl rings x5 */}
      {[0.07, 0.1, 0.13, 0.16, 0.19].map((z) => (
        <mesh key={z} position={[0, 0, z]}>
          <cylinderGeometry args={[0.02, 0.02, 0.008, 14]} />
          <meshStandardMaterial
            color="#aaaacc"
            metalness={1.0}
            roughness={0.05}
            emissive="#6677bb"
            emissiveIntensity={0.2}
          />
        </mesh>
      ))}

      {/* ── REAR TAPER ── */}
      <mesh position={[0, 0, 0.235]}>
        <cylinderGeometry args={[0.01, 0.018, 0.05, 12]} />
        <meshStandardMaterial
          color="#2a2a40"
          metalness={0.95}
          roughness={0.08}
        />
      </mesh>

      {/* ── SHAFT / STEM ── */}
      <mesh position={[0, 0, 0.29]}>
        <cylinderGeometry args={[0.005, 0.008, 0.08, 10]} />
        <meshStandardMaterial
          color="#222233"
          metalness={0.9}
          roughness={0.1}
          emissive="#0022aa"
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* ── FLIGHTS ── */}
      <mesh position={[0, 0, 0.335]}>
        <cylinderGeometry args={[0.007, 0.007, 0.012, 8]} />
        <meshStandardMaterial color="#111122" metalness={0.9} roughness={0.2} />
      </mesh>

      <mesh ref={f1aRef} position={[0, 0, 0.335]}>
        <primitive object={flightGeo} />
        <meshStandardMaterial
          color="#00ccff"
          emissive="#00ccff"
          emissiveIntensity={1.2}
          side={THREE.DoubleSide}
          transparent
          opacity={0.92}
          roughness={0.15}
          metalness={0.1}
        />
      </mesh>
      <mesh ref={f1bRef} position={[0, 0, 0.335]} rotation={[0, 0, Math.PI]}>
        <primitive object={flightGeo} />
        <meshStandardMaterial
          color="#00ccff"
          emissive="#00ccff"
          emissiveIntensity={1.2}
          side={THREE.DoubleSide}
          transparent
          opacity={0.92}
          roughness={0.15}
          metalness={0.1}
        />
      </mesh>
      <mesh
        ref={f2aRef}
        position={[0, 0, 0.335]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <primitive object={flightGeo} />
        <meshStandardMaterial
          color="#ff0088"
          emissive="#ff0088"
          emissiveIntensity={1.2}
          side={THREE.DoubleSide}
          transparent
          opacity={0.92}
          roughness={0.15}
          metalness={0.1}
        />
      </mesh>
      <mesh
        ref={f2bRef}
        position={[0, 0, 0.335]}
        rotation={[0, 0, -Math.PI / 2]}
      >
        <primitive object={flightGeo} />
        <meshStandardMaterial
          color="#ff0088"
          emissive="#ff0088"
          emissiveIntensity={1.2}
          side={THREE.DoubleSide}
          transparent
          opacity={0.92}
          roughness={0.15}
          metalness={0.1}
        />
      </mesh>
    </group>
  );
});

export default DartMesh;
