import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";

export interface DartMeshHandle {
  group: THREE.Group | null;
  setFlightRoll: (t: number) => void;
  setBarrelRoll: (angle: number) => void;
  setDartScale: (scale: number) => void;
}

// ── Flight fin — simple PlaneGeometry-based fin with DoubleSide material ──────
// Using ShapeGeometry for a clean swept-back triangular fin.
// DoubleSide prevents any backface-culling pink artifact.
function createFinGeometry(): THREE.ShapeGeometry {
  // Fin shape in local XY space:
  //   Origin = attachment at hub (bottom of fin)
  //   Fin sweeps backward (+Y = away from barrel tip, toward player)
  //   Width tapers from wide at base to a point at the tip
  const shape = new THREE.Shape();
  // Start at root-left
  shape.moveTo(-0.022, 0);
  // Sweep out to max width at mid-fin
  shape.lineTo(-0.038, 0.055);
  // Taper to tip
  shape.lineTo(-0.01, 0.1);
  // Tip point
  shape.lineTo(0, 0.1);
  // Mirror right side
  shape.lineTo(0.01, 0.1);
  shape.lineTo(0.038, 0.055);
  // Back to root-right
  shape.lineTo(0.022, 0);
  // Close back to root-left
  shape.lineTo(-0.022, 0);

  return new THREE.ShapeGeometry(shape, 4);
}

// ── Knurl ring shape for lathe geometry ───────────────────────────────────────
function createKnurlPoints(
  baseRadius: number,
  knurlHeight: number,
  depth: number,
  segments: number,
): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= segments; i++) {
    const frac = i / segments;
    const r = baseRadius + Math.sin(frac * Math.PI) * depth;
    pts.push(new THREE.Vector2(r, (frac - 0.5) * knurlHeight));
  }
  return pts;
}

const DartMesh = forwardRef<DartMeshHandle, object>(function DartMesh(_, ref) {
  const groupRef = useRef<THREE.Group>(null);

  // 4 flight wing refs — rotated 90° apart around Z-axis
  const f1Ref = useRef<THREE.Mesh>(null); // top    (cyan)
  const f2Ref = useRef<THREE.Mesh>(null); // right  (magenta)
  const f3Ref = useRef<THREE.Mesh>(null); // bottom (cyan)
  const f4Ref = useRef<THREE.Mesh>(null); // left   (magenta)

  const flightGeo = useMemo(() => createFinGeometry(), []);

  // 3 knurl rings — subtle ridges on the barrel
  const knurlGeos = useMemo(() => {
    return [0.02, 0.08, 0.14].map(() => {
      const pts = createKnurlPoints(0.022, 0.012, 0.003, 8);
      return new THREE.LatheGeometry(pts, 14);
    });
  }, []);

  useImperativeHandle(ref, () => ({
    get group() {
      return groupRef.current;
    },
    // Barrel roll: spin flights around dart Z-axis
    setFlightRoll(t: number) {
      // Speed is π*8 — fed from R3FGame which controls accumulation
      const refs = [f1Ref, f2Ref, f3Ref, f4Ref];
      refs.forEach((r, i) => {
        if (r.current) {
          r.current.rotation.z = (Math.PI / 2) * i + t;
        }
      });
    },
    setBarrelRoll(angle: number) {
      const refs = [f1Ref, f2Ref, f3Ref, f4Ref];
      refs.forEach((r, i) => {
        if (r.current) {
          r.current.rotation.z = (Math.PI / 2) * i + angle;
        }
      });
    },
    setDartScale(scale: number) {
      if (groupRef.current) {
        groupRef.current.scale.setScalar(scale);
      }
    },
  }));

  // ── DART GEOMETRY ────────────────────────────────────────────────────────
  //
  // LOCAL Z-AXIS CONVENTION:
  //   -Z = toward the board (tip points this way)
  //   +Z = toward the player (flights extend this way)
  //
  // Scale is 1.8 (down from 5.5 — fixes the cannon-barrel problem).
  // At scale 1.8:
  //   barrel radius 0.022 → 0.040 world units (slim, correct)
  //   tip is a sharp prominent cone
  //   flights are large and visible in foreground

  return (
    <group
      ref={groupRef}
      position={[0, -1.1, 2.2]}
      scale={[1.8, 1.8, 1.8]}
      rotation={[-0.3, 0, 0]} // tip tilted slightly upward toward board when idle
    >
      {/* ── TIP — sharp prominent point ── */}
      <mesh position={[0, 0, -0.22]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.012, 0.12, 12]} />
        <meshStandardMaterial
          color="#cccccc"
          metalness={1.0}
          roughness={0.1}
          emissive="#aaaacc"
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* ── FRONT TAPER — tip to barrel transition ── */}
      <mesh position={[0, 0, -0.135]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.022, 0.06, 14]} />
        <meshStandardMaterial color="#2a2a35" metalness={0.9} roughness={0.3} />
      </mesh>

      {/* ── BARREL — main tungsten body ── */}
      <mesh position={[0, 0, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.2, 16]} />
        <meshStandardMaterial
          color="#2a2a35"
          metalness={0.9}
          roughness={0.3}
          emissive="#080818"
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* ── KNURL RINGS ×3 — subtle grip ridges ── */}
      {[0.02, 0.08, 0.14].map((z, idx) => (
        <mesh key={z} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
          <primitive object={knurlGeos[idx]} />
          <meshStandardMaterial
            color="#aaaacc"
            metalness={1.0}
            roughness={0.1}
            emissive="#5566aa"
            emissiveIntensity={0.25}
          />
        </mesh>
      ))}

      {/* ── REAR TAPER — barrel narrows toward shaft ── */}
      <mesh position={[0, 0, 0.21]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.012, 0.06, 12]} />
        <meshStandardMaterial color="#2a2a35" metalness={0.9} roughness={0.3} />
      </mesh>

      {/* ── SHAFT — slim connector ── */}
      <mesh position={[0, 0, 0.29]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.1, 10]} />
        <meshStandardMaterial
          color="#1a1a2e"
          metalness={0.9}
          roughness={0.15}
          emissive="#000066"
          emissiveIntensity={0.4}
        />
      </mesh>

      {/* ── FLIGHT HUB — connects shaft to flights ── */}
      <mesh position={[0, 0, 0.35]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.009, 0.009, 0.02, 10]} />
        <meshStandardMaterial color="#0d0d1e" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* ── FLIGHTS (4-wing fins with DoubleSide material) ──
           Fins attach at hub (z=0.35), sweep backward toward player (+Z).
           ShapeGeometry lies in XY plane by default.
           We rotate [π/2, 0, 0] to stand the fin up along the dart Z-axis,
           then each wing rotates around Z to fan out 90° apart.
           DoubleSide: prevents any backface / pink polygon artifact.
      ── */}

      {/* Wing 1 — TOP — CYAN ── 0° */}
      <mesh ref={f1Ref} position={[0, 0, 0.35]} rotation={[Math.PI / 2, 0, 0]}>
        <primitive object={flightGeo} />
        <meshStandardMaterial
          color="#00ffff"
          emissive="#00ffff"
          emissiveIntensity={2.0}
          roughness={0.1}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Wing 2 — RIGHT — MAGENTA ── 90° */}
      <mesh
        ref={f2Ref}
        position={[0, 0, 0.35]}
        rotation={[Math.PI / 2, 0, Math.PI / 2]}
      >
        <primitive object={flightGeo} />
        <meshStandardMaterial
          color="#ff00ff"
          emissive="#ff00ff"
          emissiveIntensity={2.0}
          roughness={0.1}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Wing 3 — BOTTOM — CYAN ── 180° */}
      <mesh
        ref={f3Ref}
        position={[0, 0, 0.35]}
        rotation={[Math.PI / 2, 0, Math.PI]}
      >
        <primitive object={flightGeo} />
        <meshStandardMaterial
          color="#00ffff"
          emissive="#00ffff"
          emissiveIntensity={2.0}
          roughness={0.1}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Wing 4 — LEFT — MAGENTA ── 270° */}
      <mesh
        ref={f4Ref}
        position={[0, 0, 0.35]}
        rotation={[Math.PI / 2, 0, -Math.PI / 2]}
      >
        <primitive object={flightGeo} />
        <meshStandardMaterial
          color="#ff00ff"
          emissive="#ff00ff"
          emissiveIntensity={2.0}
          roughness={0.1}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
});

export default DartMesh;
