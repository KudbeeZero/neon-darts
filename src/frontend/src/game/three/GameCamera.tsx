import { useFrame, useThree } from "@react-three/fiber";
import { forwardRef, useImperativeHandle, useRef } from "react";
import * as THREE from "three";

export interface GameCameraHandle {
  startThrow: (landingPos: THREE.Vector3, flightMs: number) => void;
  onImpact: () => void;
}

type CamMode = "idle" | "zooming" | "shaking" | "returning";

interface CamState {
  mode: CamMode;
  startTime: number;
  flightMs: number;
  shakeStartTime: number;
  returnStartFov: number;
  returnStartX: number;
  returnStartY: number;
  returnStartZ: number;
}

const GameCamera = forwardRef<GameCameraHandle, object>(
  function GameCamera(_, ref) {
    const { camera } = useThree();

    const camState = useRef<CamState>({
      mode: "idle",
      startTime: 0,
      flightMs: 400,
      shakeStartTime: 0,
      returnStartFov: 75,
      returnStartX: 0,
      returnStartY: 0.15,
      returnStartZ: 0,
    });

    useImperativeHandle(ref, () => ({
      // Only call this for perfect shots — triggers dramatic zoom
      startThrow(_landingPos: THREE.Vector3, flightMs: number) {
        const s = camState.current;
        s.mode = "zooming";
        s.startTime = Date.now();
        s.flightMs = flightMs;
      },
      // Always called on impact — triggers screen shake
      onImpact() {
        const s = camState.current;
        // If we were zooming, trigger shake from current fov/pos
        s.mode = "shaking";
        s.shakeStartTime = Date.now();
      },
    }));

    useFrame(() => {
      const s = camState.current;
      const cam = camera as THREE.PerspectiveCamera;
      const now = Date.now();

      if (s.mode === "zooming") {
        const t = Math.min(1, (now - s.startTime) / s.flightMs);
        // Dramatic zoom for perfect shots: FOV 75→48, slight push forward
        cam.fov = THREE.MathUtils.lerp(75, 48, t * t);
        cam.position.z = THREE.MathUtils.lerp(0, -0.35, t * t);
        cam.updateProjectionMatrix();
      } else if (s.mode === "shaking") {
        const elapsed = now - s.shakeStartTime;
        if (elapsed < 320) {
          const intensity = 0.012 * (1 - elapsed / 320);
          cam.position.x = (Math.random() - 0.5) * intensity * 2;
          cam.position.y = 0.15 + (Math.random() - 0.5) * intensity * 2;
        } else {
          s.mode = "returning";
          s.startTime = now;
          s.returnStartFov = cam.fov;
          s.returnStartX = cam.position.x;
          s.returnStartY = cam.position.y;
          s.returnStartZ = cam.position.z;
        }
      } else if (s.mode === "returning") {
        const t = Math.min(1, (now - s.startTime) / 700);
        const eased = 1 - (1 - t) * (1 - t);
        cam.fov = THREE.MathUtils.lerp(s.returnStartFov, 75, eased);
        cam.position.x = THREE.MathUtils.lerp(s.returnStartX, 0, eased);
        cam.position.y = THREE.MathUtils.lerp(s.returnStartY, 0.15, eased);
        cam.position.z = THREE.MathUtils.lerp(s.returnStartZ, 0, eased);
        cam.updateProjectionMatrix();
        if (t >= 1) s.mode = "idle";
      }
    });

    return null;
  },
);

export default GameCamera;
