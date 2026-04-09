import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";

export interface DartMeshHandle {
  group: THREE.Group | null;
  setFlightRoll: (t: number) => void;
  setBarrelRoll: (angle: number) => void;
}

// Flight wing shape — swept-back arrow, wider and bolder than before
function createFlightShape(): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.055, 0.155);
  shape.lineTo(0.015, 0.072);
  shape.lineTo(0.015, 0);
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
    // Barrel roll active throughout entire flight
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

  // Scale 5.0x — large foreground dart matching Darts of Fury
  // Position: low and close to camera so it fills lower portion of screen
  return (
    <group ref={groupRef} position={[0, -1.2, 2.8]} scale={[5.0, 5.0, 5.0]}>
      {/* ── TIP ── */}
      <mesh position={[0, 0, -0.005]}>
        <coneGeometry args={[0.004, 0.055, 10]} />
        <meshStandardMaterial
          color="#e8e8f4"
          metalness={1.0}
          roughness={0.02}
          emissive="#bbbbdd"
          emissiveIntensity={0.15}
        />
      </mesh>

      {/* ── FRONT TAPER ── */}
      <mesh position={[0, 0, 0.055]}>
        <cylinderGeometry args={[0.004, 0.018, 0.06, 12]} />
        <meshStandardMaterial
          color="#c8c8e0"
          metalness={0.98}
          roughness={0.05}
        />
      </mesh>

      {/* ── BARREL ── */}
      <mesh position={[0, 0, 0.135]}>
        <cylinderGeometry args={[0.019, 0.017, 0.19, 16]} />
        <meshStandardMaterial
          color="#18182a"
          metalness={0.97}
          roughness={0.06}
          emissive="#111133"
          emissiveIntensity={0.45}
        />
      </mesh>

      {/* Barrel highlight stripe */}
      <mesh position={[0, 0, 0.13]}>
        <cylinderGeometry args={[0.021, 0.021, 0.045, 16]} />
        <meshStandardMaterial
          color="#99aaff"
          metalness={1.0}
          roughness={0.0}
          emissive="#99aaff"
          emissiveIntensity={0.6}
          transparent
          opacity={0.65}
        />
      </mesh>

      {/* Knurl rings ×5 */}
      {[0.07, 0.1, 0.13, 0.16, 0.19].map((z) => (
        <mesh key={z} position={[0, 0, z]}>
          <cylinderGeometry args={[0.022, 0.022, 0.009, 14]} />
          <meshStandardMaterial
            color="#aaaacc"
            metalness={1.0}
            roughness={0.05}
            emissive="#6677bb"
            emissiveIntensity={0.25}
          />
        </mesh>
      ))}

      {/* ── REAR TAPER ── */}
      <mesh position={[0, 0, 0.24]}>
        <cylinderGeometry args={[0.011, 0.019, 0.052, 12]} />
        <meshStandardMaterial
          color="#2a2a40"
          metalness={0.95}
          roughness={0.08}
        />
      </mesh>

      {/* ── SHAFT / STEM ── */}
      <mesh position={[0, 0, 0.295]}>
        <cylinderGeometry args={[0.005, 0.009, 0.082, 10]} />
        <meshStandardMaterial
          color="#1e1e30"
          metalness={0.9}
          roughness={0.1}
          emissive="#0022aa"
          emissiveIntensity={0.25}
        />
      </mesh>

      {/* ── FLIGHT HUB ── */}
      <mesh position={[0, 0, 0.342]}>
        <cylinderGeometry args={[0.008, 0.008, 0.013, 8]} />
        <meshStandardMaterial color="#111122" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* ── FLIGHTS (4-wing) ── */}
      <mesh ref={f1aRef} position={[0, 0, 0.342]}>
        <primitive object={flightGeo} />
        <meshStandardMaterial
          color="#00ccff"
          emissive="#00ccff"
          emissiveIntensity={1.4}
          side={THREE.DoubleSide}
          transparent
          opacity={0.94}
          roughness={0.12}
          metalness={0.08}
        />
      </mesh>
      <mesh ref={f1bRef} position={[0, 0, 0.342]} rotation={[0, 0, Math.PI]}>
        <primitive object={flightGeo} />
        <meshStandardMaterial
          color="#00ccff"
          emissive="#00ccff"
          emissiveIntensity={1.4}
          side={THREE.DoubleSide}
          transparent
          opacity={0.94}
          roughness={0.12}
          metalness={0.08}
        />
      </mesh>
      <mesh
        ref={f2aRef}
        position={[0, 0, 0.342]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <primitive object={flightGeo} />
        <meshStandardMaterial
          color="#ff0088"
          emissive="#ff0088"
          emissiveIntensity={1.4}
          side={THREE.DoubleSide}
          transparent
          opacity={0.94}
          roughness={0.12}
          metalness={0.08}
        />
      </mesh>
      <mesh
        ref={f2bRef}
        position={[0, 0, 0.342]}
        rotation={[0, 0, -Math.PI / 2]}
      >
        <primitive object={flightGeo} />
        <meshStandardMaterial
          color="#ff0088"
          emissive="#ff0088"
          emissiveIntensity={1.4}
          side={THREE.DoubleSide}
          transparent
          opacity={0.94}
          roughness={0.12}
          metalness={0.08}
        />
      </mesh>
    </group>
  );
});

export default DartMesh;
