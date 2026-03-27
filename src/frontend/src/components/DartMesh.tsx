import { useRef } from "react";
import * as THREE from "three";

interface DartMeshProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
  opacity?: number;
  barrelRadius?: number;
  flightSize?: number;
}

export default function DartMesh({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  color = "#00e8ff",
  opacity = 1,
  barrelRadius = 0.055,
  flightSize = 0.12,
}: DartMeshProps) {
  const groupRef = useRef<THREE.Group>(null);

  const transparent = opacity < 1;
  const tipRadius = barrelRadius * 0.7;

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Tip — silver metallic cone */}
      <mesh position={[0, 0, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[tipRadius, 0.3, 8]} />
        <meshStandardMaterial
          color="#c8c8c8"
          roughness={0.15}
          metalness={0.95}
          transparent={transparent}
          opacity={opacity}
        />
      </mesh>

      {/* Barrel — dark metallic with neon emissive */}
      <mesh position={[0, 0, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[barrelRadius, tipRadius, 0.45, 12]} />
        <meshStandardMaterial
          color="#1a1a2e"
          roughness={0.3}
          metalness={0.85}
          emissive={color}
          emissiveIntensity={0.55}
          transparent={transparent}
          opacity={opacity}
        />
      </mesh>

      {/* Emissive ring */}
      <mesh position={[0, 0, 0.15]}>
        <torusGeometry args={[barrelRadius + 0.003, 0.008, 6, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.5}
          roughness={0.1}
          metalness={0.5}
          transparent={transparent}
          opacity={opacity}
        />
      </mesh>

      {/* Shaft */}
      <mesh position={[0, 0, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 0.5, 8]} />
        <meshStandardMaterial
          color="#2a2a3a"
          roughness={0.8}
          metalness={0.2}
          transparent={transparent}
          opacity={opacity}
        />
      </mesh>

      {/* Flights — 4× in X formation */}
      {[0, 45, 90, 135].map((angle) => (
        <mesh
          key={angle}
          position={[0, 0, -0.52]}
          rotation={[Math.PI / 2, (angle * Math.PI) / 180, 0]}
        >
          <planeGeometry args={[flightSize, flightSize * 1.8]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.65}
            transparent
            opacity={opacity * 0.88}
            side={THREE.DoubleSide}
            roughness={0.4}
            metalness={0.1}
          />
        </mesh>
      ))}
    </group>
  );
}
