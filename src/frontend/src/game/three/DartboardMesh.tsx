import { useFrame, useLoader } from "@react-three/fiber";
import { memo, useRef } from "react";
import * as THREE from "three";
import { BOARD_RADIUS, BOARD_Y_OFFSET, BOARD_Z } from "../core/ArcPlanner";

export interface DartboardMeshProps {
  highlightSegment?: number;
  highlightRing?: "single" | "double" | "triple" | "bull" | null;
  boardScale?: number;
}

const IMAGE_URL =
  "/assets/uploads/image-019d30ca-c3be-76da-8a51-ac7ea20ea119-1.png";

const DartboardMesh = memo(function DartboardMesh({
  highlightSegment = 0,
  highlightRing = null,
  boardScale = 1.0,
}: DartboardMeshProps) {
  const overlayMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const texture = useLoader(THREE.TextureLoader, IMAGE_URL);
  texture.colorSpace = THREE.SRGBColorSpace;

  const R = BOARD_RADIUS;
  const isHighlighting = !!(highlightSegment && highlightRing);

  useFrame(({ clock }) => {
    if (!overlayMatRef.current) return;
    if (isHighlighting) {
      const t = clock.elapsedTime;
      overlayMatRef.current.opacity = 0.12 + 0.1 * Math.abs(Math.sin(t * 5));
    } else {
      overlayMatRef.current.opacity = 0;
    }
  });

  return (
    <group
      position={[0, BOARD_Y_OFFSET, BOARD_Z]}
      scale={[boardScale, boardScale, 1]}
    >
      {/* Board back */}
      <mesh position={[0, 0, -0.015]}>
        <circleGeometry args={[R * 1.12, 64]} />
        <meshStandardMaterial color="#030308" roughness={1.0} />
      </mesh>

      {/* Main board texture */}
      <mesh>
        <circleGeometry args={[R, 64]} />
        <meshBasicMaterial map={texture} />
      </mesh>

      {/* Highlight overlay */}
      <mesh position={[0, 0, 0.001]}>
        <circleGeometry args={[R, 64]} />
        <meshBasicMaterial
          ref={overlayMatRef}
          color="#ffffff"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      {/* Outer glow halos */}
      <mesh>
        <torusGeometry args={[R * 1.002, 0.01, 8, 100]} />
        <meshStandardMaterial
          color="#00eeff"
          emissive="#00eeff"
          emissiveIntensity={1.0}
          transparent
          opacity={0.9}
        />
      </mesh>
      <mesh>
        <torusGeometry args={[R * 1.008, 0.008, 8, 100]} />
        <meshStandardMaterial
          color="#aa44ff"
          emissive="#aa44ff"
          emissiveIntensity={0.9}
          transparent
          opacity={0.6}
        />
      </mesh>
      <mesh>
        <torusGeometry args={[R * 1.016, 0.006, 8, 100]} />
        <meshStandardMaterial
          color="#0044ff"
          emissive="#0044ff"
          emissiveIntensity={0.7}
          transparent
          opacity={0.35}
        />
      </mesh>
    </group>
  );
});

export default DartboardMesh;
